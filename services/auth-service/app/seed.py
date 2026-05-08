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
