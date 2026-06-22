"""
Gamification Service — конфигурация
====================================
Все настройки берутся из переменных окружения (.env).
Автор: Dmitry Koval
"""

import os

from pydantic_settings import BaseSettings
from functools import lru_cache


# Дефолт JWT-секрета должен совпадать с auth-service (см. services/auth-service/app/config.py).
# Иначе токены, выписанные auth-service, не проходят верификацию здесь и пользователь
# получает 401 на каждом админ-запросе.
_DEFAULT_JWT_SECRET = "your_super_secret_key_change_in_production"
_DEFAULT_JWT_ALGORITHM = "HS256"


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
    # JWT_SECRET_KEY имеет приоритет; если он не выставлен — используется SECRET_KEY
    # (это имя переменной, которое выставляет docker-compose для всех сервисов).
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY") or _DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM") or os.getenv("ALGORITHM") or _DEFAULT_JWT_ALGORITHM

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
