"""
Gamification Service — роутер лидерборда
===============================================
Реальный рейтинг из XPTransaction + исторические снимки.
Автор: Dmitry Koval
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
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


@router.get("/xp", response_model=LeaderboardResponse, summary="Топ игроков по XP")
async def leaderboard_xp(
    period: str = Query("all_time", pattern="^(weekly|monthly|all_time)$"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    # Фильтр по периоду
    since = None
    if period == "weekly":
        since = datetime.now(timezone.utc) - timedelta(days=7)
    elif period == "monthly":
        since = datetime.now(timezone.utc) - timedelta(days=30)

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

    rows = (await db.execute(q)).all()

    entries = []
    for rank, row in enumerate(rows, start=1):
        uid = row.user_id
        total_xp = max(row.total_xp, 0)

        quests_done = await db.scalar(
            select(func.count(UserQuest.id))
            .where(UserQuest.user_id == uid)
            .where(UserQuest.status == UserQuestStatus.COMPLETED)
        ) or 0

        badges = await db.scalar(
            select(func.count(UserBadge.id))
            .where(UserBadge.user_id == uid)
        ) or 0

        entries.append(LeaderboardEntryResponse(
            rank=rank,
            user_id=uid,
            username=f"player_{uid[:8]}",  # полное имя будет через Auth Service
            full_name=None,
            total_xp=total_xp,
            level=_calc_level(total_xp),
            total_coins=0,
            quests_completed=quests_done,
            badges_count=badges,
        ))

    return LeaderboardResponse(
        period=period,
        entries=entries,
        total_players=len(entries),
        updated_at=datetime.now(timezone.utc),
    )
