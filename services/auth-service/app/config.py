"""
Конфигурация Auth Service
=========================
Автор: Dmitry Koval
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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
