"""
Auth Service — точка входа
================================
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import create_tables, get_db
from app.models import User
from app.routers import auth
from app.routers import admin
from app.security import get_password_hash

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("auth-service")


async def seed_superuser() -> None:
    """
    Создаёт суперюзера при первом старте если его ещё нет.
    Данные берутся из .env: SUPERUSER_EMAIL / SUPERUSER_USERNAME / SUPERUSER_PASSWORD
    """
    async for db in get_db():
        result = await db.execute(
            select(User).where(User.email == settings.SUPERUSER_EMAIL)
        )
        existing = result.scalar_one_or_none()
        if existing:
            logger.info(f"ℹ️  Superuser уже существует: {settings.SUPERUSER_EMAIL}")
            return

        superuser = User(
            email=settings.SUPERUSER_EMAIL,
            username=settings.SUPERUSER_USERNAME,
            hashed_password=get_password_hash(settings.SUPERUSER_PASSWORD),
            full_name="Администратор",
            role="admin",
            is_active=True,
            is_verified=True,
            is_superuser=True,
        )
        db.add(superuser)
        await db.commit()
        logger.info(f"✅ Superuser создан: {settings.SUPERUSER_EMAIL} (username: {settings.SUPERUSER_USERNAME})")
        return


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Auth Service запускается...")
    await create_tables()
    logger.info("✅ Таблицы БД готовы")
    await seed_superuser()
    yield
    logger.info("🔴 Auth Service останавливается")


app = FastAPI(
    title="Auth Service",
    description="Микросервис аутентификации Gamification Platform",
    version="1.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/health", tags=["system"], summary="Проверка доступности")
async def health_check():
    return {
        "status": "ok",
        "service": "auth-service",
        "version": "1.1.0",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["system"], include_in_schema=False)
async def root():
    return {"message": "Auth Service is running. Docs: /docs"}
