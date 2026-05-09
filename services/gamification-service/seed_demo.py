"""
Seed-скрипт: создаёт тестовый квест + бейдж и назначает их devuser.

Запуск изнутри контейнера gamification-service:
    python seed_demo.py [--devuser-id UUID]

Если --devuser-id не указан — скрипт спросит его у Аутентификационного сервиса (получает
первого пользователя с username='devuser').
Автор: Dmitry Koval
"""

import argparse
import asyncio
import os
import sys

import aiohttp
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# ---- настройки ----
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://gp_user:gp_password@localhost:5433/gamification_db",
)
AUTH_URL = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")

# ---- ORM модели ----
sys.path.insert(0, os.path.dirname(__file__))
from app.models import (
    Badge, BadgeRarity, Quest, QuestDifficulty, QuestStatus, QuestType,
    UserBadge, UserQuest, UserQuestStatus,
)
from app.database import DB_SCHEMA  # noqa

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _get_devuser_id() -> str:
    """Получает UUID devuser через Auth Service."""
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{AUTH_URL}/api/v1/auth/users") as resp:
            if resp.status != 200:
                raise RuntimeError(
                    f"Не удалось получить пользователей из auth-service: HTTP {resp.status}"
                )
            users = await resp.json()
    for u in users.get("items", users if isinstance(users, list) else []):
        if u.get("username") == "devuser":
            return u["id"]
    raise RuntimeError("Пользователь 'devuser' не найден в auth-service.")


async def seed(devuser_id: str) -> None:
    async with async_session() as db:
        print(f"👤 devuser_id = {devuser_id}")

        # ---- Тестовый квест ----
        quest_title = "Первый шаг 🚀"
        existing_quest = await db.scalar(
            select(Quest).where(Quest.title == quest_title)
        )
        if existing_quest:
            quest = existing_quest
            print("ℹ️  Квест 'Первый шаг' уже существует, пропускаем создание.")
        else:
            quest = Quest(
                title=quest_title,
                description="Войди в систему и ознакомься с платформой геймификации.",
                quest_type=QuestType.PERSONAL,
                difficulty=QuestDifficulty.EASY,
                status=QuestStatus.ACTIVE,
                xp_reward=50,
                coins_reward=10,
            )
            db.add(quest)
            await db.flush()
            print(f"✅ Квест создан: {quest.id}")

        # ---- Назначаем devuser квест (если ещё не назначен) ----
        existing_uq = await db.scalar(
            select(UserQuest)
            .where(UserQuest.user_id == devuser_id)
            .where(UserQuest.quest_id == quest.id)
        )
        if existing_uq:
            print("ℹ️  UserQuest уже существует, пропускаем.")
        else:
            uq = UserQuest(
                user_id=devuser_id,
                quest_id=quest.id,
                status=UserQuestStatus.IN_PROGRESS,
                progress=0,
                target=1,
                is_viewed=False,   # непрочитанный — будет badge в sidebar
            )
            db.add(uq)
            print("✅ UserQuest назначен devuser")

        # ---- Тестовый бейдж ----
        badge_name = "Первопроходец"
        existing_badge = await db.scalar(
            select(Badge).where(Badge.name == badge_name)
        )
        if existing_badge:
            badge = existing_badge
            print("ℹ️  Бейдж 'Первопроходец' уже существует, пропускаем создание.")
        else:
            badge = Badge(
                name=badge_name,
                description="Выдаётся за первый вход в систему",
                icon_url="🏆",
                rarity=BadgeRarity.COMMON,
                condition_type=None,   # ручная выдача
                condition_value=None,
                xp_bonus=25,
            )
            db.add(badge)
            await db.flush()
            print(f"✅ Бейдж создан: {badge.id}")

        # ---- Назначаем devuser бейдж (если ещё не выдан) ----
        existing_ub = await db.scalar(
            select(UserBadge)
            .where(UserBadge.user_id == devuser_id)
            .where(UserBadge.badge_id == badge.id)
        )
        if existing_ub:
            print("ℹ️  UserBadge уже существует, пропускаем.")
        else:
            ub = UserBadge(
                user_id=devuser_id,
                badge_id=badge.id,
                is_revoked=False,
                is_new=True,   # непрочитанный — будет badge в sidebar
            )
            db.add(ub)
            print("✅ UserBadge назначен devuser")

        await db.commit()
        print("🎉 Seed выполнен успешно!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Сеед для demo/devuser")
    parser.add_argument("--devuser-id", default=None, help="UUID devuser")
    args = parser.parse_args()

    async def main():
        uid = args.devuser_id
        if not uid:
            print("🔍 Получаем devuser_id из auth-service...")
            uid = await _get_devuser_id()
        await seed(uid)

    asyncio.run(main())
