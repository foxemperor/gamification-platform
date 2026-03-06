"""
Rate Limiting Middleware
========================

Middleware для ограничения количества запросов от одного клиента.
Защищает от DDoS атак и злоупотребления API.

Использует Redis для хранения счётчиков запросов.

Author: Dmitry Koval
Date: 06.03.2026
"""

import logging
from typing import Callable
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# TODO: импорт Redis клиента
# from app.redis import get_redis_client

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware для rate limiting
    
    Args:
        max_requests: Максимальное количество запросов в окне
        window_seconds: Размер окна в секундах
    """
    
    def __init__(
        self,
        app,
        max_requests: int = 100,
        window_seconds: int = 60,
    ):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Проверяет rate limit перед обработкой запроса
        """
        # Получаем IP клиента
        client_ip = request.client.host if request.client else "unknown"
        
        # Пропускаем rate limiting для health checks
        if request.url.path in ["/health", "/readiness", "/liveness"]:
            return await call_next(request)
        
        # TODO: Реализовать проверку rate limit через Redis
        # redis = await get_redis_client()
        # key = f"rate_limit:{client_ip}"
        
        # try:
        #     # Получаем текущее количество запросов
        #     current_requests = await redis.get(key)
        #     
        #     if current_requests is None:
        #         # Первый запрос в окне
        #         await redis.setex(key, self.window_seconds, 1)
        #     else:
        #         current_requests = int(current_requests)
        #         
        #         if current_requests >= self.max_requests:
        #             # Превышен лимит
        #             logger.warning(
        #                 f"⚠️  Rate limit exceeded for {client_ip}: "
        #                 f"{current_requests}/{self.max_requests}"
        #             )
        #             return JSONResponse(
        #                 status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        #                 content={
        #                     "error": True,
        #                     "message": "Слишком много запросов. Попробуйте позже.",
        #                     "retry_after": self.window_seconds,
        #                 },
        #                 headers={"Retry-After": str(self.window_seconds)},
        #             )
        #         
        #         # Увеличиваем счётчик
        #         await redis.incr(key)
        # 
        # except Exception as e:
        #     logger.error(f"Rate limit check failed: {e}")
        #     # В случае ошибки пропускаем запрос (fail-open)
        
        # Обрабатываем запрос
        response = await call_next(request)
        
        # TODO: Добавляем заголовки с информацией о rate limit
        # response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        # response.headers["X-RateLimit-Remaining"] = str(
        #     max(0, self.max_requests - int(current_requests or 0))
        # )
        # response.headers["X-RateLimit-Reset"] = str(self.window_seconds)
        
        return response


# ===================================
# ДЕКОРАТОР ДЛЯ RATE LIMIT НА ЭНДПОИНТАХ
# ===================================

def rate_limit(max_requests: int = 10, window_seconds: int = 60):
    """
    Декоратор для применения rate limit к конкретным эндпоинтам
    
    Использование:
        @app.get("/api/sensitive")
        @rate_limit(max_requests=5, window_seconds=60)
        async def sensitive_endpoint():
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # TODO: Реализовать проверку rate limit
            return await func(*args, **kwargs)
        return wrapper
    return decorator
