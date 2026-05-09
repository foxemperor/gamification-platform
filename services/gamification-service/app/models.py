"""
Gamification Service — модели БД
=====================================
Таблицы: Quest, UserQuest, Badge, UserBadge,
         XPTransaction, LeaderboardSnapshot
Автор: Dmitry Koval
"""

import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey,
    Integer, String, Text, Enum, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base, DB_SCHEMA
from app.config import settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


def xp_required_for_level(level: int) -> int:
    return int(settings.BASE_XP_PER_LEVEL * (level ** settings.XP_LEVEL_MULTIPLIER))


# ── helpers для Enum с правильной схемой ──
def _enum(*values, name: str) -> Enum:
    """СВА Enum с schema=DB_SCHEMA и create_type=False.
    Тип уже создан миграцией, поэтому create_type=False.
    """
    return Enum(*values, name=name, schema=DB_SCHEMA, create_type=False)


# ===================================
# ENUMS (Python)
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


class BadgeRarity(str, PyEnum):
    COMMON    = "common"
    RARE      = "rare"
    EPIC      = "epic"
    LEGENDARY = "legendary"


# ===================================
# МОДЕЛИ КВЕСТОВ
# ===================================

class Quest(Base):
    __tablename__ = "quests"
    __table_args__ = (
        Index("ix_quests_status", "status"),
        Index("ix_quests_type", "quest_type"),
        {"schema": DB_SCHEMA},
    )

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    quest_type  = Column(_enum("personal","team","daily","skill","integration", name="questtype"), nullable=False, default=QuestType.PERSONAL)
    difficulty  = Column(_enum("easy","medium","hard","epic", name="questdifficulty"), nullable=False, default=QuestDifficulty.MEDIUM)
    status      = Column(_enum("draft","active","archived", name="queststatus"), nullable=False, default=QuestStatus.ACTIVE)
    xp_reward   = Column(Integer, nullable=False, default=150)
    coins_reward = Column(Integer, nullable=False, default=10)
    time_limit_hours     = Column(Integer, nullable=True)
    integration_trigger  = Column(String(100), nullable=True)
    integration_target   = Column(Integer, nullable=True)
    created_by  = Column(UUID(as_uuid=False), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow)
    updated_at  = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user_quests = relationship("UserQuest", back_populates="quest", cascade="all, delete-orphan")


class UserQuest(Base):
    __tablename__ = "user_quests"
    __table_args__ = (
        UniqueConstraint("user_id", "quest_id", name="uq_user_quest"),
        Index("ix_user_quests_user_status", "user_id", "status"),
        {"schema": DB_SCHEMA},
    )

    id       = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id  = Column(UUID(as_uuid=False), nullable=False, index=True)
    quest_id = Column(UUID(as_uuid=False), ForeignKey(f"{DB_SCHEMA}.quests.id", ondelete="CASCADE"), nullable=False)
    status   = Column(_enum("in_progress","completed","failed","abandoned", name="userqueststatus"), nullable=False, default=UserQuestStatus.IN_PROGRESS)
    progress = Column(Integer, nullable=False, default=0)
    target   = Column(Integer, nullable=False, default=1)
    started_at   = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    deadline_at  = Column(DateTime(timezone=True), nullable=True)
    # Флаг просмотра для уведомлений в sidebar
    is_viewed = Column(Boolean, nullable=False, default=False, server_default="false")

    quest = relationship("Quest", back_populates="user_quests")


# ===================================
# МОДЕЛИ БЕЙДЖЕЙ
# ===================================

class Badge(Base):
    __tablename__ = "badges"
    __table_args__ = ({"schema": DB_SCHEMA},)

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name        = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    icon_url    = Column(String(500), nullable=True)
    rarity      = Column(_enum("common","rare","epic","legendary", name="badgerarity"), nullable=False, default=BadgeRarity.COMMON)
    condition_type  = Column(String(50), nullable=True)
    condition_value = Column(Integer, nullable=True)
    xp_bonus    = Column(Integer, nullable=False, default=0)
    created_at  = Column(DateTime(timezone=True), default=utcnow)

    user_badges = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
        {"schema": DB_SCHEMA},
    )

    id         = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id    = Column(UUID(as_uuid=False), nullable=False, index=True)
    badge_id   = Column(UUID(as_uuid=False), ForeignKey(f"{DB_SCHEMA}.badges.id", ondelete="CASCADE"), nullable=False)
    earned_at  = Column(DateTime(timezone=True), default=utcnow)
    granted_by = Column(UUID(as_uuid=False), nullable=True)
    is_revoked = Column(Boolean, nullable=False, default=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    # Флаг нового/непрочитанного достижения для уведомлений
    is_new     = Column(Boolean, nullable=False, default=True, server_default="true")

    badge = relationship("Badge", back_populates="user_badges")


# ===================================
# МОДЕЛЬ XP ТРАНЗАКЦИЙ
# ===================================

class XPTransaction(Base):
    __tablename__ = "xp_transactions"
    __table_args__ = (
        Index("ix_xp_transactions_user_created", "user_id", "created_at"),
        {"schema": DB_SCHEMA},
    )

    id          = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id     = Column(UUID(as_uuid=False), nullable=False, index=True)
    amount      = Column(Integer, nullable=False)
    source      = Column(_enum("quest","badge","github_commit","github_pr","jira_task","admin","penalty","character_level", name="xpsource"), nullable=False)
    source_id   = Column(UUID(as_uuid=False), nullable=True)
    description = Column(String(300), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow, index=True)


# ===================================
# МОДЕЛЬ ЛИДЕРБОРДА
# ===================================

class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"
    __table_args__ = (
        Index("ix_leaderboard_period_rank", "period", "rank"),
        Index("ix_leaderboard_user_period", "user_id", "period"),
        {"schema": DB_SCHEMA},
    )

    id               = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
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
    snapshot_at      = Column(DateTime(timezone=True), default=utcnow, index=True)
