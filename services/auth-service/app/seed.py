"""
Seed — создание суперюзера при старте сервиса
=====================================================
Если суперюзер уже есть — ничего не делает.
"""

import logging
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import User
from app.security import hash_password
from app.config import settings

logger = logging.getLogger("auth-service.seed")


async def create_superuser() -> None:
    """Idемпотентно создаёт суперюзера если его нет."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == settings.SUPERUSER_EMAIL)
        )
        if result.scalar_one_or_none():
            logger.info(f"✅ Superuser already exists: {settings.SUPERUSER_EMAIL}")
            return

        superuser = User(
            email=settings.SUPERUSER_EMAIL,
            username=settings.SUPERUSER_USERNAME,
            hashed_password=hash_password(settings.SUPERUSER_PASSWORD),
            full_name="Administrator",
            role="admin",
            is_active=True,
            is_verified=True,
            is_superuser=True,
        )
        session.add(superuser)
        await session.commit()
        logger.info(f"🌱 Superuser created: {settings.SUPERUSER_EMAIL}")


async def create_dev_user() -> None:
    """
    Идемпотентно создаёт обычного пользователя для локальной разработки,
    чтобы можно было быстро сравнить UI админа и сотрудника.

    Создаётся ТОЛЬКО когда ENVIRONMENT == "development" и SEED_DEV_USER == True.
    Никаких реальных персональных данных не используется.
    """
    if settings.ENVIRONMENT != "development" or not settings.SEED_DEV_USER:
        return

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == settings.DEV_USER_EMAIL)
        )
        if result.scalar_one_or_none():
            logger.info(
                f"✅ Dev user already exists: {settings.DEV_USER_EMAIL} "
                f"(login: {settings.DEV_USER_EMAIL} / password: {settings.DEV_USER_PASSWORD})"
            )
            return

        dev_user = User(
            email=settings.DEV_USER_EMAIL,
            username=settings.DEV_USER_USERNAME,
            hashed_password=hash_password(settings.DEV_USER_PASSWORD),
            full_name="Dev User",
            role="employee",
            is_active=True,
            is_verified=True,
            is_superuser=False,
        )
        session.add(dev_user)
        await session.commit()
        logger.info(
            f"🌱 Dev user created: {settings.DEV_USER_EMAIL} "
            f"(login: {settings.DEV_USER_EMAIL} / password: {settings.DEV_USER_PASSWORD})"
        )
