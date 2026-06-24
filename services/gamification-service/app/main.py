"""
Gamification Service — точка входа
===================================
FastAPI приложение с lifespan, CORS, роутерами
и health-check эндпоинтами.
Автор: Dmitry Koval
"""

import logging
import sys
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.database import ensure_schema, run_migrations, engine
from app.routers import quests, leaderboard, admin
from app.routers import notifications
from app.routers import system_metrics
from app.routers import character
from app.routers import members

# ===================================
# ЛОГИРОВАНИЕ
# ===================================

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("gamification-service")


# ===================================
# LIFESPAN — старт / остановка
# ===================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Запуск Gamification Service...")

    # 1. Создаём схему если её нет (Alembic это не делает)
    await ensure_schema()

    # 2. Применяем все миграции (идемпотентно)
    logger.info("⏳ Применяем миграции...")
    run_migrations()
    logger.info("✅ БД готова")

    # 3. Проверяем Redis
    try:
        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis.ping()
        await redis.close()
        logger.info("✅ Redis доступен")
    except Exception as e:
        logger.warning(f"⚠️  Redis недоступен: {e}")

    logger.info(f"✅ {settings.SERVICE_NAME} запущен в режиме '{settings.ENVIRONMENT}'")

    yield

    logger.info("🛑 Остановка Gamification Service...")
    await engine.dispose()
    logger.info("✅ Соединения с БД закрыты")


# ===================================
# ПРИЛОЖЕНИЕ
# ===================================

app = FastAPI(
    title="Gamification Service",
    description=(
        "Микросервис геймификации: квесты, XP, бейджи, лидерборды.\n\n"
        "Реализует механики прогрессии по формуле степенного закона (Power Law): "
        "XP(N) = BASE_XP × N^XP_MULTIPLIER"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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

app.include_router(quests.router)
app.include_router(leaderboard.router)
app.include_router(admin.router)
app.include_router(notifications.router)
app.include_router(system_metrics.router)
app.include_router(character.router)
app.include_router(members.router)


# ===================================
# HEALTH-CHECK ЭНДПОИНТЫ
# ===================================

@app.get("/health", tags=["health"], summary="Базовая проверка сервиса")
async def health():
    return {"status": "ok", "service": settings.SERVICE_NAME}


@app.get("/health/ready", tags=["health"], summary="Проверка готовности (БД + Redis)")
async def health_ready():
    checks = {}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {e}"
    try:
        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis.ping()
        await redis.close()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"
    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={"status": "ready" if all_ok else "degraded", "checks": checks},
    )


@app.get("/", tags=["health"], include_in_schema=False)
async def root():
    return {"service": settings.SERVICE_NAME, "version": "1.0.0", "docs": "/docs"}
