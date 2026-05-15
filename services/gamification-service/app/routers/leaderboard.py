"""
Gamification Service — роутер лидерборда
===============================================
Реальный рейтинг из XPTransaction + исторические снимки.
Автор: Dmitry Koval
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import XPTransaction, UserQuest, UserBadge, UserQuestStatus, xp_required_for_level
from app.schemas import LeaderboardResponse, LeaderboardEntryResponse

router = APIRouter(prefix="/api/v1/leaderboard", tags=["leaderboard"])


def _calc_level(total_xp: int) -> int:
    """XP → уровень."""
    level = 1
    xp_acc = 0
    while xp_acc + xp_required_for_level(level) <= total_xp:
        xp_acc += xp_required_for_level(level)
        level += 1
    return level


class _UserInfo:
    """Агрегат с профильными данными пользователя из auth.users."""
    __slots__ = ("username", "full_name", "department", "project_name", "position")

    def __init__(
        self,
        username: str,
        full_name: Optional[str],
        department: Optional[str],
        project_name: Optional[str],
        position: Optional[str],
    ) -> None:
        self.username = username
        self.full_name = full_name
        self.department = department
        self.project_name = project_name
        self.position = position


async def _fetch_user_info(
    db: AsyncSession, user_ids: list[str]
) -> dict[str, _UserInfo]:
    """
    Один батч-запрос к auth.users.
    Тянем: username, full_name, department, project_name, position.
    Fallback — player_{uid[:8]} если пользователь не найден.
    """
    if not user_ids:
        return {}
    result = await db.execute(
        text(
            """
            SELECT
                id::text          AS user_id,
                username,
                full_name,
                department,
                project_name,
                position
            FROM auth.users
            WHERE id::text = ANY(:ids)
            """
        ),
        {"ids": user_ids},
    )
    rows = result.fetchall()
    return {
        row[0]: _UserInfo(
            username=row[1],
            full_name=row[2],
            department=row[3],
            project_name=row[4],
            position=row[5],
        )
        for row in rows
    }


@router.get("/xp", response_model=LeaderboardResponse, summary="Топ игроков по XP")
async def leaderboard_xp(
    period: str = Query("all_time", pattern="^(weekly|monthly|all_time)$"),
    limit: int = Query(50, ge=1, le=100),
    project: Optional[str] = Query(
        None,
        description="Фильтр по названию проекта (из поля project_name в auth.users). "
                    "Если не указан — все проекты.",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Лидерборд по XP.

    Параметры:
    - **period**: `weekly` | `monthly` | `all_time`
    - **limit**: сколько строк вернуть (1-100, дефолт 50)
    - **project**: фильтр по проекту (точное совпадение с `project_name` из auth.users)
    """
    # ── 1. Фильтр по периоду ──
    since: Optional[datetime] = None
    if period == "weekly":
        since = datetime.now(timezone.utc) - timedelta(days=7)
    elif period == "monthly":
        since = datetime.now(timezone.utc) - timedelta(days=30)

    # ── 2. Если задан фильтр по проекту — получаем список user_id из auth.users ──
    project_user_ids: Optional[list[str]] = None
    if project:
        proj_result = await db.execute(
            text(
                "SELECT id::text FROM auth.users "
                "WHERE project_name = :project"
            ),
            {"project": project},
        )
        project_user_ids = [row[0] for row in proj_result.fetchall()]
        # Если в проекте никого нет — вернём пустой лидерборд сразу
        if not project_user_ids:
            return LeaderboardResponse(
                period=period,
                entries=[],
                total_players=0,
                updated_at=datetime.now(timezone.utc),
            )

    # ── 3. Агрегация XP ──
    q = (
        select(
            XPTransaction.user_id,
            func.sum(XPTransaction.amount).label("total_xp"),
        )
        .group_by(XPTransaction.user_id)
        .order_by(func.sum(XPTransaction.amount).desc())
        .limit(limit)
    )
    if since:
        q = q.where(XPTransaction.created_at >= since)
    if project_user_ids is not None:
        q = q.where(XPTransaction.user_id.in_(project_user_ids))

    rows = (await db.execute(q)).all()

    # ── 4. Батч-запрос профилей ──
    user_ids = [row.user_id for row in rows]
    user_info_map = await _fetch_user_info(db, user_ids)

    # ── 5. Сборка ответа ──
    entries: list[LeaderboardEntryResponse] = []
    for rank, row in enumerate(rows, start=1):
        uid = row.user_id
        total_xp = max(row.total_xp, 0)

        info = user_info_map.get(uid)
        username = info.username if info else f"player_{uid[:8]}"
        full_name = info.full_name if info else None
        department = info.department if info else None
        project_name = info.project_name if info else None
        position = info.position if info else None

        quests_done = await db.scalar(
            select(func.count(UserQuest.id))
            .where(UserQuest.user_id == uid)
            .where(UserQuest.status == UserQuestStatus.COMPLETED)
        ) or 0

        badges = await db.scalar(
            select(func.count(UserBadge.id))
            .where(UserBadge.user_id == uid)
        ) or 0

        entries.append(
            LeaderboardEntryResponse(
                rank=rank,
                user_id=uid,
                username=username,
                full_name=full_name,
                total_xp=total_xp,
                level=_calc_level(total_xp),
                total_coins=0,
                quests_completed=quests_done,
                badges_count=badges,
                department=department,
                project_name=project_name,
                position=position,
            )
        )

    return LeaderboardResponse(
        period=period,
        entries=entries,
        total_players=len(entries),
        updated_at=datetime.now(timezone.utc),
    )
