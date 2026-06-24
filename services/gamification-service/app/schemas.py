"""
Pydantic-схемы Gamification Service.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, List

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Персонаж
# ──────────────────────────────────────────────

class CharacterTypeResponse(BaseModel):
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    coin_multiplier_base: float
    xp_multiplier_base: float
    bonus_description: Optional[str] = None

    model_config = {"from_attributes": True}


class CharacterEquipmentItemResponse(BaseModel):
    id: str
    slot: str
    color: Optional[str] = None
    equipped_at: datetime
    cosmetic_item: "CosmeticItemResponse"

    model_config = {"from_attributes": True}


class CharacterResponse(BaseModel):
    id: str
    user_id: str
    level: int
    experience: int
    coin_multiplier: float
    xp_multiplier: float
    skin_color: Optional[str] = None
    hair_color: Optional[str] = None
    eyes_color: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    character_type: CharacterTypeResponse
    equipment: List[CharacterEquipmentItemResponse] = []

    model_config = {"from_attributes": True}


class CharacterCreateRequest(BaseModel):
    character_type_slug: str
    skin_color: Optional[str] = Field(default="#F5C5A3")
    hair_color: Optional[str] = Field(default="#2C1810")
    eyes_color: Optional[str] = Field(default="#4A90D9")


class CharacterColorsRequest(BaseModel):
    """\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0446\u0432\u0435\u0442\u043e\u0432 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0430. \u0412\u0441\u0435 \u043f\u043e\u043b\u044f \u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u044b."""
    skin_color: Optional[str] = None
    hair_color: Optional[str] = None
    eyes_color: Optional[str] = None


class CharacterEquipRequest(BaseModel):
    slot: str
    cosmetic_item_id: Optional[str] = None
    color: Optional[str] = None


# ──────────────────────────────────────────────
# Косметика
# ──────────────────────────────────────────────

class CosmeticItemResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    preview_url: Optional[str] = None
    slot: str
    rarity: str

    model_config = {"from_attributes": True}


class UnlockedCosmeticResponse(BaseModel):
    id: str
    user_id: str
    cosmetic_item_id: str
    unlocked_at: datetime
    cosmetic_item: CosmeticItemResponse

    model_config = {"from_attributes": True}


class CosmeticCatalogItemResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    preview_url: Optional[str] = None
    slot: str
    rarity: str
    visibility: str
    unlock_type: str
    unlock_value: Optional[int] = None
    allowed_character_types: Optional[List[str]] = None
    is_unlocked: bool
    is_equipped: bool
    unlock_requirement: Optional[str] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Ачивменты / Бейджи
# ──────────────────────────────────────────────

class BadgeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    rarity: Optional[str] = None
    condition_type: Optional[str] = None
    condition_value: Optional[int] = None
    xp_bonus: int = 0
    is_earned: bool = False

    model_config = {"from_attributes": True}


class UserBadgeResponse(BaseModel):
    id: str
    user_id: str
    badge_id: str
    earned_at: datetime
    is_new: bool = True
    is_revoked: bool = False
    badge: BadgeResponse

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Профиль игрока
# ──────────────────────────────────────────────

class PlayerProfileResponse(BaseModel):
    user_id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

    total_xp: int
    level: int
    xp_to_next_level: int
    xp_progress_percent: float
    total_coins: int

    quests_completed: int
    quests_in_progress: int
    badges_count: int

    rank_all_time: Optional[int] = None
    rank_weekly: Optional[int] = None
    streak_days: Optional[int] = None
    position: Optional[str] = None

    character: Optional[CharacterResponse] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Квесты
# ──────────────────────────────────────────────

class QuestCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    quest_type: str = Field(default="personal")
    difficulty: str = Field(default="medium")
    xp_reward: int = Field(default=150, ge=0)
    coins_reward: int = Field(default=10, ge=0)
    time_limit_hours: Optional[int] = None
    integration_trigger: Optional[str] = None
    integration_target: Optional[int] = None


class QuestUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    quest_type: Optional[str] = None
    difficulty: Optional[str] = None
    status: Optional[str] = None
    xp_reward: Optional[int] = Field(None, ge=0)
    coins_reward: Optional[int] = Field(None, ge=0)
    time_limit_hours: Optional[int] = None
    integration_trigger: Optional[str] = None
    integration_target: Optional[int] = None


class QuestResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    quest_type: str
    difficulty: str
    status: str
    xp_reward: int
    coins_reward: int
    time_limit_hours: Optional[int] = None
    integration_trigger: Optional[str] = None
    integration_target: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestListResponse(BaseModel):
    items: List[QuestResponse]
    total: int
    page: int
    per_page: int
    pages: int


class UserQuestResponse(BaseModel):
    id: str
    user_id: str
    quest_id: str
    status: str
    progress: int
    target: int
    is_viewed: bool
    started_at: datetime
    completed_at: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    quest: QuestResponse

    model_config = {"from_attributes": True}


class AcceptQuestResponse(BaseModel):
    user_quest_id: str
    quest_id: str
    message: str
    deadline_at: Optional[datetime] = None


class CompleteQuestResponse(BaseModel):
    user_quest_id: str
    quest_title: str
    xp_earned: int
    coins_earned: int
    new_level: Optional[int] = None
    level_up: bool
    badges_earned: List[str] = []
    message: str


# ──────────────────────────────────────────────
# XP-история
# ──────────────────────────────────────────────

class XPTransactionResponse(BaseModel):
    id: str
    user_id: str
    amount: int
    source: str
    source_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class XPHistoryResponse(BaseModel):
    items: List[XPTransactionResponse]
    total: int
    total_xp_earned: int
    total_xp_spent: int
    page: int
    per_page: int


# ──────────────────────────────────────────────
# Таблица лидеров
# ──────────────────────────────────────────────

class LeaderboardEntryResponse(BaseModel):
    rank: int
    user_id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    total_xp: int
    level: int
    total_coins: int
    character: Optional[CharacterResponse] = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Члены команды
# ──────────────────────────────────────────────

class MemberResponse(BaseModel):
    user_id: str
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    birthday: Optional[str] = None
    total_xp: int
    level: int
    total_coins: int
    rank: Optional[int] = None
    streak_days: Optional[int] = None
    position: Optional[str] = None
    character: Optional[CharacterResponse] = None

    model_config = {"from_attributes": True}
