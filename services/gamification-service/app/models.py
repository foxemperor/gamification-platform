"""
Gamification Service — модели БД
=====================================
Таблицы: Quest, UserQuest, Badge, UserBadge,
         XPTransaction, LeaderboardSnapshot,
         CharacterType, Character,
         CosmeticItem, CharacterEquipment, UnlockedCosmetic
Автор: Dmitry Koval
"""

import uuid
import math
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, Enum, UniqueConstraint, Index, JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.config import settings


# ===================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ===================================

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


def xp_required_for_level(level: int) -> int:
    """
    Формула прогрессии по степенному закону (Power Law):
        XP(N) = BASE_XP * N ^ XP_MULTIPLIER
    """
    return int(settings.BASE_XP_PER_LEVEL * (level ** settings.XP_LEVEL_MULTIPLIER))


# ===================================
# ENUMS — Квесты
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
    QUEST         = "quest"
    BADGE         = "badge"
    GITHUB_COMMIT = "github_commit"
    GITHUB_PR     = "github_pr"
    JIRA_TASK     = "jira_task"
    ADMIN         = "admin"
    PENALTY       = "penalty"
    CHARACTER_LVL = "character_level"  # бонус за прокачку персонажа


class BadgeRarity(str, PyEnum):
    COMMON    = "common"
    RARE      = "rare"
    EPIC      = "epic"
    LEGENDARY = "legendary"


# ===================================
# ENUMS — Персонаж
# ===================================

class CharacterTypeSlugs(str, PyEnum):
    WARRIOR  = "warrior"
    MAGE     = "mage"
    ROGUE    = "rogue"
    ENGINEER = "engineer"


class CosmeticSlot(str, PyEnum):
    HAIR              = "hair"
    HEAD              = "head"
    HEAD_ACCESSORY    = "head_accessory"
    EYES              = "eyes"
    FACE_EXPRESSION   = "face_expression"
    TORSO             = "torso"
    TORSO_ACCESSORY   = "torso_accessory"
    LEGS              = "legs"
    WEAPON_MAIN       = "weapon_main"
    WEAPON_SECONDARY  = "weapon_secondary"


class CosmeticVisibility(str, PyEnum):
    OPEN   = "open"    # доступно сразу
    LOCKED = "locked"  # видно с замком
    HIDDEN = "hidden"  # скрыто до выполнения условия


class UnlockType(str, PyEnum):
    NONE        = "none"        # бесплатно
    QUEST       = "quest"       # за квест
    ACHIEVEMENT = "achievement" # за достижение
    LEVEL       = "level"       # уровень персонажа
    ADMIN       = "admin"       # выдаёт админ вручную


# ===================================
# МОДЕЛИ КВЕСТОВ
# ===================================

class Quest(Base):
    """\u0428\u0430\u0431\u043b\u043e\u043d \u043a\u0432\u0435\u0441\u0442\u0430."""
    __tablename__ = "quests"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    title           = Column(String(200), nullable=False)
    description     = Column(Text, nullable=True)
    quest_type      = Column(Enum(QuestType), nullable=False, default=QuestType.PERSONAL)
    difficulty      = Column(Enum(QuestDifficulty), nullable=False, default=QuestDifficulty.MEDIUM)
    status          = Column(Enum(QuestStatus), nullable=False, default=QuestStatus.ACTIVE)

    xp_reward       = Column(Integer, nullable=False, default=150)
    coins_reward    = Column(Integer, nullable=False, default=10)

    time_limit_hours     = Column(Integer, nullable=True)
    integration_trigger  = Column(String(100), nullable=True)
    integration_target   = Column(Integer, nullable=True)

    created_by  = Column(UUID(as_uuid=False), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow)
    updated_at  = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user_quests = relationship("UserQuest", back_populates="quest", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_quests_status", "status"),
        Index("ix_quests_type", "quest_type"),
    )


class UserQuest(Base):
    """\u041f\u0440\u043e\u0433\u0440\u0435\u0441\u0441 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043f\u043e \u043a\u0432\u0435\u0441\u0442\u0443."""
    __tablename__ = "user_quests"

    id           = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id      = Column(UUID(as_uuid=False), nullable=False, index=True)
    quest_id     = Column(UUID(as_uuid=False), ForeignKey("quests.id", ondelete="CASCADE"), nullable=False)
    status       = Column(Enum(UserQuestStatus), nullable=False, default=UserQuestStatus.IN_PROGRESS)

    progress     = Column(Integer, nullable=False, default=0)
    target       = Column(Integer, nullable=False, default=1)

    started_at   = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    deadline_at  = Column(DateTime(timezone=True), nullable=True)

    quest = relationship("Quest", back_populates="user_quests")

    __table_args__ = (
        UniqueConstraint("user_id", "quest_id", name="uq_user_quest"),
        Index("ix_user_quests_user_status", "user_id", "status"),
    )


# ===================================
# МОДЕЛИ БЕЙДЖЕЙ
# ===================================

class Badge(Base):
    """\u0428\u0430\u0431\u043b\u043e\u043d \u0431\u0435\u0439\u0434\u0436\u0430/\u0434\u043e\u0441\u0442\u0438\u0436\u0435\u043d\u0438\u044f."""
    __tablename__ = "badges"

    id               = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name             = Column(String(100), nullable=False, unique=True)
    description      = Column(Text, nullable=True)
    icon_url         = Column(String(500), nullable=True)
    rarity           = Column(Enum(BadgeRarity), nullable=False, default=BadgeRarity.COMMON)

    condition_type   = Column(String(50), nullable=True)
    condition_value  = Column(Integer, nullable=True)
    xp_bonus         = Column(Integer, nullable=False, default=0)

    created_at       = Column(DateTime(timezone=True), default=utcnow)

    user_badges = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")


class UserBadge(Base):
    """\u0411\u0435\u0439\u0434\u0436, \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u043d\u044b\u0439 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u043c."""
    __tablename__ = "user_badges"

    id           = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id      = Column(UUID(as_uuid=False), nullable=False, index=True)
    badge_id     = Column(UUID(as_uuid=False), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    earned_at    = Column(DateTime(timezone=True), default=utcnow)

    # Админ может выдать вручную или отозвать
    granted_by   = Column(UUID(as_uuid=False), nullable=True)   # NULL = авто
    is_revoked   = Column(Boolean, nullable=False, default=False)
    revoked_at   = Column(DateTime(timezone=True), nullable=True)

    badge = relationship("Badge", back_populates="user_badges")

    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
    )


# ===================================
# МОДЕЛЬ XP ТРАНЗАКЦИЙ
# ===================================

class XPTransaction(Base):
    """
    \u0416\u0443\u0440\u043d\u0430\u043b \u0432\u0441\u0435\u0445 \u043d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u0438\u0439/\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0439 XP.
    \u041d\u0435\u0438\u0437\u043c\u0435\u043d\u044f\u0435\u043c\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c — \u0442\u043e\u043b\u044c\u043a\u043e INSERT.
    """
    __tablename__ = "xp_transactions"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id     = Column(UUID(as_uuid=False), nullable=False, index=True)
    amount      = Column(Integer, nullable=False)
    source      = Column(Enum(XPSource), nullable=False)
    source_id   = Column(UUID(as_uuid=False), nullable=True)
    description = Column(String(300), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow, index=True)

    __table_args__ = (
        Index("ix_xp_transactions_user_created", "user_id", "created_at"),
    )


# ===================================
# МОДЕЛЬ ЛИДЕРБОРДА
# ===================================

class LeaderboardSnapshot(Base):
    """
    \u0421\u043d\u0438\u043c\u043e\u043a \u043b\u0438\u0434\u0435\u0440\u0431\u043e\u0440\u0434\u0430 \u2014 \u043f\u043e\u0437\u0438\u0446\u0438\u044f \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f \u043d\u0430 \u043a\u043e\u043d\u0435\u0446 \u043f\u0435\u0440\u0438\u043e\u0434\u0430.
    """
    __tablename__ = "leaderboard_snapshots"

    id                = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id           = Column(UUID(as_uuid=False), nullable=False)
    username          = Column(String(50), nullable=False)
    full_name         = Column(String(150), nullable=True)

    total_xp          = Column(Integer, nullable=False, default=0)
    level             = Column(Integer, nullable=False, default=1)
    total_coins       = Column(Integer, nullable=False, default=0)
    quests_completed  = Column(Integer, nullable=False, default=0)
    badges_count      = Column(Integer, nullable=False, default=0)

    rank        = Column(Integer, nullable=False, default=0)
    period      = Column(String(20), nullable=False)
    snapshot_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    __table_args__ = (
        Index("ix_leaderboard_period_rank", "period", "rank"),
        Index("ix_leaderboard_user_period", "user_id", "period"),
    )


# ===================================
# МОДЕЛИ ПЕРСОНАЖА
# ===================================

class CharacterType(Base):
    """
    \u0421\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u0438\u043a \u0442\u0438\u043f\u043e\u0432 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0435\u0439.
    \u041a\u0430\u0436\u0434\u044b\u0439 \u0442\u0438\u043f \u0434\u0430\u0451\u0442 \u0441\u0432\u043e\u0438 \u0431\u0430\u0437\u043e\u0432\u044b\u0435 \u043c\u0443\u043b\u044c\u0442\u0438\u043f\u043b\u0438\u043a\u0430\u0442\u043e\u0440\u044b \u0431\u043e\u043d\u0443\u0441\u043e\u0432.
    """
    __tablename__ = "character_types"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    slug        = Column(Enum(CharacterTypeSlugs), nullable=False, unique=True)  # warrior/mage/...
    name        = Column(String(50), nullable=False)           # Отображаемое имя
    description = Column(Text, nullable=True)
    icon_url    = Column(String(500), nullable=True)

    # Базовые мультипликаторы (1.0 = без бонуса)
    coin_multiplier_base = Column(Float, nullable=False, default=1.0)
    xp_multiplier_base   = Column(Float, nullable=False, default=1.0)
    bonus_description    = Column(String(300), nullable=True)  # Текст для UI

    created_at = Column(DateTime(timezone=True), default=utcnow)

    characters = relationship("Character", back_populates="character_type")


class Character(Base):
    """
    \u041f\u0435\u0440\u0441\u043e\u043d\u0430\u0436 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f (1:1 \u0441 User).
    \u0418\u043c\u0435\u0435\u0442 \u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u043d\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043c\u043e \u043e\u0442 \u0443\u0440\u043e\u0432\u043d\u044f \u0438\u0433\u0440\u043e\u043a\u0430.
    """
    __tablename__ = "characters"

    id                  = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id             = Column(UUID(as_uuid=False), nullable=False, unique=True, index=True)
    character_type_id   = Column(UUID(as_uuid=False), ForeignKey("character_types.id"), nullable=False)

    # Уровень персонажа (отдельно от уровня игрока)
    level               = Column(Integer, nullable=False, default=1)
    experience          = Column(Integer, nullable=False, default=0)  # XP персонажа

    # Текущие мультипликаторы (растут с уровнем)
    coin_multiplier     = Column(Float, nullable=False, default=1.0)
    xp_multiplier       = Column(Float, nullable=False, default=1.0)

    # Цвета тела (свободные HEX, не предметы)
    skin_color          = Column(String(7), nullable=True, default="#F5C5A3")  # HEX
    hair_color          = Column(String(7), nullable=True, default="#2C1810")
    eyes_color          = Column(String(7), nullable=True, default="#4A90D9")

    created_at  = Column(DateTime(timezone=True), default=utcnow)
    updated_at  = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    character_type = relationship("CharacterType", back_populates="characters")
    equipment      = relationship("CharacterEquipment", back_populates="character", cascade="all, delete-orphan")


# ===================================
# МОДЕЛИ КОСМЕТИКИ
# ===================================

class CosmeticItem(Base):
    """
    \u041a\u0430\u0442\u0430\u043b\u043e\u0433 \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u043e\u0432 \u043a\u0430\u0441\u0442\u043e\u043c\u0438\u0437\u0430\u0446\u0438\u0438.
    \u041a\u0430\u0436\u0434\u044b\u0439 \u043f\u0440\u0435\u0434\u043c\u0435\u0442 \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d \u043a \u0441\u043b\u043e\u0442\u0443 \u0438 \u043c\u043e\u0436\u0435\u0442 \u0438\u043c\u0435\u0442\u044c \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f \u043f\u043e \u043a\u043b\u0430\u0441\u0441\u0443 \u0438 \u0443\u0441\u043b\u043e\u0432\u0438\u044e \u0440\u0430\u0437\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u043a\u0438.
    """
    __tablename__ = "cosmetic_items"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name        = Column(String(100), nullable=False)
    slug        = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    preview_url = Column(String(500), nullable=True)

    slot        = Column(Enum(CosmeticSlot), nullable=False)
    rarity      = Column(Enum(BadgeRarity), nullable=False, default=BadgeRarity.COMMON)

    # Доступность
    visibility  = Column(Enum(CosmeticVisibility), nullable=False, default=CosmeticVisibility.OPEN)

    # Условие разблокировки
    unlock_type  = Column(Enum(UnlockType), nullable=False, default=UnlockType.NONE)
    unlock_ref   = Column(UUID(as_uuid=False), nullable=True)   # ID квеста/достижения
    unlock_value = Column(Integer, nullable=True)               # порог уровня

    # Ограничения по классу (JSON: ["warrior", "mage"] или NULL = всем)
    allowed_character_types = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow)

    equipment        = relationship("CharacterEquipment", back_populates="cosmetic_item")
    unlocked_by_users = relationship("UnlockedCosmetic", back_populates="cosmetic_item")

    __table_args__ = (
        Index("ix_cosmetic_items_slot", "slot"),
        Index("ix_cosmetic_items_visibility", "visibility"),
    )


class CharacterEquipment(Base):
    """
    \u0427\u0442\u043e \u043d\u0430\u0434\u0435\u0442\u043e \u043d\u0430 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0435 \u0441\u0435\u0439\u0447\u0430\u0441.
    \u041e\u0434\u0438\u043d \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u0436 \u2014 \u043e\u0434\u0438\u043d \u043f\u0440\u0435\u0434\u043c\u0435\u0442 \u043d\u0430 \u0441\u043b\u043e\u0442.
    """
    __tablename__ = "character_equipment"

    id               = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    character_id     = Column(UUID(as_uuid=False), ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    cosmetic_item_id = Column(UUID(as_uuid=False), ForeignKey("cosmetic_items.id", ondelete="CASCADE"), nullable=False)
    slot             = Column(Enum(CosmeticSlot), nullable=False)  # дублируем для быстрой выборки
    color            = Column(String(7), nullable=True)             # HEX цвет предмета
    equipped_at      = Column(DateTime(timezone=True), default=utcnow)

    character    = relationship("Character", back_populates="equipment")
    cosmetic_item = relationship("CosmeticItem", back_populates="equipment")

    __table_args__ = (
        # Один предмет на слот для одного персонажа
        UniqueConstraint("character_id", "slot", name="uq_character_slot"),
        Index("ix_character_equipment_character", "character_id"),
    )


class UnlockedCosmetic(Base):
    """
    \u0427\u0442\u043e \u0440\u0430\u0437\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043e \u0443 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.
    \u0420\u0430\u0437\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u044b \u043c\u043e\u0436\u043d\u043e \u043d\u0430\u0434\u0435\u0432\u0430\u0442\u044c. \u0417\u0430\u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 — \u043d\u0435\u0442.
    """
    __tablename__ = "unlocked_cosmetics"

    id               = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id          = Column(UUID(as_uuid=False), nullable=False, index=True)
    cosmetic_item_id = Column(UUID(as_uuid=False), ForeignKey("cosmetic_items.id", ondelete="CASCADE"), nullable=False)
    unlocked_at      = Column(DateTime(timezone=True), default=utcnow)
    unlocked_by      = Column(UUID(as_uuid=False), nullable=True)  # ID квеста/бейджа/NULL=админ

    cosmetic_item = relationship("CosmeticItem", back_populates="unlocked_by_users")

    __table_args__ = (
        UniqueConstraint("user_id", "cosmetic_item_id", name="uq_user_cosmetic"),
        Index("ix_unlocked_cosmetics_user", "user_id"),
    )
