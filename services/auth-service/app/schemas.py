"""
Pydantic схемы Auth Service
============================
"""

import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    full_name: Optional[str] = Field(None, max_length=100)


class UserRegister(UserBase):
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
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    department: Optional[str] = None
    project: Optional[str] = None
    position: Optional[str] = None
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
# MEMBERS SCHEMAS
# ===================================

MemberScope = Literal["all", "project", "department", "team"]


class MemberEntry(BaseModel):
    """Запись участника для вкладки 'Участники'"""
    user_id: uuid.UUID
    full_name: Optional[str] = None
    username: str
    avatar_url: Optional[str] = None
    role: str
    level: int
    department: Optional[str] = None
    project_name: Optional[str] = None
    position: Optional[str] = None
    manager_id: Optional[uuid.UUID] = None
    is_self: bool = False

    model_config = {"from_attributes": True}


class MembersListResponse(BaseModel):
    scope: MemberScope
    search: Optional[str] = None
    total: int
    items: list[MemberEntry]


# ===================================
# ADMIN SCHEMAS
# ===================================

class AdminUserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    project: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    role: Literal["employee", "manager", "admin"] = "employee"
    manager_id: Optional[uuid.UUID] = None
    is_active: bool = True
    is_verified: bool = True


class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    department: Optional[str] = Field(None, max_length=100)
    project: Optional[str] = Field(None, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    role: Optional[Literal["employee", "manager", "admin"]] = None
    manager_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class AdminUserResponse(UserResponse):
    manager_id: Optional[uuid.UUID] = None
    is_superuser: bool
    last_login_at: Optional[datetime] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminUsersListResponse(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[AdminUserResponse]


# ===================================
# TOKEN SCHEMAS
# ===================================

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    email: str
    username: str
    role: Optional[str] = None
    is_superuser: bool = False
    exp: Optional[int] = None
    type: str = "access"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    message: str


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: Token
