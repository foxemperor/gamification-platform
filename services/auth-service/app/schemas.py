"""
Pydantic схемы Auth Service
============================
Схемы для валидации запросов и формирования ответов API.
"""

import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


# ===================================
# USER SCHEMAS
# ===================================

class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    full_name: Optional[str] = Field(None, max_length=100)


class UserRegister(UserBase):
    """Схема для регистрации нового пользователя"""
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Пароль должен содержать хотя бы одну заглавную букву")
        if not any(c.isdigit() for c in v):
            raise ValueError("Пароль должен содержать хотя бы одну цифру")
        return v


class UserLogin(BaseModel):
    """Схема для входа в систему"""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Схема для обновления профиля"""
    full_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    """Схема ответа с данными пользователя"""
    id: uuid.UUID
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    xp: int
    level: int
    coins: int
    xp_to_next_level: int
    xp_progress_percent: float
    is_active: bool
    is_verified: bool
    is_superuser: bool
    role: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ===================================
# ADMIN SCHEMAS
# ===================================

class AdminUserCreate(BaseModel):
    """Создание пользователя администратором"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=100)
    role: Literal["employee", "manager", "admin"] = "employee"
    is_active: bool = True
    is_verified: bool = True


class AdminUserUpdate(BaseModel):
    """Редактирование пользователя администратором"""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    role: Optional[Literal["employee", "manager", "admin"]] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class AdminUserResponse(UserResponse):
    """Расширенный ответ для admin — включает is_superuser"""
    is_superuser: bool
    last_login_at: Optional[datetime] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminUsersListResponse(BaseModel):
    """Список пользователей с пагинацией"""
    total: int
    page: int
    per_page: int
    items: list[AdminUserResponse]


# ===================================
# TOKEN SCHEMAS
# ===================================

class Token(BaseModel):
    """Ответ с токенами доступа"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Данные внутри JWT токена"""
    sub: str          # user_id
    email: str
    username: str
    role: Optional[str] = None
    is_superuser: bool = False
    exp: Optional[int] = None
    type: str = "access"  # access | refresh


class RefreshTokenRequest(BaseModel):
    """Запрос на обновление токена"""
    refresh_token: str


# ===================================
# ОБЩИЕ СХЕМЫ ОТВЕТОВ
# ===================================

class MessageResponse(BaseModel):
    """Простой ответ с сообщением"""
    message: str


class AuthResponse(BaseModel):
    """Ответ при успешной аутентификации"""
    user: UserResponse
    tokens: Token
