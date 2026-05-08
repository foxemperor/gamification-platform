"""
Подключение к PostgreSQL (async SQLAlchemy)
==========================================
Автор: Dmitry Koval

Схема: auth  — изолирует таблицы auth-service от gamification-service
в рамках одной физической БД gamification_db.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, mapped_column
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


async def create_tables():
    """Создаёт схему 'auth' (если нет) и все таблицы при старте."""
    async with engine.begin() as conn:
        # Создаём схему если её нет
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))
        # Устанавливаем search_path чтобы alembic_version тоже был в схеме
        await conn.execute(text(f'SET search_path TO "{DB_SCHEMA}", public'))
        from app import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
