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


@router.get("/xp", response_model=LeaderboardResponse, summary="Топ игроков по XP")
async def leaderboard_xp(
    period: str = Query("all_time", pattern="^(weekly|monthly|all_time)$"),
    limit: int = Query(50, ge=1, le=100),
    project: Optional[str] = Query(
        None,
        description="Фильтр по названию проекта (поле `project` в auth.users). "
                    "Если не указан — все проекты.",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Лидерборд по XP.

    Данные всегда актуальны: агрегируются из xp_transactions на лету
    с JOIN к auth.users — призрачные user_id автоматически отфильтровываются.

    Параметры:
    - **period**: `weekly` | `monthly` | `all_time`
    - **limit**: сколько строк вернуть (1-100, дефолт 50)
    - **project**: фильтр по проекту (точное совпадение с `project` из auth.users)
    """
    # ── 1. Фильтр по периоду ──
    since: Optional[datetime] = None
    if period == "weekly":
        since = datetime.now(timezone.utc) - timedelta(days=7)
    elif period == "monthly":
        since = datetime.now(timezone.utc) - timedelta(days=30)

    # ── 2. Один SQL-запрос: агрегация XP + JOIN с auth.users ──
    # JOIN гарантирует что в рейтинг попадают ТОЛЬКО реальные пользователи.
    # Призрачные user_id (от старых тестов/пересоздания БД) отсекаются автоматически.
    period_filter = ""
    if since:
        period_filter = "AND xt.created_at >= :since"

    project_filter = ""
    if project:
        project_filter = "AND u.project = :project"

    raw_sql = text(f"""
        SELECT
            xt.user_id::text            AS user_id,
            SUM(xt.amount)              AS total_xp,
            u.username,
            u.full_name,
            u.avatar_url,
            u.department,
            u.project                   AS project_name,
            u.position
        FROM gamification.xp_transactions xt
        INNER JOIN auth.users u ON u.id = xt.user_id::uuid
        WHERE u.is_active = true
          {period_filter}
          {project_filter}
        GROUP BY xt.user_id, u.username, u.full_name, u.avatar_url, u.department, u.project, u.position
        ORDER BY total_xp DESC
        LIMIT :limit
    """)

    params: dict = {"limit": limit}
    if since:
        params["since"] = since
    if project:
        params["project"] = project

    rows = (await db.execute(raw_sql, params)).fetchall()

    if not rows:
        return LeaderboardResponse(
            period=period,
            entries=[],
            total_players=0,
            updated_at=datetime.now(timezone.utc),
        )

    # ── 3. Батч-запрос квестов и бейджей ──
    user_ids = [row.user_id for row in rows]

    quests_rows = (await db.execute(
        select(UserQuest.user_id, func.count(UserQuest.id).label("cnt"))
        .where(UserQuest.user_id.in_(user_ids))
        .where(UserQuest.status == UserQuestStatus.COMPLETED)
        .group_by(UserQuest.user_id)
    )).all()
    quests_map: dict[str, int] = {r.user_id: r.cnt for r in quests_rows}

    badges_rows = (await db.execute(
        select(UserBadge.user_id, func.count(UserBadge.id).label("cnt"))
        .where(UserBadge.user_id.in_(user_ids))
        .group_by(UserBadge.user_id)
    )).all()
    badges_map: dict[str, int] = {r.user_id: r.cnt for r in badges_rows}

    # ── 4. Сборка ответа ──
    entries: list[LeaderboardEntryResponse] = []
    for rank, row in enumerate(rows, start=1):
        uid = row.user_id
        total_xp = max(int(row.total_xp), 0)

        entries.append(
            LeaderboardEntryResponse(
                rank=rank,
                user_id=uid,
                username=row.username,
                full_name=row.full_name,
                avatar_url=row.avatar_url,
                total_xp=total_xp,
                level=_calc_level(total_xp),
                total_coins=0,
                quests_completed=quests_map.get(uid, 0),
                badges_count=badges_map.get(uid, 0),
                department=row.department,
                project_name=row.project_name,
                position=row.position,
            )
        )

    return LeaderboardResponse(
        period=period,
        entries=entries,
        total_players=len(entries),
        updated_at=datetime.now(timezone.utc),
    )
