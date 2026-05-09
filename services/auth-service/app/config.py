"""
Конфигурация Auth Service
=========================
"""

from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Общие
    PROJECT_NAME: str = Field(default="Auth Service")
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=True)

    # База данных
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://gamification_user:password@localhost:5432/gamification_db"
    )
    DB_ECHO: bool = Field(default=False)

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # JWT
    SECRET_KEY: str = Field(default="your_super_secret_key_change_in_production")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # CORS
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000"]
    )

    # Логирование
    LOG_LEVEL: str = Field(default="INFO")

    # ===================================
    # SUPERUSER (создаётся автоматически при старте)
    # ===================================
    SUPERUSER_EMAIL: str = Field(default="admin@gamequest.com")
    SUPERUSER_USERNAME: str = Field(default="admin")
    SUPERUSER_PASSWORD: str = Field(default="ChangeMe123!")

    # ===================================
    # DEV USER — простой сотрудник, чтобы разработчик мог
    # сразу сравнить интерфейс админа и обычного пользователя.
    # Создаётся ТОЛЬКО когда ENVIRONMENT == "development".
    # ===================================
    SEED_DEV_USER: bool = Field(default=True)
    DEV_USER_EMAIL: str = Field(default="dev@test.com")
    DEV_USER_USERNAME: str = Field(default="devuser")
    DEV_USER_PASSWORD: str = Field(default="DevPass123!")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
