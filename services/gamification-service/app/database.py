"""
Gamification Service — подключение к базе данных
=================================================
Async SQLAlchemy + PostgreSQL через asyncpg.
Автор: Dmitry Koval

Схема: gamification — изолирует таблицы gamification-service
от auth-service в рамках одной физической БД gamification_db.
"""

import logging
import subprocess
import sys
from typing import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger("gamification-service.database")

DB_SCHEMA = "gamification"

# ===================================
# ДВИЖОК БД
# ===================================

_engine_kwargs: dict = {"echo": settings.DEBUG}
if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite (используется в тестах) — пул несовместим, держим один коннект.
    from sqlalchemy.pool import StaticPool

    _engine_kwargs.update({
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    })
else:
    _engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
    })

engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ===================================
# БАЗОВАЯ МОДЕЛЬ
# ===================================

class Base(DeclarativeBase):
    """Базовый класс для всех моделей gamification-service.
    Все таблицы создаются в схеме 'gamification'.
    """
    __table_args__ = {"schema": DB_SCHEMA}


# ===================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ===================================

async def ensure_schema() -> None:
    """Создаёт схему 'gamification' если её нет — Alembic это не делает."""
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))
    logger.info(f"✅ Схема '{DB_SCHEMA}' готова")


def run_migrations() -> None:
    """Запускает alembic upgrade head синхронно.
    Идемпотентно: если миграции уже применены — ничего не делает.
    """
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=False,
    )
    if result.returncode != 0:
        raise RuntimeError("Alembic migrations failed for gamification-service")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection: сессия БД для FastAPI эндпоинтов."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
