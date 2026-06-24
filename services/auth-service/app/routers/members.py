"""
Members Router — Auth Service
==============================
GET /members  — список участников с фильтрацией по scope и поиском.

Scope logic (всё определяется по данным текущего пользователя из JWT → БД):
  all        — все активные пользователи системы
  project    — пользователи, у которых project = project текущего пользователя
  department — пользователи с тем же project И department что у текущего пользователя
  team       — текущий пользователь + все, у кого manager_id совпадает с manager_id
               текущего пользователя; если текущий пользователь сам менеджер (role=manager),
               то возвращаются все, у кого manager_id = id текущего пользователя

Поиск (search):
  case-insensitive ILIKE по полям: full_name, username, project, department

Автор: Dmitry Koval
"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas import MemberEntry, MembersListResponse, MemberScope
from app.security import get_current_user

router = APIRouter(prefix="/members", tags=["members"])


# ---------------------------------------------------------------------------
# Вспомогательная функция: преобразует ORM-объект в MemberEntry
# ---------------------------------------------------------------------------

def _to_entry(user: User, current_user_id: uuid.UUID) -> MemberEntry:
    return MemberEntry(
        user_id=user.id,
        full_name=user.full_name,
        username=user.username,
        avatar_url=user.avatar_url,
        role=user.role,
        level=user.level,
        department=user.department,
        project_name=user.project,
        position=user.position,
        manager_id=user.manager_id,
        is_self=(user.id == current_user_id),
    )


# ---------------------------------------------------------------------------
# GET /members
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=MembersListResponse,
    summary="Список участников",
    description=(
        "Возвращает список пользователей, отфильтрованный по scope. "
        "Поиск работает по ФИО, username, проекту и отделу."
    ),
)
async def get_members(
    scope: Annotated[MemberScope, Query(description="Область выборки участников")] = "all",
    search: Annotated[
        Optional[str],
        Query(max_length=100, description="Строка поиска по ФИО / проекту / отделу")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=200, description="Максимальное кол-во записей")] = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MembersListResponse:

    stmt = select(User).where(User.is_active == True)  # noqa: E712

    # ------------------------------------------------------------------
    # 1. Фильтр по scope
    # ------------------------------------------------------------------
    if scope == "project":
        if current_user.project:
            stmt = stmt.where(User.project == current_user.project)
        else:
            # Нет проекта — возвращаем только самого пользователя
            stmt = stmt.where(User.id == current_user.id)

    elif scope == "department":
        if current_user.project and current_user.department:
            stmt = stmt.where(
                User.project == current_user.project,
                User.department == current_user.department,
            )
        elif current_user.project:
            stmt = stmt.where(User.project == current_user.project)
        else:
            stmt = stmt.where(User.id == current_user.id)

    elif scope == "team":
        if current_user.role == "manager":
            # Менеджер видит себя + всех, кому он назначен менеджером
            stmt = stmt.where(
                or_(
                    User.id == current_user.id,
                    User.manager_id == current_user.id,
                )
            )
        elif current_user.manager_id is not None:
            # Рядовой сотрудник видит себя + всех с тем же manager_id
            stmt = stmt.where(
                or_(
                    User.id == current_user.id,
                    User.manager_id == current_user.manager_id,
                )
            )
        else:
            # Нет менеджера — только себя
            stmt = stmt.where(User.id == current_user.id)

    # scope == "all" — никаких дополнительных фильтров

    # ------------------------------------------------------------------
    # 2. Поиск
    # ------------------------------------------------------------------
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                User.full_name.ilike(term),
                User.username.ilike(term),
                User.project.ilike(term),
                User.department.ilike(term),
            )
        )

    # ------------------------------------------------------------------
    # 3. Сортировка и лимит
    # ------------------------------------------------------------------
    stmt = stmt.order_by(User.full_name.asc().nulls_last(), User.username.asc())
    stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    users = result.scalars().all()

    items = [_to_entry(u, current_user.id) for u in users]

    return MembersListResponse(
        scope=scope,
        search=search,
        total=len(items),
        items=items,
    )
