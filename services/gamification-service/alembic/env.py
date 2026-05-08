"""
Alembic env.py — Gamification Service
async-режим через asyncpg
"""

import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Импорт всех моделей чтобы Alembic видел таблицы
from app.database import Base
from app.models import (  # noqa: F401
    Quest, UserQuest,
    Badge, UserBadge,
    XPTransaction,
    LeaderboardSnapshot,
    CharacterType, Character,
    CosmeticItem, CharacterEquipment, UnlockedCosmetic,
)
from app.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return settings.DATABASE_URL


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(get_url(), echo=False)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


run_migrations_online()
