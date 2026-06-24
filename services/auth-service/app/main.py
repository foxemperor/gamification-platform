"""
Auth Service — точка входа
================================
Zapusk: uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
Автор: Dmitry Koval
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import ensure_schema, run_migrations
from app.routers import admin, auth, members
from app.seed import create_superuser, create_dev_users

# ===================================
# ЛОГИРОВАНИЕ
# ===================================

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("auth-service")


# ===================================
# LIFESPAN (запуск / остановка)
# ===================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Auth Service запускается...")
    await ensure_schema()
    logger.info("⏳ Применяем миграции...")
    run_migrations()
    logger.info("✅ БД готова")
    try:
        await create_superuser()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"⚠️ Не удалось создать суперюзера: {e}")
    try:
        await create_dev_users()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"⚠️ Не удалось создать dev-пользователей: {e}")
    yield
    logger.info("🔴 Auth Service останавливается")


# ===================================
# FASTAPI APP
# ===================================

app = FastAPI(
    title="Auth Service",
    description="Микросервис аутентификации Gamification Platform",
    version="1.0.0",
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
app.include_router(members.router)


@app.get("/health", tags=["system"], summary="Проверка доступности")
async def health_check():
    return {
        "status": "ok",
        "service": "auth-service",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["system"], include_in_schema=False)
async def root():
    return {"message": "Auth Service is running. Docs: /docs"}
