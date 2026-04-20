"""
Безопасность Auth Service
=========================
JWT токены + bcrypt хэширование паролей.
Автор: Dmitry Koval
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.schemas import TokenPayload

# ===================================
# BCRYPT
# ===================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Хэширует пароль через bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет пароль против хэша"""
    return pwd_context.verify(plain_password, hashed_password)


# ===================================
# JWT
# ===================================

def create_access_token(user_id: uuid.UUID, email: str, username: str) -> str:
    """Создаёт краткосрочный access токен (30 минут)"""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "username": username,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: uuid.UUID, email: str, username: str) -> str:
    """Создаёт долгосрочный refresh токен (7 дней)"""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "username": username,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    """Декодирует и валидирует JWT токен"""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return TokenPayload(**payload)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или истёкший токен",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ===================================
# FASTAPI DEPENDENCY — ТЕКУЩИЙ ЮЗЕР
# ===================================

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    FastAPI dependency.
    Извлекает текущего пользователя из Bearer токена.
    Используется через Depends(get_current_user) в роутерах.
    """
    from app.models import User  # импорт здесь, чтобы избежать circular imports

    token_data = decode_token(credentials.credentials)

    if token_data.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ожидается access токен",
        )

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(token_data.sub))
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    return user


async def get_current_superuser(current_user=Depends(get_current_user)):
    """Dependency — только для суперпользователей"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )
    return current_user
