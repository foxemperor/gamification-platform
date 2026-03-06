"""
Logging Middleware
==================

Middleware для логирования всех HTTP запросов и ответов.
Записывает:
- Метод и путь запроса
- Время обработки
- Статус код ответа
- IP адрес клиента
- User Agent

Author: Dmitry Koval
Date: 06.03.2026
"""

import logging
import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware для логирования HTTP запросов
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Обрабатывает запрос и логирует информацию
        """
        # Фиксируем время начала
        start_time = time.time()
        
        # Извлекаем данные запроса
        method = request.method
        path = request.url.path
        client_host = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Логируем входящий запрос
        logger.info(
            f"➡️  Incoming request: {method} {path} from {client_host}",
            extra={
                "method": method,
                "path": path,
                "client_ip": client_host,
                "user_agent": user_agent,
            },
        )
        
        try:
            # Передаём запрос дальше
            response = await call_next(request)
            
            # Вычисляем время обработки
            process_time = time.time() - start_time
            
            # Логируем ответ
            logger.info(
                f"⬅️  Response: {method} {path} -> {response.status_code} ({process_time:.3f}s)",
                extra={
                    "method": method,
                    "path": path,
                    "status_code": response.status_code,
                    "process_time": process_time,
                    "client_ip": client_host,
                },
            )
            
            # Добавляем заголовок с временем обработки
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
        
        except Exception as e:
            # Логируем ошибку
            process_time = time.time() - start_time
            logger.error(
                f"❌ Error processing request: {method} {path} - {str(e)} ({process_time:.3f}s)",
                extra={
                    "method": method,
                    "path": path,
                    "error": str(e),
                    "process_time": process_time,
                    "client_ip": client_host,
                },
                exc_info=True,
            )
            raise
