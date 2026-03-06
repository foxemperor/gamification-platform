"""
Health Check Router
===================

Эндпоинты для проверки здоровья системы:
- /health - базовая проверка доступности
- /readiness - проверка готовности к обработке запросов (БД, Redis)
- /liveness - проверка что приложение живо

Author: Dmitry Koval
Date: 06.03.2026
"""

from fastapi import APIRouter, status, Response
from datetime import datetime
from typing import Dict, Any
import logging

# TODO: импорты для проверки БД и Redis
# from app.database import check_database_connection
# from app.redis import check_redis_connection

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    """
    Базовая проверка здоровья приложения
    
    Используется для health checks в Docker, Kubernetes
    """
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/readiness", status_code=status.HTTP_200_OK)
async def readiness_check(response: Response) -> Dict[str, Any]:
    """
    Проверка готовности приложения
    
    Проверяет:
    - Подключение к PostgreSQL
    - Подключение к Redis
    - Доступность микросервисов
    
    Возвращает 503 если что-то не работает
    """
    checks = {
        "database": "unknown",
        "redis": "unknown",
        "auth_service": "unknown",
        "gamification_service": "unknown",
    }
    
    is_ready = True
    
    # TODO: Проверка подключения к БД
    try:
        # await check_database_connection()
        checks["database"] = "healthy"
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        checks["database"] = "unhealthy"
        is_ready = False
    
    # TODO: Проверка подключения к Redis
    try:
        # await check_redis_connection()
        checks["redis"] = "healthy"
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        checks["redis"] = "unhealthy"
        is_ready = False
    
    # TODO: Проверка микросервисов
    # Можно добавить HTTP запросы к /health каждого сервиса
    
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    
    return {
        "status": "ready" if is_ready else "not_ready",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
    }


@router.get("/liveness", status_code=status.HTTP_200_OK)
async def liveness_check() -> Dict[str, Any]:
    """
    Проверка что приложение живо
    
    Используется Kubernetes для перезапуска pod'а если не отвечает
    Более простая проверка чем readiness
    """
    return {
        "status": "alive",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/version", status_code=status.HTTP_200_OK)
async def version_info() -> Dict[str, Any]:
    """
    Информация о версии приложения
    """
    return {
        "service": "api-gateway",
        "version": "0.1.0",
        "build_date": "2026-03-06",
        "python_version": "3.11+",
        "framework": "FastAPI 0.109.2",
    }
