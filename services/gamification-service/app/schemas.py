"""
Gamification Service — Pydantic схемы
======================================
Валидация запросов и сериализация ответов.
Автор: Dmitry Koval
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.models import (
    QuestType, QuestDifficulty, QuestStatus,
    UserQuestStatus, XPSource, BadgeRarity,
    CharacterTypeSlug, CosmeticSlot, CosmeticVisibility, UnlockType,
)


# ===================================
# БАЗОВЫЕ МИКСИНЫ
# ===================================

class OrmBase(BaseModel):
    """Базовый класс с поддержкой ORM-объектов."""
    model_config = ConfigDict(from_attributes=True)


# ===================================
# СХЕМЫ КВЕСТОВ
# ===================================

class QuestCreate(BaseModel):
    """Создание нового квеста (только для администраторов)."""
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    quest_type: QuestType = QuestType.PERSONAL
    difficulty: QuestDifficulty = QuestDifficulty.MEDIUM
    xp_reward: int = Field(150, ge=1, le=10000)
    coins_reward: int = Field(10, ge=0, le=1000)
    time_limit_hours: Optional[int] = Field(None, ge=1, le=720)
    integration_trigger: Optional[str] = Field(None, max_length=100)
    integration_target: Optional[int] = Field(None, ge=1)


class QuestUpdate(BaseModel):
    """Частичное обновление квеста."""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[QuestStatus] = None
    xp_reward: Optional[int] = Field(None, ge=1, le=10000)
    coins_reward: Optional[int] = Field(None, ge=0, le=1000)
    time_limit_hours: Optional[int] = Field(None, ge=1, le=720)


class QuestResponse(OrmBase):
    """Полный ответ с данными квеста."""
    id: str
    title: str
    description: Optional[str]
    quest_type: QuestType
    difficulty: QuestDifficulty
    status: QuestStatus
    xp_reward: int
    coins_reward: int
    time_limit_hours: Optional[int]
    integration_trigger: Optional[str]
    integration_target: Optional[int]
    created_at: datetime


class QuestListResponse(BaseModel):
    """Список квестов с пагинацией."""
    items: list[QuestResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ===================================
# СХЕМЫ ПРОГРЕССА ПО КВЕСТАМ
# ===================================

class UserQuestResponse(OrmBase):
    """Прогресс пользователя по квесту."""
    id: str
    user_id: str
    quest_id: str
    status: UserQuestStatus
    progress: int
    target: int
    progress_percent: float = 0.0
    started_at: datetime
    completed_at: Optional[datetime]
    deadline_at: Optional[datetime]
    quest: QuestResponse

    @field_validator("progress_percent", mode="before")
    @classmethod
    def calc_progress(cls, v, info):
        """Вычисляем процент прогресса на лету."""
        data = info.data
        progress = data.get("progress", 0)
        target = data.get("target", 1)
        if target > 0:
            return round((progress / target) * 100, 1)
        return 0.0


class AcceptQuestResponse(BaseModel):
    """Ответ на принятие квеста."""
    user_quest_id: str
    quest_id: str
    message: str
    deadline_at: Optional[datetime]


class CompleteQuestResponse(BaseModel):
    """Ответ на завершение квеста с наградами."""
    user_quest_id: str
    quest_title: str
    xp_earned: int
    coins_earned: int
    new_level: Optional[int] = None
    level_up: bool = False
    badges_earned: list[str] = []
    message: str


# ===================================
# СХЕМЫ БЕЙДЖЕЙ
# ===================================

class BadgeResponse(OrmBase):
    """Бейдж с метаданными."""
    id: str
    name: str
    description: Optional[str]
    icon_url: Optional[str]
    rarity: BadgeRarity
    condition_type: Optional[str]
    condition_value: Optional[int]
    xp_bonus: int
    created_at: datetime


class UserBadgeResponse(OrmBase):
    """Бейдж пользователя с датой получения."""
    id: str
    user_id: str
    earned_at: datetime
    is_new: bool
    badge: BadgeResponse


# ===================================
# СХЕМЫ XP ТРАНЗАКЦИЙ
# ===================================

class XPTransactionResponse(OrmBase):
    """Одна запись в журнале XP."""
    id: str
    user_id: str
    amount: int
    source: XPSource
    source_id: Optional[str]
    description: Optional[str]
    created_at: datetime


class XPHistoryResponse(BaseModel):
    """История XP пользователя с пагинацией."""
    items: list[XPTransactionResponse]
    total: int
    total_xp_earned: int
    total_xp_spent: int
    page: int
    per_page: int


# ===================================
# СХЕМЫ ПЕРСОНАЖЕЙ
# ===================================

class CharacterTypeResponse(OrmBase):
    """Архетип персонажа."""
    id: str
    slug: CharacterTypeSlug
    name: str
    description: Optional[str]
    icon_url: Optional[str]
    coin_multiplier_base: float
    xp_multiplier_base: float
    bonus_description: Optional[str]


class CosmeticItemResponse(OrmBase):
    """Косметический предмет."""
    id: str
    name: str
    slug: str
    description: Optional[str]
    preview_url: Optional[str]
    slot: CosmeticSlot
    rarity: BadgeRarity
    visibility: CosmeticVisibility
    unlock_type: UnlockType
    unlock_value: Optional[int]
    allowed_character_types: Optional[list]


class CharacterEquipmentResponse(OrmBase):
    """Надетый предмет."""
    id: str
    slot: CosmeticSlot
    color: Optional[str]
    equipped_at: datetime
    cosmetic_item: CosmeticItemResponse


class CharacterResponse(OrmBase):
    """Полный персонаж пользователя."""
    id: str
    user_id: str
    level: int
    experience: int
    coin_multiplier: float
    xp_multiplier: float
    skin_color: Optional[str]
    hair_color: Optional[str]
    eyes_color: Optional[str]
    created_at: datetime
    updated_at: datetime
    character_type: CharacterTypeResponse
    equipment: List[CharacterEquipmentResponse] = []


class UnlockedCosmeticResponse(OrmBase):
    """Разблокированная косметика пользователя."""
    id: str
    user_id: str
    unlocked_at: datetime
    cosmetic_item: CosmeticItemResponse


class CharacterCreateRequest(BaseModel):
    """Запрос на создание персонажа — выбор архетипа."""
    character_type_slug: CharacterTypeSlug
    skin_color: Optional[str] = Field("#F5C5A3", pattern=r"^#[0-9A-Fa-f]{6}$")
    hair_color: Optional[str] = Field("#2C1810", pattern=r"^#[0-9A-Fa-f]{6}$")
    eyes_color: Optional[str] = Field("#4A90D9", pattern=r"^#[0-9A-Fa-f]{6}$")


class CharacterEquipRequest(BaseModel):
    """Запрос на надевание/снятие предмета."""
    cosmetic_item_id: Optional[str] = Field(None, description="None = снять предмет со слота")
    slot: CosmeticSlot
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


# ===================================
# СХЕМЫ ПРОФИЛЯ ИГРОКА
# ===================================

class PlayerProfileResponse(BaseModel):
    """Игровой профиль пользователя.

    Прогрессия рассчитывается по формуле:
        xp_required_for_level(N) = BASE_XP_PER_LEVEL * N ^ XP_LEVEL_MULTIPLIER
                                 = 100 * N^1.5  (дефолтные значения из config.py)

    Фронтенд использует xp_to_next_level и xp_progress_percent напрямую —
    без дублирования формулы на клиенте.
    """
    user_id: str
    username: str
    full_name: Optional[str]

    # Прогрессия
    total_xp: int
    level: int
    xp_to_next_level: int
    xp_progress_percent: float
    total_coins: int

    # Статистика
    quests_completed: int
    quests_in_progress: int
    badges_count: int

    # Рейтинг
    rank_all_time: Optional[int] = None
    rank_weekly: Optional[int] = None

    # Персонаж — None если ещё не создан
    character: Optional[CharacterResponse] = None


# ===================================
# СХЕМЫ ЛИДЕРБОРДА
# ===================================

class LeaderboardEntryResponse(BaseModel):
    """Одна строка лидерборда."""
    rank: int
    user_id: str
    username: str
    full_name: Optional[str]
    total_xp: int
    level: int
    total_coins: int
    quests_completed: int
    badges_count: int


class LeaderboardResponse(BaseModel):
    """Лидерборд с метаданными периода."""
    period: str
    entries: list[LeaderboardEntryResponse]
    total_players: int
    updated_at: datetime


# ===================================
# ВНУТРЕННИЕ СХЕМЫ (для межсервисного взаимодействия)
# ===================================

class AwardXPRequest(BaseModel):
    """Запрос на начисление XP (от Integration Service)."""
    user_id: str
    amount: int = Field(..., ge=1, le=5000)
    source: XPSource
    source_id: Optional[str] = None
    description: Optional[str] = Field(None, max_length=300)

    @field_validator("user_id")
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        import uuid
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError("user_id должен быть валидным UUID")
        return v


class AwardXPResponse(BaseModel):
    """Ответ после начисления XP."""
    user_id: str
    xp_awarded: int
    new_total_xp: int
    new_level: int
    level_up: bool
    message: str


# ===================================
# АДМИНСКИЕ СХЕМЫ
# ===================================

class BadgeCreate(BaseModel):
    """Создание нового бейджа (только админ)."""
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    icon_url: Optional[str] = Field(None, max_length=500)
    rarity: BadgeRarity = BadgeRarity.COMMON
    condition_type: Optional[str] = Field(None, max_length=50)
    condition_value: Optional[int] = Field(None, ge=0)
    xp_bonus: int = Field(0, ge=0, le=10000)


class BadgeUpdate(BaseModel):
    """Частичное обновление бейджа."""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    icon_url: Optional[str] = Field(None, max_length=500)
    rarity: Optional[BadgeRarity] = None
    condition_type: Optional[str] = Field(None, max_length=50)
    condition_value: Optional[int] = Field(None, ge=0)
    xp_bonus: Optional[int] = Field(None, ge=0, le=10000)


class AdminGrantXPRequest(BaseModel):
    """Ручное начисление XP администратором."""
    user_id: str
    amount: int = Field(..., ge=1, le=50000)
    description: Optional[str] = Field(None, max_length=300)


class AdminRevokeXPRequest(BaseModel):
    """Ручное снятие XP администратором (штраф)."""
    user_id: str
    amount: int = Field(..., ge=1, le=50000)
    description: Optional[str] = Field(None, max_length=300)


class AdminUserStatsResponse(BaseModel):
    """Статистика пользователя для админ-панели."""
    user_id: str
    username: str
    total_xp: int
    level: int
    total_coins: int
    quests_completed: int
    badges_count: int
