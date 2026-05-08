"""
Подключение к PostgreSQL (async SQLAlchemy)
==========================================
Автор: Dmitry Koval

Схема: auth  — изолирует таблицы auth-service от gamification-service
в рамках одной физической БД gamification_db.
"""

import subprocess
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

DB_SCHEMA = "auth"

# Async-движок
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Фабрика сессий
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Базовый класс для всех моделей auth-service.
    Все таблицы создаются в схеме 'auth'.
    """
    __table_args__ = {"schema": DB_SCHEMA}


async def ensure_schema() -> None:
    """Создаёт схему 'auth' если её нет — Alembic сам схему не создаёт."""
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))


def run_migrations() -> None:
    """Запускает alembic upgrade head синхронно.
    Идемпотентно: если миграции уже применены — ничего не делает.
    """
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=False,
    )
    if result.returncode != 0:
        raise RuntimeError("Alembic migrations failed")


async def get_db() -> AsyncSession:
    """Dependency для FastAPI — выдаёт сессию БД на время запроса"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
