"""
Auth Service — FastAPI application
====================================
Автор: Dmitry Koval
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, admin

import logging, sys

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    logger.info("🚀 Starting Auth Service...")
    # Создаём таблицы если их нет (безопасно — Alembic приоритетнее в prod)
    from app.database import create_tables
    await create_tables()
    # Сеед суперюзера
    from app.seed import create_superuser
    await create_superuser()
    yield
    logger.info("🛑 Auth Service stopped.")


app = FastAPI(
    title="Auth Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роутеры
app.include_router(auth.router)
app.include_router(admin.router)


@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "service": "auth-service"}
