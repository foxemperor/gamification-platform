"""
Gamification Service — эндпоинты участников (members)
=======================================================
Возвращает список участников платформы с их уровнями и XP.
Поддерживает фильтрацию по scope: all, project, department, team.

Используется фронтендом для:
  - Страницы «Список участников»
  - Виджета «Топ игроков» (Dashboard)

Ответ соответствует контракту фронтенд MembersResponse:
  { scope, items: MemberEntry[], total }

Автор: Dmitry Koval
"""

import logging
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, DB_SCHEMA
from app.dependencies import get_current_user_id
from app.models import LeaderboardSnapshot, XPTransaction, xp_required_for_level

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/members", tags=["members"])

AUTH_SCHEMA = "auth"


# ===================================
# СХЕМЫ ОТВЕТА
# Контракт полностью совпадает с frontend/src/api/members.ts
# ===================================

class MemberEntry(BaseModel):
    user_id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    level: int
    total_xp: int = 0
    rank: Optional[int] = None
    department: Optional[str] = None
    project_name: Optional[str] = None
    manager_id: Optional[str] = None
    is_self: bool = False
    birthday: Optional[date] = None

    model_config = {"from_attributes": True}


class MembersResponse(BaseModel):
    scope: str
    items: List[MemberEntry]
    total: int


# ===================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ===================================

def _compute_level_from_xp(total_xp: int) -> int:
    """Вычисляет уровень по суммарному XP через формулу прогрессии."""
    level = 1
    accumulated = 0
    while True:
        needed = xp_required_for_level(level)
        if accumulated + needed > total_xp:
            break
        accumulated += needed
        level += 1
        if level > 999:
            break
    return level


# ===================================
# ЭНДПОИНТЫ
# ===================================

@router.get(
    "",
    response_model=MembersResponse,
    summary="Список участников платформы",
)
async def list_members(
    scope: str = Query(
        default="all",
        description="Область выборки: all | project | department | team",
    ),
    search: str = Query(
        default="",
        description="Поиск по username или full_name",
    ),
    limit: int = Query(
        default=200,
        ge=1,
        le=500,
        description="Максимальное число записей",
    ),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает список участников платформы.

    Первичный источник — leaderboard_snapshots (period='all_time') +
    обогащение данными пользователя из auth.users (department, project, role, manager_id, birthday).
    Если снапшоты отсутствуют — fallback через агрегацию xp_transactions.
    """

    search_q = search.strip().lower()

    # --- Попытка 1: LeaderboardSnapshot (period = 'all_time') ---
    snapshot_result = await db.execute(
        select(LeaderboardSnapshot)
        .where(LeaderboardSnapshot.period == "all_time")
        .order_by(LeaderboardSnapshot.total_xp.desc())
        .limit(limit)
    )
    snapshots = snapshot_result.scalars().all()

    items: List[MemberEntry] = []

    if snapshots:
        # Получаем user_id снапшотов для JOIN с auth.users
        snapshot_user_ids = [str(s.user_id) for s in snapshots]

        # Запрашиваем дополнительные поля из auth.users
        # Индексы: 0=id, 1=role, 2=department, 3=project_name, 4=manager_id, 5=avatar_url, 6=birthday
        auth_rows = await db.execute(
            text(
                f"SELECT id::text, role, department, project AS project_name, "
                f"manager_id::text, avatar_url, birthday "
                f"FROM {AUTH_SCHEMA}.users "
                f"WHERE id::text = ANY(:ids)"
            ),
            {"ids": snapshot_user_ids},
        )
        auth_map = {row[0]: row for row in auth_rows.fetchall()}

        for rank_idx, row in enumerate(snapshots, start=1):
            uid = str(row.user_id)
            auth = auth_map.get(uid)

            entry = MemberEntry(
                user_id=uid,
                username=row.username,
                full_name=row.full_name,
                avatar_url=auth[5] if auth else None,
                role=auth[1] if auth else None,
                level=row.level,
                total_xp=row.total_xp,
                rank=rank_idx,
                department=auth[2] if auth else None,
                project_name=auth[3] if auth else None,
                manager_id=auth[4] if auth else None,
                is_self=(uid == current_user_id),
                birthday=auth[6] if auth else None,
            )

            # Фильтрация по поисковому запросу
            if search_q:
                haystack = f"{entry.username} {entry.full_name or ''}".lower()
                if search_q not in haystack:
                    continue

            items.append(entry)

        logger.info(
            f"GET /api/v1/members scope={scope} search='{search_q}' limit={limit} "
            f"→ {len(items)} записей из leaderboard_snapshots"
        )
        return MembersResponse(scope=scope, items=items, total=len(items))

    # --- Fallback: агрегация из XPTransaction ---
    logger.warning(
        "leaderboard_snapshots пуст — fallback через XPTransaction"
    )
    xp_agg = await db.execute(
        select(
            XPTransaction.user_id,
            func.sum(XPTransaction.amount).label("total_xp"),
        )
        .group_by(XPTransaction.user_id)
        .order_by(func.sum(XPTransaction.amount).desc())
        .limit(limit)
    )
    xp_rows = xp_agg.all()

    fallback_user_ids = [str(r.user_id) for r in xp_rows]
    # Индексы: 0=id, 1=username, 2=full_name, 3=role, 4=department,
    #          5=project_name, 6=manager_id, 7=avatar_url, 8=birthday
    auth_rows = await db.execute(
        text(
            f"SELECT id::text, username, full_name, role, department, "
            f"project AS project_name, manager_id::text, avatar_url, birthday "
            f"FROM {AUTH_SCHEMA}.users "
            f"WHERE id::text = ANY(:ids)"
        ),
        {"ids": fallback_user_ids},
    )
    auth_map = {row[0]: row for row in auth_rows.fetchall()}

    for rank_idx, row in enumerate(xp_rows, start=1):
        uid = str(row.user_id)
        total_xp = max(0, int(row.total_xp or 0))
        auth = auth_map.get(uid)

        entry = MemberEntry(
            user_id=uid,
            username=auth[1] if auth else f"user_{uid[:8]}",
            full_name=auth[2] if auth else None,
            avatar_url=auth[7] if auth else None,
            role=auth[3] if auth else None,
            level=_compute_level_from_xp(total_xp),
            total_xp=total_xp,
            rank=rank_idx,
            department=auth[4] if auth else None,
            project_name=auth[5] if auth else None,
            manager_id=auth[6] if auth else None,
            is_self=(uid == current_user_id),
            birthday=auth[8] if auth else None,
        )

        if search_q:
            haystack = f"{entry.username} {entry.full_name or ''}".lower()
            if search_q not in haystack:
                continue

        items.append(entry)

    logger.info(
        f"GET /api/v1/members scope={scope} search='{search_q}' limit={limit} "
        f"→ {len(items)} записей из xp_transactions (fallback)"
    )
    return MembersResponse(scope=scope, items=items, total=len(items))
