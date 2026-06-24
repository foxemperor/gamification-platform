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
    """Обновление цветов персонажа. Все поля опциональны."""
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
    is_earned: bool = False

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

class QuestResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    xp_reward: int
    coin_reward: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


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
