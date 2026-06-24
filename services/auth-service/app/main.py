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
from app.seed import create_dev_user, create_superuser

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
    # 1. Создаём схему если её нет (Alembic это не делает)
    await ensure_schema()
    # 2. Применяем все миграции (идемпотентно)
    logger.info("⏳ Применяем миграции...")
    run_migrations()
    logger.info("✅ БД готова")
    # 3. Сидим суперюзера (идемпотентно)
    try:
        await create_superuser()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"⚠️ Не удалось создать суперюзера: {e}")
    # 4. Только в development — сидим тестового пользователя (идемпотентно)
    try:
        await create_dev_user()
    except Exception as e:  # noqa: BLE001
        logger.warning(f"⚠️ Не удалось создать dev-пользователя: {e}")
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


# ===================================
# CORS
# ===================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================================
# РОУТЕРЫ
# ===================================

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(members.router)


# ===================================
# СИСТЕМНЫЕ ЭНДПОИНТЫ
# ===================================

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
