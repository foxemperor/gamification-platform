"""
Gamification Service — подключение к базе данных
=================================================
Async SQLAlchemy + PostgreSQL через asyncpg.
Автор: Dmitry Koval

Схема: gamification — изолирует таблицы gamification-service
от auth-service в рамках одной физической БД gamification_db.
"""

import logging
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

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

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

async def create_tables() -> None:
    """Создаёт схему 'gamification' (если нет) и все таблицы при старте."""
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))
        await conn.execute(text(f'SET search_path TO "{DB_SCHEMA}", public'))
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Схема и таблицы Gamification Service готовы")


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
