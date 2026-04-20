"""
Роутер аутентификации
======================
Эндпоинты:
  POST /api/v1/auth/register  — регистрация
  POST /api/v1/auth/login     — вход
  GET  /api/v1/auth/me        — текущий пользователь
  POST /api/v1/auth/refresh   — обновление токена
  POST /api/v1/auth/logout    — выход (инвалидация refresh токена)
Автор: Dmitry Koval
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.schemas import (
    UserRegister,
    UserLogin,
    UserUpdate,
    UserResponse,
    Token,
    AuthResponse,
    RefreshTokenRequest,
    MessageResponse,
)
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ===================================
# РЕГИСТРАЦИЯ
# ===================================

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Регистрация нового пользователя",
)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    # Проверяем уникальность email
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким email уже существует",
        )

    # Проверяем уникальность username
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь с таким username уже существует",
        )

    # Создаём пользователя
    user = User(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    await db.flush()  # получаем id до commit

    # Генерируем токены
    access_token = create_access_token(user.id, user.email, user.username)
    refresh_token = create_refresh_token(user.id, user.email, user.username)

    await db.commit()
    await db.refresh(user)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=Token(
            access_token=access_token,
            refresh_token=refresh_token,
        ),
    )


# ===================================
# ВХОД
# ===================================

@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Вход в систему",
)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    # Ищем пользователя по email
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    # Обновляем время последнего входа
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(user.id, user.email, user.username)
    refresh_token = create_refresh_token(user.id, user.email, user.username)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=Token(
            access_token=access_token,
            refresh_token=refresh_token,
        ),
    )


# ===================================
# ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
# ===================================

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Данные текущего пользователя",
)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Обновление профиля",
)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.bio is not None:
        current_user.bio = data.bio
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


# ===================================
# ОБНОВЛЕНИЕ ТОКЕНА
# ===================================

@router.post(
    "/refresh",
    response_model=Token,
    summary="Обновление access токена",
)
async def refresh_token(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    token_data = decode_token(data.refresh_token)

    if token_data.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ожидается refresh токен",
        )

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(token_data.sub))
    )
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или деактивирован",
        )

    return Token(
        access_token=create_access_token(user.id, user.email, user.username),
        refresh_token=create_refresh_token(user.id, user.email, user.username),
    )


# ===================================
# ВЫХОД
# ===================================

@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Выход из системы",
)
async def logout(current_user: User = Depends(get_current_user)):
    # В текущей реализации токены stateless (JWT).
    # В будущем: добавить Redis blacklist для инвалидации токенов.
    return MessageResponse(message="Вы успешно вышли из системы")
