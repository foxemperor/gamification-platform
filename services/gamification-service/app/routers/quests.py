"""
Gamification Service — роутер квестов
============================================
Эндпоинты: список, создание, принятие, завершение, профиль.
Автор: Dmitry Koval
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models import (
    Quest, UserQuest, Badge, UserBadge, XPTransaction,
    QuestStatus, UserQuestStatus, XPSource, BadgeRarity,
    xp_required_for_level,
)
from app.schemas import (
    QuestCreate, QuestUpdate, QuestResponse, QuestListResponse,
    UserQuestResponse, AcceptQuestResponse, CompleteQuestResponse,
    UserBadgeResponse, XPHistoryResponse, XPTransactionResponse,
    PlayerProfileResponse,
)

router = APIRouter(prefix="/api/v1", tags=["quests"])


# ===================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ===================================

async def _award_xp(
    db: AsyncSession,
    user_id: str,
    amount: int,
    source: XPSource,
    source_id: Optional[str] = None,
    description: Optional[str] = None,
) -> dict:
    """
    Начисляет XP пользователю и проверяет level up.
    Возвращает: {total_xp, level, level_up, new_level}
    """
    # Считаем текущий XP пользователя
    result = await db.execute(
        select(func.coalesce(func.sum(XPTransaction.amount), 0))
        .where(XPTransaction.user_id == user_id)
    )
    current_xp = result.scalar()

    # Сохраняем транзакцию
    tx = XPTransaction(
        user_id=user_id,
        amount=amount,
        source=source,
        source_id=source_id,
        description=description,
    )
    db.add(tx)

    new_xp = current_xp + amount

    # Вычисляем старый уровень
    old_level = 1
    xp_acc = 0
    while xp_acc + xp_required_for_level(old_level) <= current_xp:
        xp_acc += xp_required_for_level(old_level)
        old_level += 1

    # Вычисляем новый уровень
    new_level = 1
    xp_acc = 0
    while xp_acc + xp_required_for_level(new_level) <= new_xp:
        xp_acc += xp_required_for_level(new_level)
        new_level += 1

    return {
        "total_xp": new_xp,
        "level": new_level,
        "level_up": new_level > old_level,
        "new_level": new_level if new_level > old_level else None,
    }


async def _check_badges(db: AsyncSession, user_id: str) -> list[str]:
    """
    Проверяет и выдаёт бейджи если выполнены условия.
    Возвращает список названий полученных бейджей.
    """
    earned = []

    # Статистика пользователя
    completed_count = await db.scalar(
        select(func.count(UserQuest.id))
        .where(UserQuest.user_id == user_id)
        .where(UserQuest.status == UserQuestStatus.COMPLETED)
    )
    total_xp = await db.scalar(
        select(func.coalesce(func.sum(XPTransaction.amount), 0))
        .where(XPTransaction.user_id == user_id)
    )

    # Уже полученные бейджи
    existing = await db.execute(
        select(UserBadge.badge_id).where(UserBadge.user_id == user_id)
    )
    existing_ids = {row[0] for row in existing.all()}

    # Все доступные бейджи
    badges_result = await db.execute(select(Badge))
    badges = badges_result.scalars().all()

    for badge in badges:
        if badge.id in existing_ids:
            continue

        earned_flag = False
        if badge.condition_type == "quests_completed" and completed_count >= badge.condition_value:
            earned_flag = True
        elif badge.condition_type == "xp_reached" and total_xp >= badge.condition_value:
            earned_flag = True

        if earned_flag:
            ub = UserBadge(user_id=user_id, badge_id=badge.id)
            db.add(ub)
            earned.append(badge.name)
            # Бонус XP за бейдж
            if badge.xp_bonus > 0:
                await _award_xp(
                    db, user_id, badge.xp_bonus,
                    XPSource.BADGE, badge.id,
                    f"Бонус за бейдж '{badge.name}'",
                )

    return earned


# ===================================
# ГЕТ СПИСОК КВЕСТОВ
# ===================================

@router.get("/quests", response_model=QuestListResponse, summary="Список активных квестов")
async def list_quests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    quest_type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    q = select(Quest).where(Quest.status == QuestStatus.ACTIVE)
    if quest_type:
        q = q.where(Quest.quest_type == quest_type)
    if difficulty:
        q = q.where(Quest.difficulty == difficulty)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    quests_result = await db.execute(
        q.order_by(Quest.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    quests = quests_result.scalars().all()

    return QuestListResponse(
        items=[QuestResponse.model_validate(q) for q in quests],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, -(-total // per_page)),
    )


# ===================================
# СОЗДАТЬ КВЕСТ (АДМИН)
# ===================================

@router.post("/quests", response_model=QuestResponse, status_code=201, summary="Создать квест")
async def create_quest(
    data: QuestCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    quest = Quest(**data.model_dump(), created_by=user_id)
    db.add(quest)
    await db.commit()
    await db.refresh(quest)
    return QuestResponse.model_validate(quest)


# ===================================
# ДЕТАЛИ КВЕСТА
# ===================================

@router.get("/quests/{quest_id}", response_model=QuestResponse, summary="Детали квеста")
async def get_quest(
    quest_id: str,
    db: AsyncSession = Depends(get_db),
):
    quest = await db.get(Quest, quest_id)
    if not quest or quest.status == QuestStatus.ARCHIVED:
        raise HTTPException(status_code=404, detail="Квест не найден")
    return QuestResponse.model_validate(quest)


# ===================================
# ПРИНЯТЬ КВЕСТ
# ===================================

@router.post("/quests/{quest_id}/accept", response_model=AcceptQuestResponse, status_code=201, summary="Принять квест")
async def accept_quest(
    quest_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    quest = await db.get(Quest, quest_id)
    if not quest or quest.status != QuestStatus.ACTIVE:
        raise HTTPException(status_code=404, detail="Квест недоступен")

    # Проверяем не взял ли уже
    existing = await db.scalar(
        select(UserQuest)
        .where(UserQuest.user_id == user_id)
        .where(UserQuest.quest_id == quest_id)
        .where(UserQuest.status == UserQuestStatus.IN_PROGRESS)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Квест уже в процессе")

    deadline = None
    if quest.time_limit_hours:
        deadline = datetime.now(timezone.utc) + timedelta(hours=quest.time_limit_hours)

    uq = UserQuest(
        user_id=user_id,
        quest_id=quest_id,
        target=quest.integration_target or 1,
        deadline_at=deadline,
    )
    db.add(uq)
    await db.commit()
    await db.refresh(uq)

    return AcceptQuestResponse(
        user_quest_id=uq.id,
        quest_id=quest_id,
        message=f"Квест '{quest.title}' принят!",
        deadline_at=deadline,
    )


# ===================================
# ЗАВЕРШИТЬ КВЕСТ
# ===================================

@router.post("/quests/{quest_id}/complete", response_model=CompleteQuestResponse, summary="Завершить квест")
async def complete_quest(
    quest_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Ищем прогресс пользователя
    uq = await db.scalar(
        select(UserQuest)
        .where(UserQuest.user_id == user_id)
        .where(UserQuest.quest_id == quest_id)
        .where(UserQuest.status == UserQuestStatus.IN_PROGRESS)
        .options(selectinload(UserQuest.quest))
    )
    if not uq:
        raise HTTPException(status_code=404, detail="Активный квест не найден")

    # Проверяем дедлайн
    if uq.deadline_at and datetime.now(timezone.utc) > uq.deadline_at:
        uq.status = UserQuestStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=400, detail="Время квеста истекло")

    # Отмечаем как выполненный
    uq.status = UserQuestStatus.COMPLETED
    uq.progress = uq.target
    uq.completed_at = datetime.now(timezone.utc)

    quest = uq.quest

    # Начисляем XP
    xp_result = await _award_xp(
        db, user_id, quest.xp_reward,
        XPSource.QUEST, quest.id,
        f"Квест: {quest.title}",
    )

    # Проверяем бейджи
    badges = await _check_badges(db, user_id)

    await db.commit()

    msg = f"Квест '{quest.title}' выполнен! +{quest.xp_reward} XP"
    if xp_result["level_up"]:
        msg += f" 🎉 Новый уровень: {xp_result['new_level']}!"

    return CompleteQuestResponse(
        user_quest_id=uq.id,
        quest_title=quest.title,
        xp_earned=quest.xp_reward,
        coins_earned=quest.coins_reward,
        new_level=xp_result["new_level"],
        level_up=xp_result["level_up"],
        badges_earned=badges,
        message=msg,
    )


# ===================================
# МОИ КВЕСТЫ
# ===================================

@router.get("/quests/my", response_model=list[UserQuestResponse], summary="Мои квесты")
async def my_quests(
    status: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(UserQuest)
        .where(UserQuest.user_id == user_id)
        .options(selectinload(UserQuest.quest))
        .order_by(UserQuest.started_at.desc())
    )
    if status:
        q = q.where(UserQuest.status == status)

    result = await db.execute(q)
    uqs = result.scalars().all()
    return [UserQuestResponse.model_validate(uq) for uq in uqs]


# ===================================
# МОИ БЕЙДЖИ
# ===================================

@router.get("/badges/my", response_model=list[UserBadgeResponse], summary="Мои бейджи")
async def my_badges(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserBadge)
        .where(UserBadge.user_id == user_id)
        .options(selectinload(UserBadge.badge))
        .order_by(UserBadge.earned_at.desc())
    )
    return [UserBadgeResponse.model_validate(ub) for ub in result.scalars().all()]


# ===================================
# ИСТОРИЯ XP
# ===================================

@router.get("/xp/history", response_model=XPHistoryResponse, summary="История XP")
async def xp_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total = await db.scalar(
        select(func.count(XPTransaction.id)).where(XPTransaction.user_id == user_id)
    )
    total_earned = await db.scalar(
        select(func.coalesce(func.sum(XPTransaction.amount), 0))
        .where(XPTransaction.user_id == user_id)
        .where(XPTransaction.amount > 0)
    )
    total_spent = await db.scalar(
        select(func.coalesce(func.sum(XPTransaction.amount), 0))
        .where(XPTransaction.user_id == user_id)
        .where(XPTransaction.amount < 0)
    )
    result = await db.execute(
        select(XPTransaction)
        .where(XPTransaction.user_id == user_id)
        .order_by(XPTransaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    txs = result.scalars().all()

    return XPHistoryResponse(
        items=[XPTransactionResponse.model_validate(tx) for tx in txs],
        total=total,
        total_xp_earned=total_earned or 0,
        total_xp_spent=abs(total_spent or 0),
        page=page,
        per_page=per_page,
    )


# ===================================
# ПРОФИЛЬ ИГРОКА
# ===================================

@router.get("/profile/{user_id}", response_model=PlayerProfileResponse, summary="Профиль игрока")
async def player_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    total_xp = await db.scalar(
        select(func.coalesce(func.sum(XPTransaction.amount), 0))
        .where(XPTransaction.user_id == user_id)
    ) or 0

    quests_completed = await db.scalar(
        select(func.count(UserQuest.id))
        .where(UserQuest.user_id == user_id)
        .where(UserQuest.status == UserQuestStatus.COMPLETED)
    ) or 0

    quests_in_progress = await db.scalar(
        select(func.count(UserQuest.id))
        .where(UserQuest.user_id == user_id)
        .where(UserQuest.status == UserQuestStatus.IN_PROGRESS)
    ) or 0

    badges_count = await db.scalar(
        select(func.count(UserBadge.id))
        .where(UserBadge.user_id == user_id)
    ) or 0

    # Вычисляем уровень
    level = 1
    xp_acc = 0
    while xp_acc + xp_required_for_level(level) <= total_xp:
        xp_acc += xp_required_for_level(level)
        level += 1

    xp_in_level = total_xp - xp_acc
    xp_for_next = xp_required_for_level(level)
    progress_pct = round((xp_in_level / xp_for_next) * 100, 1) if xp_for_next > 0 else 0.0

    return PlayerProfileResponse(
        user_id=user_id,
        username="",  # будет заполнено через Auth Service
        full_name=None,
        total_xp=total_xp,
        level=level,
        xp_to_next_level=xp_for_next - xp_in_level,
        xp_progress_percent=progress_pct,
        total_coins=0,  # будет добавлено в coins-сервисе
        quests_completed=quests_completed,
        quests_in_progress=quests_in_progress,
        badges_count=badges_count,
    )
