"""
Gamification Service — роутер квестов
============================================
Эндпойнты: список, создание, принятие, завершение, профиль.
Автор: Dmitry Koval
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user_id, require_admin
from app.models import (
    Quest, UserQuest, Badge, UserBadge, XPTransaction, CoinTransaction,
    QuestStatus, UserQuestStatus, XPSource, CoinSource, BadgeRarity,
    xp_required_for_level, Character, CharacterEquipment, CharacterType,
)
from app.schemas import (
    QuestCreate, QuestUpdate, QuestResponse, QuestListResponse,
    UserQuestResponse, AcceptQuestResponse, CompleteQuestResponse,
    UserBadgeResponse, XPHistoryResponse, XPTransactionResponse,
    PlayerProfileResponse, CharacterResponse,
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
    result = await db.execute(
        select(func.coalesce(func.sum(XPTransaction.amount), 0))
        .where(XPTransaction.user_id == user_id)
    )
    current_xp = result.scalar()

    tx = XPTransaction(
        user_id=user_id,
        amount=amount,
        source=source,
        source_id=source_id,
        description=description,
    )
    db.add(tx)

    new_xp = current_xp + amount

    old_level = 1
    xp_acc = 0
    while xp_acc + xp_required_for_level(old_level) <= current_xp:
        xp_acc += xp_required_for_level(old_level)
        old_level += 1

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


async def _award_coins(
    db: AsyncSession,
    user_id: str,
    amount: int,
    source: CoinSource,
    source_id: Optional[str] = None,
    description: Optional[str] = None,
) -> int:
    """
    Записывает CoinTransaction для audit-лога.
    Баланс монет хранится в auth-service; обновление там происходит
    через PUT /internal/users/{user_id}/coins, который вызывает auth-service.
    Здесь мы только записываем в локальную историю.
    Возвращает новый суммарный баланс по локальным записям.
    """
    tx = CoinTransaction(
        user_id=user_id,
        amount=amount,
        source=source,
        source_id=source_id,
        description=description,
    )
    db.add(tx)

    total = await db.scalar(
        select(func.coalesce(func.sum(CoinTransaction.amount), 0))
        .where(CoinTransaction.user_id == user_id)
    )
    return (total or 0) + amount


async def _check_badges(db: AsyncSession, user_id: str) -> list[str]:
    """
    Проверяет и выдаёт бейджи если выполнены условия.
    Возвращает список названий полученных бейджей.
    """
    earned = []

    completed_count = await db.scalar(
        select(func.count(UserQuest.id))
        .where(UserQuest.user_id == user_id)
        .where(UserQuest.status == UserQuestStatus.COMPLETED)
    )
    total_xp = await db.scalar(
        select(func.coalesce(func.sum(XPTransaction.amount), 0))
        .where(XPTransaction.user_id == user_id)
    )

    existing = await db.execute(
        select(UserBadge.badge_id).where(UserBadge.user_id == user_id)
    )
    existing_ids = {row[0] for row in existing.all()}

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
            if badge.xp_bonus > 0:
                await _award_xp(
                    db, user_id, badge.xp_bonus,
                    XPSource.BADGE, badge.id,
                    f"Бонус за бейдж '{badge.name}'",
                )

    return earned


# ===================================
# СПИСОК КВЕСТОВ
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
# СОЗДАТЬ КВЕСТ (АДМИН)
# ===================================

@router.post("/quests", response_model=QuestResponse, status_code=201, summary="Создать квест (только админ)")
async def create_quest(
    data: QuestCreate,
    admin_id: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    created_by = admin_id if admin_id != "gateway" else None
    quest = Quest(**data.model_dump(), created_by=created_by)
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

    existing = await db.scalar(
        select(UserQuest)
        .where(UserQuest.user_id == user_id)
        .where(UserQuest.quest_id == quest_id)
    )
    if existing:
        if existing.status == UserQuestStatus.IN_PROGRESS:
            raise HTTPException(status_code=409, detail="Квест уже в процессе")
        deadline = None
        if quest.time_limit_hours:
            deadline = datetime.now(timezone.utc) + timedelta(hours=quest.time_limit_hours)
        existing.status = UserQuestStatus.IN_PROGRESS
        existing.progress = 0
        existing.completed_at = None
        existing.deadline_at = deadline
        existing.started_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing)
        return AcceptQuestResponse(
            user_quest_id=existing.id,
            quest_id=quest_id,
            message=f"Квест '{quest.title}' принят повторно!",
            deadline_at=deadline,
        )

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
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Квест уже в процессе")
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
    uq = await db.scalar(
        select(UserQuest)
        .where(UserQuest.user_id == user_id)
        .where(UserQuest.quest_id == quest_id)
        .where(UserQuest.status == UserQuestStatus.IN_PROGRESS)
        .options(selectinload(UserQuest.quest))
    )
    if not uq:
        raise HTTPException(status_code=404, detail="Активный квест не найден")

    if uq.deadline_at and datetime.now(timezone.utc) > uq.deadline_at:
        uq.status = UserQuestStatus.FAILED
        await db.commit()
        raise HTTPException(status_code=400, detail="Время квеста истекло")

    uq.status = UserQuestStatus.COMPLETED
    uq.progress = uq.target
    uq.completed_at = datetime.now(timezone.utc)

    quest = uq.quest

    xp_result = await _award_xp(
        db, user_id, quest.xp_reward,
        XPSource.QUEST, quest.id,
        f"Квест: {quest.title}",
    )

    # Начисляем монеты если квест даёт награду
    coins_earned = 0
    if quest.coins_reward > 0:
        coins_earned = quest.coins_reward
        await _award_coins(
            db, user_id, quest.coins_reward,
            CoinSource.QUEST, quest.id,
            f"Квест: {quest.title}",
        )

    badges = await _check_badges(db, user_id)

    await db.commit()

    msg = f"Квест '{quest.title}' выполнен! +{quest.xp_reward} XP"
    if coins_earned:
        msg += f" +{coins_earned} монет"
    if xp_result["level_up"]:
        msg += f" 🎉 Новый уровень: {xp_result['new_level']}!"

    return CompleteQuestResponse(
        user_quest_id=uq.id,
        quest_title=quest.title,
        xp_earned=quest.xp_reward,
        coins_earned=coins_earned,
        new_level=xp_result["new_level"],
        level_up=xp_result["level_up"],
        badges_earned=badges,
        message=msg,
    )


# ===================================
# RETROACTIVE ПЕРЕСЧИТАТЬ НАГРАДЫ (АДМИН)
# ===================================

from pydantic import BaseModel

class RecalculateRequest(BaseModel):
    user_id: Optional[str] = None  # None = пересчитать для всех

class RecalculateResult(BaseModel):
    user_id: str
    quests_processed: int
    xp_awarded: int
    coins_awarded: int
    badges_earned: list[str]

class RecalculateResponse(BaseModel):
    results: list[RecalculateResult]
    total_users: int
    total_xp_awarded: int
    total_coins_awarded: int


@router.post(
    "/rewards/recalculate",
    response_model=RecalculateResponse,
    summary="Retroactive: начислить XP/монеты/достижения за уже пройденные квесты (админ)",
)
async def recalculate_rewards(
    body: RecalculateRequest,
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Пересчитывает все COMPLETED квесты для одного пользователя (user_id)
    или для всех пользователей (user_id=null).

    Логика идемпотентности:
    - если XPTransaction с source=QUEST и source_id=quest_id уже есть — XP не начисляем
    - если CoinTransaction с source=QUEST и source_id=quest_id уже есть — монеты не начисляем
    - бейджи проверяются после начисления всех наград
    """
    # Собираем user_ids для обработки
    uq_query = (
        select(UserQuest)
        .where(UserQuest.status == UserQuestStatus.COMPLETED)
        .options(selectinload(UserQuest.quest))
        .order_by(UserQuest.completed_at)
    )
    if body.user_id:
        uq_query = uq_query.where(UserQuest.user_id == body.user_id)

    result = await db.execute(uq_query)
    completed_uqs = result.scalars().all()

    # Группируем по пользователю
    from collections import defaultdict
    by_user: dict[str, list[UserQuest]] = defaultdict(list)
    for uq in completed_uqs:
        by_user[uq.user_id].append(uq)

    results: list[RecalculateResult] = []
    total_xp = 0
    total_coins = 0

    for uid, uqs in by_user.items():
        user_xp = 0
        user_coins = 0
        user_quests_processed = 0

        # Получаем уже начисленные XP source_id’с для этого пользователя
        xp_done = await db.execute(
            select(XPTransaction.source_id)
            .where(XPTransaction.user_id == uid)
            .where(XPTransaction.source == XPSource.QUEST)
        )
        xp_done_ids = {r[0] for r in xp_done.all()}

        coin_done = await db.execute(
            select(CoinTransaction.source_id)
            .where(CoinTransaction.user_id == uid)
            .where(CoinTransaction.source == CoinSource.QUEST)
        )
        coin_done_ids = {r[0] for r in coin_done.all()}

        for uq in uqs:
            quest = uq.quest
            if quest is None:
                continue

            awarded_something = False

            # XP — если ещё не начисляли
            if quest.id not in xp_done_ids and quest.xp_reward > 0:
                await _award_xp(
                    db, uid, quest.xp_reward,
                    XPSource.QUEST, quest.id,
                    f"[retro] Квест: {quest.title}",
                )
                user_xp += quest.xp_reward
                awarded_something = True

            # Монеты — если ещё не начисляли
            if quest.id not in coin_done_ids and quest.coins_reward > 0:
                await _award_coins(
                    db, uid, quest.coins_reward,
                    CoinSource.QUEST, quest.id,
                    f"[retro] Квест: {quest.title}",
                )
                user_coins += quest.coins_reward
                awarded_something = True

            if awarded_something:
                user_quests_processed += 1

        # Перепроверяем бейджи после всех начислений
        badges = await _check_badges(db, uid)

        results.append(RecalculateResult(
            user_id=uid,
            quests_processed=user_quests_processed,
            xp_awarded=user_xp,
            coins_awarded=user_coins,
            badges_earned=badges,
        ))
        total_xp += user_xp
        total_coins += user_coins

    await db.commit()

    return RecalculateResponse(
        results=results,
        total_users=len(results),
        total_xp_awarded=total_xp,
        total_coins_awarded=total_coins,
    )


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
    username: Optional[str] = Query(None, description="Логин пользователя из клиента / API Gateway"),
    db: AsyncSession = Depends(get_db),
):
    total_xp = await db.scalar(
        select(func.coalesce(func.sum(XPTransaction.amount), 0))
        .where(XPTransaction.user_id == user_id)
    ) or 0

    # ─────────────────────────────────────────────────────────────
    # Данные учётной записи берём напрямую из таблицы auth.users
    # auth-service. Auth- и gamification-сервисы делят одну физическую
    # БД gamification_db, но в разных схемах: auth-service кладёт свои
    # таблицы в схему "auth" (см. auth-service/app/database.py:DB_SCHEMA),
    # а gamification-service — в схему "gamification".
    # Так монеты, имя и аватар — единый источник истины с сайдбаром,
    # без рассинхрона.
    # ─────────────────────────────────────────────────────────────
    account = (await db.execute(
        text(
            "SELECT full_name, username, coins, avatar_url "
            "FROM auth.users WHERE id = :uid"
        ),
        {"uid": user_id},
    )).mappings().first()

    account_full_name: Optional[str] = account["full_name"] if account else None
    account_username: Optional[str] = account["username"] if account else None
    # Баланс монет — авторитетный из users.coins (тот же, что в сайдбаре).
    total_coins = (account["coins"] if account else 0) or 0
    account_avatar_url: Optional[str] = account["avatar_url"] if account else None

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

    level = 1
    xp_acc = 0
    while xp_acc + xp_required_for_level(level) <= total_xp:
        xp_acc += xp_required_for_level(level)
        level += 1

    xp_in_level = total_xp - xp_acc
    xp_for_next = xp_required_for_level(level)
    progress_pct = round((xp_in_level / xp_for_next) * 100, 1) if xp_for_next > 0 else 0.0

    character_result = await db.execute(
        select(Character)
        .options(
            selectinload(Character.character_type),
            selectinload(Character.equipment).selectinload(CharacterEquipment.cosmetic_item),
        )
        .where(Character.user_id == user_id)
    )
    character_obj = character_result.scalar_one_or_none()
    character_response: Optional[CharacterResponse] = (
        CharacterResponse.model_validate(character_obj) if character_obj else None
    )

    return PlayerProfileResponse(
        user_id=user_id,
        username=account_username or username or "",
        full_name=account_full_name,
        avatar_url=account_avatar_url,
        total_xp=total_xp,
        level=level,
        xp_to_next_level=xp_for_next - xp_in_level,
        xp_progress_percent=progress_pct,
        total_coins=total_coins,
        quests_completed=quests_completed,
        quests_in_progress=quests_in_progress,
        badges_count=badges_count,
        streak_days=0,
        position=None,
        character=character_response,
    )
