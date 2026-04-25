"""
Gamification Service — подключение к базе данных
=================================================
Async SQLAlchemy + PostgreSQL через asyncpg.
Автор: Dmitry Koval
"""

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger("gamification-service.database")

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
    pass


# ===================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ===================================

async def create_tables() -> None:
    """Создаёт все таблицы при старте сервиса."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Таблицы Gamification Service созданы")


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
