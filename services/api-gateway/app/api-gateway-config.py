"""
Конфигурация API Gateway
=========================

Все настройки загружаются из переменных окружения через pydantic-settings.
Позволяет легко переключаться между dev/prod окружениями.

Author: Dmitry Koval
Date: 06.03.2026
"""

from typing import List
from pydantic import Field, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Настройки приложения
    
    Все значения загружаются из переменных окружения или .env файла
    """
    
    # ===================================
    # ОБЩИЕ НАСТРОЙКИ
    # ===================================
    PROJECT_NAME: str = Field(
        default="Gamification Platform",
        description="Название проекта"
    )
    
    ENVIRONMENT: str = Field(
        default="development",
        description="Окружение: development, staging, production"
    )
    
    DEBUG: bool = Field(
        default=True,
        description="Режим отладки"
    )
    
    @validator("DEBUG", pre=True)
    def set_debug_from_environment(cls, v, values):
        """Автоматически отключаем DEBUG в production"""
        if values.get("ENVIRONMENT") == "production":
            return False
        return v
    
    # ===================================
    # API GATEWAY
    # ===================================
    API_GATEWAY_HOST: str = Field(
        default="0.0.0.0",
        description="Хост для API Gateway"
    )
    
    API_GATEWAY_PORT: int = Field(
        default=8000,
        description="Порт для API Gateway"
    )
    
    # ===================================
    # БАЗА ДАННЫХ (PostgreSQL)
    # ===================================
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://gamification_user:password@localhost:5432/gamification_db",
        description="URL подключения к PostgreSQL"
    )
    
    DB_ECHO: bool = Field(
        default=False,
        description="Логирование SQL запросов"
    )
    
    # ===================================
    # REDIS
    # ===================================
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="URL подключения к Redis"
    )
    
    REDIS_TTL_SECONDS: int = Field(
        default=3600,
        description="Время жизни кэша в секундах (1 час)"
    )
    
    # ===================================
    # JWT ТОКЕНЫ
    # ===================================
    SECRET_KEY: str = Field(
        default="your_super_secret_key_change_in_production",
        description="Секретный ключ для подписи JWT токенов"
    )
    
    ALGORITHM: str = Field(
        default="HS256",
        description="Алгоритм шифрования JWT"
    )
    
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30,
        description="Время жизни access токена (минуты)"
    )
    
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(
        default=7,
        description="Время жизни refresh токена (дни)"
    )
    
    # ===================================
    # CORS
    # ===================================
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000"],
        description="Разрешённые origins для CORS"
    )
    
    CORS_CREDENTIALS: bool = Field(
        default=True,
        description="Разрешить credentials в CORS"
    )
    
    # ===================================
    # МИКРОСЕРВИСЫ (внутренние URL)
    # ===================================
    AUTH_SERVICE_URL: str = Field(
        default="http://auth-service:8001",
        description="URL Auth Service"
    )
    
    GAMIFICATION_SERVICE_URL: str = Field(
        default="http://gamification-service:8002",
        description="URL Gamification Service"
    )
    
    INTEGRATION_SERVICE_URL: str = Field(
        default="http://integration-service:8003",
        description="URL Integration Service"
    )
    
    ANALYTICS_SERVICE_URL: str = Field(
        default="http://analytics-service:8004",
        description="URL Analytics Service"
    )
    
    # ===================================
    # CELERY
    # ===================================
    CELERY_BROKER_URL: str = Field(
        default="redis://localhost:6379/1",
        description="Celery broker URL"
    )
    
    CELERY_RESULT_BACKEND: str = Field(
        default="redis://localhost:6379/2",
        description="Celery result backend URL"
    )
    
    # ===================================
    # ЛОГИРОВАНИЕ
    # ===================================
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Уровень логирования: DEBUG, INFO, WARNING, ERROR, CRITICAL"
    )
    
    LOG_FORMAT: str = Field(
        default="json",
        description="Формат логов: json или text"
    )
    
    # ===================================
    # ИНТЕГРАЦИИ - GITHUB
    # ===================================
    GITHUB_CLIENT_ID: str = Field(
        default="",
        description="GitHub OAuth Client ID"
    )
    
    GITHUB_CLIENT_SECRET: str = Field(
        default="",
        description="GitHub OAuth Client Secret"
    )
    
    GITHUB_WEBHOOK_SECRET: str = Field(
        default="",
        description="GitHub Webhook Secret"
    )
    
    # ===================================
    # ИНТЕГРАЦИИ - JIRA
    # ===================================
    JIRA_CLIENT_ID: str = Field(
        default="",
        description="Jira OAuth Client ID"
    )
    
    JIRA_CLIENT_SECRET: str = Field(
        default="",
        description="Jira OAuth Client Secret"
    )
    
    # ===================================
    # ИНТЕГРАЦИИ - SLACK
    # ===================================
    SLACK_BOT_TOKEN: str = Field(
        default="",
        description="Slack Bot Token"
    )
    
    SLACK_SIGNING_SECRET: str = Field(
        default="",
        description="Slack Signing Secret"
    )
    
    # ===================================
    # МОНИТОРИНГ
    # ===================================
    SENTRY_DSN: str = Field(
        default="",
        description="Sentry DSN для отслеживания ошибок"
    )
    
    ENABLE_METRICS: bool = Field(
        default=False,
        description="Включить сбор метрик (Prometheus)"
    )
    
    # ===================================
    # RATE LIMITING
    # ===================================
    RATE_LIMIT_ENABLED: bool = Field(
        default=True,
        description="Включить rate limiting"
    )
    
    RATE_LIMIT_MAX_REQUESTS: int = Field(
        default=100,
        description="Максимум запросов в окне"
    )
    
    RATE_LIMIT_WINDOW_SECONDS: int = Field(
        default=60,
        description="Окно времени для rate limiting (секунды)"
    )
    
    class Config:
        """Конфигурация Pydantic Settings"""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# ===================================
# SINGLETON INSTANCE
# ===================================

settings = Settings()


# ===================================
# ВАЛИДАЦИЯ КРИТИЧЕСКИХ НАСТРОЕК
# ===================================

def validate_settings():
    """
    Проверка критических настроек при запуске
    """
    errors = []
    
    # В production SECRET_KEY должен быть изменён
    if settings.ENVIRONMENT == "production":
        if "change" in settings.SECRET_KEY.lower():
            errors.append("SECRET_KEY не должен содержать дефолтное значение в production!")
        
        if settings.DEBUG:
            errors.append("DEBUG должен быть False в production!")
        
        if not settings.SENTRY_DSN:
            errors.append("Рекомендуется настроить SENTRY_DSN для production!")
    
    if errors:
        raise ValueError(
            "Критические ошибки конфигурации:\n" + "\n".join(f"- {e}" for e in errors)
        )


# Валидируем при импорте модуля
if settings.ENVIRONMENT == "production":
    validate_settings()
