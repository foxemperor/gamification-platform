"""
Gamification Service — Pydantic схемы
======================================
Валидация запросов и сериализация ответов.
Автор: Dmitry Koval
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

from app.models import (
    QuestType, QuestDifficulty, QuestStatus,
    UserQuestStatus, XPSource, BadgeRarity,
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
    new_level: Optional[int] = None       # Если был level up
    level_up: bool = False
    badges_earned: list[str] = []         # Названия новых бейджей
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
# СХЕМЫ ПРОФИЛЯ ИГРОКА
# ===================================

class PlayerProfileResponse(BaseModel):
    """Игровой профиль пользователя."""
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
    period: str   # "weekly", "monthly", "all_time"
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
