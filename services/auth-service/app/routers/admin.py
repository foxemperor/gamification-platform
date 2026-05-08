"""
Admin Router — управление пользователями
=====================================================
Endpoints:
  GET    /api/v1/admin/users           — список с пагинацией
  GET    /api/v1/admin/users/{user_id} — получить пользователя
  POST   /api/v1/admin/users           — создать пользователя
  PATCH  /api/v1/admin/users/{user_id} — обновить пользователя
  DELETE /api/v1/admin/users/{user_id} — удалить пользователя (суперюзера нельзя)
"""

import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import (
    AdminUserCreate, AdminUserUpdate,
    AdminUserResponse, AdminUsersListResponse,
    MessageResponse,
)
from app.security import get_password_hash, get_current_user

logger = logging.getLogger("auth-service.admin")

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# ===================================
# DEPENDENCY: проверка прав админа
# ===================================

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Разрешает доступ только role=admin или is_superuser."""
    if not (current_user.role == "admin" or current_user.is_superuser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав: требуется роль admin",
        )
    return current_user


# ===================================
# GET /api/v1/admin/users
# ===================================

@router.get("/users", response_model=AdminUsersListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Поиск по email или username"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Список всех пользователей с пагинацией и поиском."""
    query = select(User)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            User.email.ilike(pattern) | User.username.ilike(pattern)
        )

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    query = query.offset((page - 1) * per_page).limit(per_page).order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    return AdminUsersListResponse(total=total, page=page, per_page=per_page, items=users)


# ===================================
# GET /api/v1/admin/users/{user_id}
# ===================================

@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


# ===================================
# POST /api/v1/admin/users
# ===================================

@router.post("/users", response_model=AdminUserResponse, status_code=201)
async def create_user(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Создать пользователя (уже verified по умолчанию)."""
    existing = await db.execute(
        select(User).where((User.email == data.email) | (User.username == data.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email или username уже занят")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
        is_active=data.is_active,
        is_verified=data.is_verified,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"✅ Admin created user: {user.username} (role={user.role})")
    return user


# ===================================
# PATCH /api/v1/admin/users/{user_id}
# ===================================

@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    logger.info(f"✏️ Admin updated user: {user.username}")
    return user


# ===================================
# DELETE /api/v1/admin/users/{user_id}
# ===================================

@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Суперюзера удалить нельзя
    if user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Суперюзера удалить нельзя",
        )
    # Сам себя админ удалить не может
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить самого себя",
        )

    await db.delete(user)
    await db.commit()
    logger.info(f"🗑️ Admin deleted user: {user.username}")
    return MessageResponse(message=f"Пользователь {user.username} удалён")
