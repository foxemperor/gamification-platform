"""
Gamification Service — SQLAlchemy модели
=========================================
Определяет структуру таблиц в схеме `gamification`.
Автор: Dmitry Koval
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship
from sqlalchemy import Enum as SAEnum

# Base и DB_SCHEMA импортируем из database.py —
# единый метадата-объект для всех моделей сервиса.
from app.database import Base, DB_SCHEMA
from app.config import settings


def _uuid() -> str:
    return str(uuid.uuid4())


# ===================================
# XP ФОРМУЛА ПРОГРЕССИИ (здесь, чтобы импорт из models работал)
# ===================================

def xp_required_for_level(level: int) -> int:
    """
    Возвращает количество XP, необходимое чтобы пройти `level`-ый уровень.

    Формула степенного закона (Power Law):
        XP(N) = BASE_XP_PER_LEVEL * N ^ XP_LEVEL_MULTIPLIER

    Значения по умолчанию (из config.py):
        BASE_XP_PER_LEVEL = 100
        XP_LEVEL_MULTIPLIER = 1.5

    Примеры:
        level 1 → 100 XP
        level 2 → 283 XP
        level 5 → 1118 XP
        level 10 → 3162 XP
    """
    return int(
        settings.BASE_XP_PER_LEVEL * (level ** settings.XP_LEVEL_MULTIPLIER)
    )


# ===================================
# ENUM-ТИПЫ
# ===================================

class QuestType(str, PyEnum):
    PERSONAL    = "personal"
    TEAM        = "team"
    DAILY       = "daily"
    SKILL       = "skill"
    INTEGRATION = "integration"


class QuestDifficulty(str, PyEnum):
    EASY   = "easy"
    MEDIUM = "medium"
    HARD   = "hard"
    EPIC   = "epic"


class QuestStatus(str, PyEnum):
    DRAFT    = "draft"
    ACTIVE   = "active"
    ARCHIVED = "archived"


class UserQuestStatus(str, PyEnum):
    IN_PROGRESS = "in_progress"
    COMPLETED   = "completed"
    FAILED      = "failed"
    ABANDONED   = "abandoned"


class XPSource(str, PyEnum):
    QUEST            = "quest"
    BADGE            = "badge"
    GITHUB_COMMIT    = "github_commit"
    GITHUB_PR        = "github_pr"
    JIRA_TASK        = "jira_task"
    ADMIN            = "admin"
    PENALTY          = "penalty"
    CHARACTER_LEVEL  = "character_level"


class BadgeRarity(str, PyEnum):
    COMMON    = "common"
    RARE      = "rare"
    EPIC      = "epic"
    LEGENDARY = "legendary"


# --- Персонаж-специфичные Enum ---

class CharacterTypeSlug(str, PyEnum):
    WARRIOR  = "warrior"
    MAGE     = "mage"
    ROGUE    = "rogue"
    ENGINEER = "engineer"


class CosmeticSlot(str, PyEnum):
    HAIR             = "hair"
    HEAD             = "head"
    HEAD_ACCESSORY   = "head_accessory"
    EYES             = "eyes"
    FACE_EXPRESSION  = "face_expression"
    TORSO            = "torso"
    TORSO_ACCESSORY  = "torso_accessory"
    LEGS             = "legs"
    WEAPON_MAIN      = "weapon_main"
    WEAPON_SECONDARY = "weapon_secondary"


class CosmeticVisibility(str, PyEnum):
    OPEN   = "open"
    LOCKED = "locked"
    HIDDEN = "hidden"


class UnlockType(str, PyEnum):
    NONE        = "none"
    QUEST       = "quest"
    ACHIEVEMENT = "achievement"
    LEVEL       = "level"
    ADMIN       = "admin"


# ===================================
# ВСПОМОГАТЕЛЬНЫЕ ФАБРИКИ SA ENUM
# create_type=False — тип уже создан миграцией
# ===================================

def _sa_enum(py_enum, name):
    return SAEnum(
        py_enum,
        name=name,
        schema=DB_SCHEMA,
        create_type=False,
    )


# ===================================
# КВЕСТЫ
# ===================================

class Quest(Base):
    __tablename__ = "quests"
    __table_args__ = {"schema": DB_SCHEMA}

    id          = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    quest_type  = Column(_sa_enum(QuestType, "questtype"), nullable=False, default=QuestType.PERSONAL)
    difficulty  = Column(_sa_enum(QuestDifficulty, "questdifficulty"), nullable=False, default=QuestDifficulty.MEDIUM)
    status      = Column(_sa_enum(QuestStatus, "queststatus"), nullable=False, default=QuestStatus.ACTIVE)
    xp_reward           = Column(Integer, nullable=False, default=150)
    coins_reward        = Column(Integer, nullable=False, default=10)
    time_limit_hours    = Column(Integer, nullable=True)
    integration_trigger = Column(String(100), nullable=True)
    integration_target  = Column(Integer, nullable=True)
    created_by  = Column(UUID(as_uuid=False), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user_quests = relationship("UserQuest", back_populates="quest", cascade="all, delete-orphan")


class UserQuest(Base):
    __tablename__ = "user_quests"
    __table_args__ = (
        UniqueConstraint("user_id", "quest_id", name="uq_user_quest"),
        {"schema": DB_SCHEMA},
    )

    id           = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id      = Column(UUID(as_uuid=False), nullable=False)
    quest_id     = Column(UUID(as_uuid=False), ForeignKey(f"{DB_SCHEMA}.quests.id", ondelete="CASCADE"), nullable=False)
    status       = Column(_sa_enum(UserQuestStatus, "userqueststatus"), nullable=False, default=UserQuestStatus.IN_PROGRESS)
    progress     = Column(Integer, nullable=False, default=0)
    target       = Column(Integer, nullable=False, default=1)
    is_viewed    = Column(Boolean, nullable=False, default=False)
    started_at   = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    deadline_at  = Column(DateTime(timezone=True), nullable=True)

    quest = relationship("Quest", back_populates="user_quests")


# ===================================
# БЕЙДЖИ
# ===================================

class Badge(Base):
    __tablename__ = "badges"
    __table_args__ = (
        UniqueConstraint("name", name="uq_badges_name"),
        {"schema": DB_SCHEMA},
    )

    id              = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name            = Column(String(100), nullable=False)
    description     = Column(Text, nullable=True)
    icon_url        = Column(String(500), nullable=True)
    rarity          = Column(_sa_enum(BadgeRarity, "badgerarity"), nullable=False, default=BadgeRarity.COMMON)
    condition_type  = Column(String(50), nullable=True)
    condition_value = Column(Integer, nullable=True)
    xp_bonus        = Column(Integer, nullable=False, default=0)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    user_badges = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
        {"schema": DB_SCHEMA},
    )

    id         = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id    = Column(UUID(as_uuid=False), nullable=False)
    badge_id   = Column(UUID(as_uuid=False), ForeignKey(f"{DB_SCHEMA}.badges.id", ondelete="CASCADE"), nullable=False)
    earned_at  = Column(DateTime(timezone=True), server_default=func.now())
    granted_by = Column(UUID(as_uuid=False), nullable=True)
    is_revoked = Column(Boolean, nullable=False, default=False)
    is_new     = Column(Boolean, nullable=False, default=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    badge = relationship("Badge", back_populates="user_badges")


# ===================================
# XP ТРАНЗАКЦИИ
# ===================================

class XPTransaction(Base):
    __tablename__ = "xp_transactions"
    __table_args__ = {"schema": DB_SCHEMA}

    id          = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id     = Column(UUID(as_uuid=False), nullable=False)
    amount      = Column(Integer, nullable=False)
    source      = Column(_sa_enum(XPSource, "xpsource"), nullable=False)
    source_id   = Column(UUID(as_uuid=False), nullable=True)
    description = Column(String(300), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


# ===================================
# ЛИДЕРБОРД
# ===================================

class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"
    __table_args__ = {"schema": DB_SCHEMA}

    id               = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id          = Column(UUID(as_uuid=False), nullable=False)
    username         = Column(String(50), nullable=False)
    full_name        = Column(String(150), nullable=True)
    total_xp         = Column(Integer, nullable=False, default=0)
    level            = Column(Integer, nullable=False, default=1)
    total_coins      = Column(Integer, nullable=False, default=0)
    quests_completed = Column(Integer, nullable=False, default=0)
    badges_count     = Column(Integer, nullable=False, default=0)
    rank             = Column(Integer, nullable=False, default=0)
    period           = Column(String(20), nullable=False)
    snapshot_at      = Column(DateTime(timezone=True), server_default=func.now())


# ===================================
# ПЕРСОНАЖИ
# ===================================

class CharacterType(Base):
    """Архетип персонажа (warrior / mage / rogue / engineer)."""
    __tablename__ = "character_types"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_character_types_slug"),
        {"schema": DB_SCHEMA},
    )

    id                   = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    slug                 = Column(_sa_enum(CharacterTypeSlug, "charactertypeslugs"), nullable=False)
    name                 = Column(String(50), nullable=False)
    description          = Column(Text, nullable=True)
    icon_url             = Column(String(500), nullable=True)
    coin_multiplier_base = Column(Float, nullable=False, default=1.0)
    xp_multiplier_base   = Column(Float, nullable=False, default=1.0)
    bonus_description    = Column(String(300), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

    characters = relationship("Character", back_populates="character_type")


class Character(Base):
    """Персонаж пользователя — 1:1 с user_id."""
    __tablename__ = "characters"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_characters_user_id"),
        {"schema": DB_SCHEMA},
    )

    id                = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id           = Column(UUID(as_uuid=False), nullable=False)
    character_type_id = Column(
        UUID(as_uuid=False),
        ForeignKey(f"{DB_SCHEMA}.character_types.id"),
        nullable=False,
    )
    level           = Column(Integer, nullable=False, default=1)
    experience      = Column(Integer, nullable=False, default=0)
    coin_multiplier = Column(Float, nullable=False, default=1.0)
    xp_multiplier   = Column(Float, nullable=False, default=1.0)
    skin_color      = Column(String(7), nullable=True, default="#F5C5A3")
    hair_color      = Column(String(7), nullable=True, default="#2C1810")
    eyes_color      = Column(String(7), nullable=True, default="#4A90D9")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    character_type = relationship("CharacterType", back_populates="characters")
    equipment      = relationship("CharacterEquipment", back_populates="character", cascade="all, delete-orphan")


class CosmeticItem(Base):
    """Косметический предмет (внешность, одежда, оружие)."""
    __tablename__ = "cosmetic_items"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_cosmetic_items_slug"),
        {"schema": DB_SCHEMA},
    )

    id                      = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name                    = Column(String(100), nullable=False)
    slug                    = Column(String(100), nullable=False)
    description             = Column(Text, nullable=True)
    preview_url             = Column(String(500), nullable=True)
    slot                    = Column(_sa_enum(CosmeticSlot, "cosmeticslot"), nullable=False)
    rarity                  = Column(_sa_enum(BadgeRarity, "badgerarity"), nullable=False, default=BadgeRarity.COMMON)
    visibility              = Column(_sa_enum(CosmeticVisibility, "cosmeticvisibility"), nullable=False, default=CosmeticVisibility.OPEN)
    unlock_type             = Column(_sa_enum(UnlockType, "unlocktype"), nullable=False, default=UnlockType.NONE)
    unlock_ref              = Column(UUID(as_uuid=False), nullable=True)
    unlock_value            = Column(Integer, nullable=True)
    allowed_character_types = Column(JSON, nullable=True)
    created_at              = Column(DateTime(timezone=True), server_default=func.now())

    equipment         = relationship("CharacterEquipment", back_populates="cosmetic_item")
    unlocked_by_users = relationship("UnlockedCosmetic", back_populates="cosmetic_item")


class CharacterEquipment(Base):
    """Надетый предмет на персонаже (один слот — один предмет)."""
    __tablename__ = "character_equipment"
    __table_args__ = (
        UniqueConstraint("character_id", "slot", name="uq_character_slot"),
        {"schema": DB_SCHEMA},
    )

    id               = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    character_id     = Column(
        UUID(as_uuid=False),
        ForeignKey(f"{DB_SCHEMA}.characters.id", ondelete="CASCADE"),
        nullable=False,
    )
    cosmetic_item_id = Column(
        UUID(as_uuid=False),
        ForeignKey(f"{DB_SCHEMA}.cosmetic_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    slot        = Column(_sa_enum(CosmeticSlot, "cosmeticslot"), nullable=False)
    color       = Column(String(7), nullable=True)
    equipped_at = Column(DateTime(timezone=True), server_default=func.now())

    character     = relationship("Character", back_populates="equipment")
    cosmetic_item = relationship("CosmeticItem", back_populates="equipment")


class UnlockedCosmetic(Base):
    """Разблокированная косметика пользователя."""
    __tablename__ = "unlocked_cosmetics"
    __table_args__ = (
        UniqueConstraint("user_id", "cosmetic_item_id", name="uq_user_cosmetic"),
        {"schema": DB_SCHEMA},
    )

    id               = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id          = Column(UUID(as_uuid=False), nullable=False)
    cosmetic_item_id = Column(
        UUID(as_uuid=False),
        ForeignKey(f"{DB_SCHEMA}.cosmetic_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    unlocked_at  = Column(DateTime(timezone=True), server_default=func.now())
    unlocked_by  = Column(UUID(as_uuid=False), nullable=True)

    cosmetic_item = relationship("CosmeticItem", back_populates="unlocked_by_users")
