"""
Gamification Service — эндпоинты участников (members)
=======================================================
Возвращает список участников платформы с их уровнями и XP.
Поддерживает фильтрацию по scope: all, project, department, team.

Используется фронтендом для:
  - Страницы «Список участников»
  - Виджета «Топ игроков» (Dashboard)

Автор: Dmitry Koval
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models import LeaderboardSnapshot, XPTransaction, xp_required_for_level

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/members", tags=["members"])


# ===================================
# СХЕМЫ ОТВЕТА
# ===================================

class MemberResponse(BaseModel):
    user_id: str
    username: str
    full_name: Optional[str] = None
    level: int
    total_xp: int
    rank: Optional[int] = None

    model_config = {"from_attributes": True}


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
    response_model=list[MemberResponse],
    summary="Список участников платформы",
)
async def list_members(
    scope: str = Query(
        default="all",
        description="Область выборки: all | project | department | team",
    ),
    limit: int = Query(
        default=200,
        ge=1,
        le=500,
        description="Максимальное число записей",
    ),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает список участников платформы с их уровнем, XP и рангом.

    Первичный источник — таблица leaderboard_snapshots (period='all_time').
    Если снапшоты отсутствуют — fallback через агрегацию xp_transactions.

    Параметр scope зарезервирован для будущей фильтрации
    (project / department / team). Сейчас все значения scope возвращают
    единый глобальный список, отсортированный по убыванию total_xp.
    """

    # --- Попытка 1: LeaderboardSnapshot (period = 'all_time') ---
    snapshot_result = await db.execute(
        select(LeaderboardSnapshot)
        .where(LeaderboardSnapshot.period == "all_time")
        .order_by(LeaderboardSnapshot.total_xp.desc())
        .limit(limit)
    )
    snapshots = snapshot_result.scalars().all()

    if snapshots:
        members = []
        for rank_idx, row in enumerate(snapshots, start=1):
            members.append(
                MemberResponse(
                    user_id=str(row.user_id),
                    username=row.username,
                    full_name=row.full_name,
                    level=row.level,
                    total_xp=row.total_xp,
                    rank=rank_idx,
                )
            )
        logger.info(
            f"GET /api/v1/members scope={scope} limit={limit} "
            f"→ {len(members)} записей из leaderboard_snapshots"
        )
        return members

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
    rows = xp_agg.all()

    members = []
    for rank_idx, row in enumerate(rows, start=1):
        total_xp = max(0, int(row.total_xp or 0))
        members.append(
            MemberResponse(
                user_id=str(row.user_id),
                username=f"user_{str(row.user_id)[:8]}",
                full_name=None,
                level=_compute_level_from_xp(total_xp),
                total_xp=total_xp,
                rank=rank_idx,
            )
        )

    logger.info(
        f"GET /api/v1/members scope={scope} limit={limit} "
        f"→ {len(members)} записей из xp_transactions (fallback)"
    )
    return members
