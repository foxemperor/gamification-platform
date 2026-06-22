"""
Gamification Service — эндпоинты уведомлений
======================================================
Возвращает количество непрочитанных квестов/бейджей для сайдбара,
и позволяет отмечать их как прочитанные.

Непрочитанными считаются:
  - UserQuest с status=in_progress, назначенный но ещё не просмотренный пользователем
  - UserBadge с is_new=True (новый бейдж, не подтверждённый)

Автор: Dmitry Koval
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models import UserBadge, UserQuest, UserQuestStatus

router = APIRouter(prefix="/api/v1/me/notifications", tags=["notifications"])


@router.get("/unread-counts", summary="Количество непрочитанных квестов и бейджей")
async def unread_counts(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает числа непрочитанных квестов (назначенных без просмотра)
    и новых достижений (бейджи с is_new=True).
    Используется Sidebar для отображения badge-счётчиков.
    """
    # Квесты: in_progress и непросмотренные (is_viewed=False)
    unread_quests = await db.scalar(
        select(func.count(UserQuest.id))
        .where(
            UserQuest.user_id == user_id,
            UserQuest.is_viewed == False,  # noqa: E712
            UserQuest.status == UserQuestStatus.IN_PROGRESS,
        )
    ) or 0

    # Бейджи: новые (is_new=True) и не отозванные (is_revoked=False)
    unread_badges = await db.scalar(
        select(func.count(UserBadge.id))
        .where(
            UserBadge.user_id == user_id,
            UserBadge.is_new == True,  # noqa: E712
            UserBadge.is_revoked == False,  # noqa: E712
        )
    ) or 0

    return {"unread_quests": int(unread_quests), "unread_badges": int(unread_badges)}


@router.patch("/mark-viewed", summary="Отметить всё как прочитанное")
async def mark_all_viewed(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Сбрасывает все непрочитанные уведомления для текущего пользователя.
    Вызывается при заходе на страницу /quests или /achievements.
    """
    await db.execute(
        update(UserQuest)
        .where(UserQuest.user_id == user_id, UserQuest.is_viewed == False)  # noqa: E712
        .values(is_viewed=True)
    )
    await db.execute(
        update(UserBadge)
        .where(UserBadge.user_id == user_id, UserBadge.is_new == True)  # noqa: E712
        .values(is_new=False)
    )
    await db.commit()
    return {"ok": True}


@router.patch("/mark-quests-viewed", summary="Отметить квесты прочитанными")
async def mark_quests_viewed(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(UserQuest)
        .where(UserQuest.user_id == user_id, UserQuest.is_viewed == False)  # noqa: E712
        .values(is_viewed=True)
    )
    await db.commit()
    return {"ok": True}


@router.patch("/mark-badges-viewed", summary="Отметить бейджи прочитанными")
async def mark_badges_viewed(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(UserBadge)
        .where(UserBadge.user_id == user_id, UserBadge.is_new == True)  # noqa: E712
        .values(is_new=False)
    )
    await db.commit()
    return {"ok": True}
