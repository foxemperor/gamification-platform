"""
Gamification Service — модели БД
=====================================
Таблицы: Quest, UserQuest, Badge, UserBadge,
         XPTransaction, LeaderboardSnapshot
Автор: Dmitry Koval
"""

import uuid
import math
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, Enum, UniqueConstraint, Index,
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

    Пример (при BASE=100, MULT=1.5):
        Уровень 1 → 100 XP
        Уровень 2 → 283 XP
        Уровень 5 → 1118 XP
        Уровень 10 → 3162 XP
    """
    return int(settings.BASE_XP_PER_LEVEL * (level ** settings.XP_LEVEL_MULTIPLIER))


# ===================================
# ENUMS
# ===================================

class QuestType(str, PyEnum):
    PERSONAL = "personal"       # Личный квест
    TEAM = "team"               # Командный квест
    DAILY = "daily"             # Ежедневный квест
    SKILL = "skill"             # Скилловый квест
    INTEGRATION = "integration" # Квест от интеграции (GitHub, Jira)


class QuestDifficulty(str, PyEnum):
    EASY = "easy"       # +50 XP
    MEDIUM = "medium"   # +150 XP
    HARD = "hard"       # +400 XP
    EPIC = "epic"       # +1000 XP


class QuestStatus(str, PyEnum):
    DRAFT = "draft"         # Черновик
    ACTIVE = "active"       # Доступен
    ARCHIVED = "archived"   # Архив


class UserQuestStatus(str, PyEnum):
    IN_PROGRESS = "in_progress"   # В процессе
    COMPLETED = "completed"       # Завершён
    FAILED = "failed"             # Провален
    ABANDONED = "abandoned"       # Отказался


class XPSource(str, PyEnum):
    QUEST = "quest"               # За выполнение квеста
    BADGE = "badge"               # За получение бейджа
    GITHUB_COMMIT = "github_commit"   # За коммит в GitHub
    GITHUB_PR = "github_pr"           # За Pull Request
    JIRA_TASK = "jira_task"           # За закрытие задачи в Jira
    ADMIN = "admin"               # Вручное начисление админом
    PENALTY = "penalty"           # Штраф (XP < 0)


class BadgeRarity(str, PyEnum):
    COMMON = "common"       # Обычный
    RARE = "rare"           # Редкий
    EPIC = "epic"           # Эпический
    LEGENDARY = "legendary" # Легендарный


# ===================================
# МОДЕЛИ КВЕСТОВ
# ===================================

class Quest(Base):
    """Шаблон квеста — что нужно сделать и награда за это."""
    __tablename__ = "quests"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    quest_type = Column(Enum(QuestType), nullable=False, default=QuestType.PERSONAL)
    difficulty = Column(Enum(QuestDifficulty), nullable=False, default=QuestDifficulty.MEDIUM)
    status = Column(Enum(QuestStatus), nullable=False, default=QuestStatus.ACTIVE)

    # Награды
    xp_reward = Column(Integer, nullable=False, default=150)
    coins_reward = Column(Integer, nullable=False, default=10)

    # Временные ограничения
    time_limit_hours = Column(Integer, nullable=True)  # None = без ограничения

    # Критерии выполнения (для интеграций)
    integration_trigger = Column(String(100), nullable=True)  # "github_commit", "jira_close"
    integration_target = Column(Integer, nullable=True)       # количество действий

    # Метаданные
    created_by = Column(UUID(as_uuid=False), nullable=True)   # UUID админа
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Связи
    user_quests = relationship("UserQuest", back_populates="quest", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_quests_status", "status"),
        Index("ix_quests_type", "quest_type"),
    )


class UserQuest(Base):
    """Прогресс пользователя по квесту."""
    __tablename__ = "user_quests"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    quest_id = Column(UUID(as_uuid=False), ForeignKey("quests.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(UserQuestStatus), nullable=False, default=UserQuestStatus.IN_PROGRESS)

    # Прогресс
    progress = Column(Integer, nullable=False, default=0)   # текущее значение
    target = Column(Integer, nullable=False, default=1)     # целевое значение

    started_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    deadline_at = Column(DateTime(timezone=True), nullable=True)

    # Связи
    quest = relationship("Quest", back_populates="user_quests")

    __table_args__ = (
        UniqueConstraint("user_id", "quest_id", name="uq_user_quest"),
        Index("ix_user_quests_user_status", "user_id", "status"),
    )


# ===================================
# МОДЕЛИ БЕЙДЖЕЙ
# ===================================

class Badge(Base):
    """Шаблон бейджа — достижение/награда."""
    __tablename__ = "badges"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    icon_url = Column(String(500), nullable=True)
    rarity = Column(Enum(BadgeRarity), nullable=False, default=BadgeRarity.COMMON)

    # Условие получения
    condition_type = Column(String(50), nullable=True)   # "quests_completed", "xp_reached", "streak_days"
    condition_value = Column(Integer, nullable=True)     # пороговое значение

    xp_bonus = Column(Integer, nullable=False, default=0)  # доп бонус XP за бейдж

    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Связи
    user_badges = relationship("UserBadge", back_populates="badge", cascade="all, delete-orphan")


class UserBadge(Base):
    """Бейдж, полученный пользователем."""
    __tablename__ = "user_badges"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=False), nullable=False, index=True)
    badge_id = Column(UUID(as_uuid=False), ForeignKey("badges.id", ondelete="CASCADE"), nullable=False)
    earned_at = Column(DateTime(timezone=True), default=utcnow)

    # Связи
    badge = relationship("Badge", back_populates="user_badges")

    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
    )


# ===================================
# МОДЕЛЬ XP ТРАНЗАКЦИЙ
# ===================================

class XPTransaction(Base):
    """
    Журнал всех начислений/списаний XP.
    Неизменяемая запись — только INSERT, никогда UPDATE/DELETE.
    Обеспечивает аудит и возможность восстановления.
    """
    __tablename__ = "xp_transactions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=False), nullable=False, index=True)

    amount = Column(Integer, nullable=False)             # может быть отрицательным (penalty)
    source = Column(Enum(XPSource), nullable=False)
    source_id = Column(UUID(as_uuid=False), nullable=True)  # ID квеста/бейджа/PR
    description = Column(String(300), nullable=True)

    created_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    __table_args__ = (
        Index("ix_xp_transactions_user_created", "user_id", "created_at"),
    )


# ===================================
# МОДЕЛЬ ЛИДЕРБОРДА
# ===================================

class LeaderboardSnapshot(Base):
    """
    Снимок лидерборда — хранит позицию пользователя на конец периода.
    Позволяет строить исторические графики для аналитики.
    """
    __tablename__ = "leaderboard_snapshots"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=False), nullable=False)
    username = Column(String(50), nullable=False)
    full_name = Column(String(150), nullable=True)

    total_xp = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)
    total_coins = Column(Integer, nullable=False, default=0)
    quests_completed = Column(Integer, nullable=False, default=0)
    badges_count = Column(Integer, nullable=False, default=0)

    rank = Column(Integer, nullable=False, default=0)  # позиция в рейтинге
    period = Column(String(20), nullable=False)        # "weekly", "monthly", "all_time"
    snapshot_at = Column(DateTime(timezone=True), default=utcnow, index=True)

    __table_args__ = (
        Index("ix_leaderboard_period_rank", "period", "rank"),
        Index("ix_leaderboard_user_period", "user_id", "period"),
    )
