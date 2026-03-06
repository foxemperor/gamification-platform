"""
API Gateway - Главная точка входа для Gamification Platform
============================================================

Этот модуль создаёт FastAPI приложение, которое:
- Принимает все входящие HTTP запросы
- Маршрутизирует запросы к соответствующим микросервисам
- Обеспечивает аутентификацию и авторизацию
- Логирует все запросы
- Предоставляет WebSocket для real-time уведомлений

Author: Dmitry Koval
Date: 06.03.2026
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.middleware.logging import LoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import health, auth, users, quests, leaderboard, integrations
import logging
import sys

# ===================================
# НАСТРОЙКА ЛОГИРОВАНИЯ
# ===================================

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


# ===================================
# LIFECYCLE EVENTS
# ===================================

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Управление жизненным циклом приложения:
    - Startup: подключение к БД, Redis, инициализация сервисов
    - Shutdown: закрытие соединений
    """
    logger.info("🚀 Starting Gamification Platform API Gateway...")
    logger.info(f"📍 Environment: {settings.ENVIRONMENT}")
    logger.info(f"🔧 Debug mode: {settings.DEBUG}")
    
    # TODO: Инициализация подключений к БД и Redis
    # await database.connect()
    # await redis.connect()
    
    yield
    
    logger.info("🛑 Shutting down API Gateway...")
    # TODO: Закрытие подключений
    # await database.disconnect()
    # await redis.disconnect()


# ===================================
# FASTAPI APPLICATION
# ===================================

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "API Gateway для платформы геймификации распределённых команд. "
        "Обеспечивает маршрутизацию запросов к микросервисам: "
        "Auth, Gamification, Integration, Analytics."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ===================================
# MIDDLEWARE
# ===================================

# CORS - разрешаем запросы с фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Кастомное логирование запросов
app.add_middleware(LoggingMiddleware)

# Rate limiting для защиты от DDoS
if settings.ENVIRONMENT == "production":
    app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)


# ===================================
# EXCEPTION HANDLERS
# ===================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Обработчик HTTP исключений
    """
    logger.error(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Обработчик ошибок валидации Pydantic
    """
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": True,
            "message": "Ошибка валидации данных",
            "details": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Обработчик всех остальных исключений
    """
    logger.exception(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "message": "Внутренняя ошибка сервера",
            "detail": str(exc) if settings.DEBUG else "Internal server error",
        },
    )


# ===================================
# РОУТЕРЫ
# ===================================

# Health check эндпоинты
app.include_router(health.router, tags=["Health"])

# Аутентификация (проксирует на auth-service)
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

# Пользователи
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])

# Квесты и геймификация
app.include_router(quests.router, prefix="/api/v1/quests", tags=["Quests"])

# Лидерборды
app.include_router(leaderboard.router, prefix="/api/v1/leaderboard", tags=["Leaderboard"])

# Интеграции (GitHub, Jira, Slack)
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations"])


# ===================================
# ROOT ENDPOINT
# ===================================

@app.get("/", tags=["Root"])
async def root():
    """
    Корневой эндпоинт с информацией об API
    """
    return {
        "message": "🎮 Gamification Platform API Gateway",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health",
        "services": {
            "auth": settings.AUTH_SERVICE_URL,
            "gamification": settings.GAMIFICATION_SERVICE_URL,
            "integration": settings.INTEGRATION_SERVICE_URL,
            "analytics": settings.ANALYTICS_SERVICE_URL,
        },
    }


# ===================================
# ENTRYPOINT FOR UVICORN
# ===================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_GATEWAY_HOST,
        port=settings.API_GATEWAY_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
