"""
Gamification Service — конфигурация
====================================
Все настройки берутся из переменных окружения (.env).
Автор: Dmitry Koval
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # === Сервис ===
    SERVICE_NAME: str = "gamification-service"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # === База данных ===
    DATABASE_URL: str = "postgresql+asyncpg://gamification_user:gamification_pass@postgres:5432/gamification_db"

    # === Redis ===
    REDIS_URL: str = "redis://redis:6379/1"

    # === Auth Service (для верификации JWT) ===
    AUTH_SERVICE_URL: str = "http://auth-service:8001"
    JWT_SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"

    # === CORS ===
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost:8001",
    ]

    # === Геймификация: параметры прогрессии ===
    # XP необходимый для уровня N = BASE_XP * (N ^ XP_MULTIPLIER)
    BASE_XP_PER_LEVEL: int = 100
    XP_LEVEL_MULTIPLIER: float = 1.5

    # Максимальный уровень
    MAX_LEVEL: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
