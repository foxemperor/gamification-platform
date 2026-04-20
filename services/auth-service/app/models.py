"""
SQLAlchemy модели Auth Service
==============================
Модель User — основная сущность системы.
Автор: Dmitry Koval
"""

import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    # Первичный ключ — UUID
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Идентификационные данные
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Профиль
    full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Геймификация
    xp: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    coins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Статус
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Временные метки
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} level={self.level}>"

    @property
    def xp_to_next_level(self) -> int:
        """XP до следующего уровня (формула: level * 100)"""
        return self.level * 100

    @property
    def xp_progress_percent(self) -> float:
        """Процент прогресса до следующего уровня"""
        needed = self.xp_to_next_level
        if needed == 0:
            return 100.0
        return round((self.xp % needed) / needed * 100, 1)
