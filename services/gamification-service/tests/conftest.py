"""
Pytest конфигурация для Gamification Service.

Использует SQLite in-memory с общим пулом StaticPool, чтобы все
сессии в рамках теста видели одни и те же таблицы.

Поскольку основные модели определены с явной Postgres-схемой
``gamification`` и ``Enum(create_type=False)``, перед созданием
таблиц мы патчим metadata так, чтобы оно работало под SQLite:
схема убирается, Enum-типы становятся обычными.
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import Enum as SAEnum
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

SERVICE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_ROOT))

# Перед импортом приложения подменяем переменные окружения,
# чтобы Settings подхватил sqlite-URL и стабильный JWT-секрет.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from app.config import settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


def _adapt_metadata_for_sqlite() -> None:
    """Делает metadata совместимой со SQLite: убирает schema из таблиц
    и из FK-ссылок, отключает create_type у Enum-колонок."""
    md = Base.metadata
    md.schema = None
    for table in list(md.tables.values()):
        table.schema = None
        for col in table.columns:
            t = col.type
            if isinstance(t, SAEnum):
                t.schema = None
                t.native_enum = False
                t.create_type = False
            for fk in col.foreign_keys:
                # FK target вида "gamification.quests.id" -> "quests.id"
                target = fk._colspec
                if isinstance(target, str) and "." in target:
                    parts = target.split(".")
                    if len(parts) == 3:
                        fk._colspec = ".".join(parts[1:])
    # после изменений ключей таблиц перестроим dict
    new_tables = {}
    for fullname, table in md.tables.items():
        # fullname может быть "gamification.quests" — нормализуем
        new_tables[table.name] = table
    md.tables = type(md.tables)(new_tables)


_adapt_metadata_for_sqlite()


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client(session_factory) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_db, None)


def _make_token(*, sub: str | None = None, is_superuser: bool = False, role: str | None = None) -> str:
    payload = {
        "sub": sub or str(uuid.uuid4()),
        "email": "user@example.com",
        "username": "user",
        "type": "access",
        "is_superuser": is_superuser,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    if role is not None:
        payload["role"] = role
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


@pytest.fixture
def admin_token() -> str:
    return _make_token(is_superuser=True)


@pytest.fixture
def user_token() -> str:
    return _make_token(is_superuser=False)


@pytest.fixture
def admin_headers(admin_token) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def user_headers(user_token) -> dict:
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def gateway_headers() -> dict:
    return {"X-Is-Admin": "true"}
