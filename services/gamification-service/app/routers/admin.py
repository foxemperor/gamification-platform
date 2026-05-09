"""
Gamification Service — административный роутер
================================================
Эндпоинты под ``/api/v1/admin/*`` для управления квестами,
бейджами и ручного начисления/списания XP.

Все эндпоинты защищены ``require_admin``: доступ выдаётся
суперпользователям (claim ``is_superuser`` в JWT) или запросам
от доверенного gateway, выставляющего ``X-Is-Admin: true`` /
``X-User-Role: admin|superuser``.

Автор: Dmitry Koval
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import (
    Badge,
    Quest,
    QuestStatus,
    XPSource,
    XPTransaction,
)
from app.schemas import (
    AdminGrantXPRequest,
    BadgeCreate,
    BadgeListResponse,
    BadgeResponse,
    BadgeUpdate,
    QuestCreate,
    QuestListResponse,
    QuestResponse,
    QuestUpdate,
    XPTransactionListResponse,
    XPTransactionResponse,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _pages(total: int, per_page: int) -> int:
    return max(1, -(-total // per_page)) if total else 1


# ===================================
# КВЕСТЫ
# ===================================

@router.get("/quests", response_model=QuestListResponse, summary="Список всех квестов (админ)")
async def admin_list_quests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    status_: Optional[QuestStatus] = Query(None, alias="status"),
    quest_type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    search: Optional[str] = Query(None, min_length=1, max_length=200),
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(Quest)
    if status_ is not None:
        q = q.where(Quest.status == status_)
    if quest_type:
        q = q.where(Quest.quest_type == quest_type)
    if difficulty:
        q = q.where(Quest.difficulty == difficulty)
    if search:
        like = f"%{search}%"
        q = q.where(or_(Quest.title.ilike(like), Quest.description.ilike(like)))

    total = await db.scalar(select(func.count()).select_from(q.subquery())) or 0
    result = await db.execute(
        q.order_by(Quest.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = result.scalars().all()

    return QuestListResponse(
        items=[QuestResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=_pages(total, per_page),
    )


@router.post(
    "/quests",
    response_model=QuestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать квест (админ)",
)
async def admin_create_quest(
    data: QuestCreate,
    admin_id: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    created_by = admin_id if admin_id != "gateway" else None
    quest = Quest(**data.model_dump(), created_by=created_by)
    db.add(quest)
    await db.commit()
    await db.refresh(quest)
    return QuestResponse.model_validate(quest)


@router.patch("/quests/{quest_id}", response_model=QuestResponse, summary="Обновить квест (админ)")
async def admin_update_quest(
    quest_id: str,
    data: QuestUpdate,
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    quest = await db.get(Quest, quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Квест не найден")

    payload = data.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(quest, key, value)

    await db.commit()
    await db.refresh(quest)
    return QuestResponse.model_validate(quest)


@router.delete(
    "/quests/{quest_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить квест (админ)",
)
async def admin_delete_quest(
    quest_id: str,
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    quest = await db.get(Quest, quest_id)
    if not quest:
        raise HTTPException(status_code=404, detail="Квест не найден")
    await db.delete(quest)
    await db.commit()
    return None


# ===================================
# БЕЙДЖИ
# ===================================

@router.get("/badges", response_model=BadgeListResponse, summary="Список всех бейджей (админ)")
async def admin_list_badges(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    search: Optional[str] = Query(None, min_length=1, max_length=200),
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(Badge)
    if search:
        like = f"%{search}%"
        q = q.where(or_(Badge.name.ilike(like), Badge.description.ilike(like)))

    total = await db.scalar(select(func.count()).select_from(q.subquery())) or 0
    result = await db.execute(
        q.order_by(Badge.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = result.scalars().all()

    return BadgeListResponse(
        items=[BadgeResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=_pages(total, per_page),
    )


@router.post(
    "/badges",
    response_model=BadgeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать бейдж (админ)",
)
async def admin_create_badge(
    data: BadgeCreate,
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.scalar(select(Badge).where(Badge.name == data.name))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Бейдж с таким именем уже существует",
        )

    badge = Badge(**data.model_dump())
    db.add(badge)
    await db.commit()
    await db.refresh(badge)
    return BadgeResponse.model_validate(badge)


@router.patch("/badges/{badge_id}", response_model=BadgeResponse, summary="Обновить бейдж (админ)")
async def admin_update_badge(
    badge_id: str,
    data: BadgeUpdate,
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    badge = await db.get(Badge, badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="Бейдж не найден")

    payload = data.model_dump(exclude_unset=True)
    if "name" in payload and payload["name"] != badge.name:
        clash = await db.scalar(select(Badge).where(Badge.name == payload["name"]))
        if clash and clash.id != badge.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Бейдж с таким именем уже существует",
            )
    for key, value in payload.items():
        setattr(badge, key, value)

    await db.commit()
    await db.refresh(badge)
    return BadgeResponse.model_validate(badge)


@router.delete(
    "/badges/{badge_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить бейдж (админ)",
)
async def admin_delete_badge(
    badge_id: str,
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    badge = await db.get(Badge, badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="Бейдж не найден")
    await db.delete(badge)
    await db.commit()
    return None


# ===================================
# XP — ручное начисление и журнал
# ===================================

@router.post(
    "/xp/grant",
    response_model=XPTransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Начислить/списать XP пользователю (админ)",
)
async def admin_grant_xp(
    data: AdminGrantXPRequest,
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    source = data.source or XPSource.ADMIN
    if data.amount < 0 and data.source is None:
        source = XPSource.PENALTY

    tx = XPTransaction(
        user_id=data.user_id,
        amount=data.amount,
        source=source,
        source_id=data.source_id,
        description=data.description,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return XPTransactionResponse.model_validate(tx)


@router.get(
    "/xp/transactions",
    response_model=XPTransactionListResponse,
    summary="Журнал XP-транзакций (админ)",
)
async def admin_list_xp_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    user_id: Optional[str] = Query(None),
    source: Optional[XPSource] = Query(None),
    _admin: str = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    q = select(XPTransaction)
    if user_id:
        q = q.where(XPTransaction.user_id == user_id)
    if source is not None:
        q = q.where(XPTransaction.source == source)

    total = await db.scalar(select(func.count()).select_from(q.subquery())) or 0
    result = await db.execute(
        q.order_by(XPTransaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = result.scalars().all()

    return XPTransactionListResponse(
        items=[XPTransactionResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=_pages(total, per_page),
    )
