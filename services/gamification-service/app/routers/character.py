"""
Gamification Service — роутер персонажей
=========================================
CRUD персонажа пользователя: создание, просмотр,
управление экипировкой и каталог косметики.
Автор: Dmitry Koval
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models import (
    Character, CharacterType, CharacterEquipment,
    CosmeticItem, UnlockedCosmetic, CosmeticVisibility,
)
from app.schemas import (
    CharacterResponse, CharacterTypeResponse,
    CosmeticItemResponse, UnlockedCosmeticResponse,
    CharacterCreateRequest, CharacterEquipRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/character",
    tags=["character"],
)


# ===================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ===================================

async def _get_character_or_404(user_id: str, db: AsyncSession) -> Character:
    """Возвращает персонажа пользователя или 404."""
    result = await db.execute(
        select(Character)
        .options(
            selectinload(Character.character_type),
            selectinload(Character.equipment).selectinload(CharacterEquipment.cosmetic_item),
        )
        .where(Character.user_id == user_id)
    )
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Персонаж не найден. Создайте персонажа через POST /api/v1/character/create",
        )
    return character


# ===================================
# ЭНДПОИНТЫ
# ===================================

@router.get("/me", response_model=CharacterResponse, summary="Получить своего персонажа")
async def get_my_character(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает персонажа текущего пользователя со снаряжением."""
    return await _get_character_or_404(user_id, db)


@router.post(
    "/create",
    response_model=CharacterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать персонажа (выбор архетипа)",
)
async def create_character(
    payload: CharacterCreateRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Создаёт персонажа для пользователя. Один пользователь — один персонаж."""
    # Проверяем что персонаж ещё не создан
    existing = await db.scalar(
        select(Character).where(Character.user_id == user_id)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Персонаж уже существует. Используйте PATCH /equipment для изменения внешности.",
        )

    # Ищем архетип по slug
    char_type = await db.scalar(
        select(CharacterType).where(CharacterType.slug == payload.character_type_slug)
    )
    if not char_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Архетип '{payload.character_type_slug}' не найден. Запустите seed_demo.py.",
        )

    character = Character(
        user_id=user_id,
        character_type_id=char_type.id,
        coin_multiplier=char_type.coin_multiplier_base,
        xp_multiplier=char_type.xp_multiplier_base,
        skin_color=payload.skin_color,
        hair_color=payload.hair_color,
        eyes_color=payload.eyes_color,
    )
    db.add(character)
    await db.commit()

    logger.info(f"✅ Персонаж создан для user_id={user_id}, тип={payload.character_type_slug}")
    return await _get_character_or_404(user_id, db)


@router.patch(
    "/equipment",
    response_model=CharacterResponse,
    summary="Надеть / снять предмет",
)
async def equip_item(
    payload: CharacterEquipRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Надевает предмет в указанный слот или снимает его (cosmetic_item_id=None).
    Проверяет, что предмет разблокирован для этого пользователя.
    """
    character = await _get_character_or_404(user_id, db)

    # --- Снятие предмета ---
    if payload.cosmetic_item_id is None:
        existing_slot = await db.scalar(
            select(CharacterEquipment)
            .where(
                CharacterEquipment.character_id == character.id,
                CharacterEquipment.slot == payload.slot,
            )
        )
        if existing_slot:
            await db.delete(existing_slot)
            await db.commit()
        return await _get_character_or_404(user_id, db)

    # --- Надевание предмета ---
    cosmetic = await db.scalar(
        select(CosmeticItem).where(CosmeticItem.id == payload.cosmetic_item_id)
    )
    if not cosmetic:
        raise HTTPException(status_code=404, detail="Косметический предмет не найден.")

    # Предмет должен слот совпадать
    if cosmetic.slot != payload.slot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Предмет находится в слоте '{cosmetic.slot}', а не '{payload.slot}'.",
        )

    # Предметы не open требуют разблокировки
    if cosmetic.visibility != CosmeticVisibility.OPEN:
        unlocked = await db.scalar(
            select(UnlockedCosmetic).where(
                UnlockedCosmetic.user_id == user_id,
                UnlockedCosmetic.cosmetic_item_id == cosmetic.id,
            )
        )
        if not unlocked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Предмет не разблокирован.",
            )

    # Upsert слота
    existing_slot = await db.scalar(
        select(CharacterEquipment)
        .where(
            CharacterEquipment.character_id == character.id,
            CharacterEquipment.slot == payload.slot,
        )
    )
    if existing_slot:
        existing_slot.cosmetic_item_id = cosmetic.id
        existing_slot.color = payload.color
    else:
        new_eq = CharacterEquipment(
            character_id=character.id,
            cosmetic_item_id=cosmetic.id,
            slot=payload.slot,
            color=payload.color,
        )
        db.add(new_eq)

    await db.commit()
    logger.info(f"✅ Слот {payload.slot} обновлён для user_id={user_id}")
    return await _get_character_or_404(user_id, db)


@router.get(
    "/types",
    response_model=List[CharacterTypeResponse],
    summary="Список архетипов персонажей",
)
async def list_character_types(db: AsyncSession = Depends(get_db)):
    """Возвращает все доступные архетипы (публичный эндпоинт — без авторизации)."""
    result = await db.execute(select(CharacterType).order_by(CharacterType.name))
    return result.scalars().all()


@router.get(
    "/cosmetics",
    response_model=List[CosmeticItemResponse],
    summary="Каталог косметики",
)
async def list_cosmetics(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает все видимые (не hidden) косметические предметы."""
    result = await db.execute(
        select(CosmeticItem)
        .where(CosmeticItem.visibility != CosmeticVisibility.HIDDEN)
        .order_by(CosmeticItem.slot, CosmeticItem.name)
    )
    return result.scalars().all()


@router.get(
    "/cosmetics/unlocked",
    response_model=List[UnlockedCosmeticResponse],
    summary="Разблокированная косметика текущего пользователя",
)
async def list_my_unlocked_cosmetics(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает всю косметику, разблокированную для текущего пользователя."""
    result = await db.execute(
        select(UnlockedCosmetic)
        .options(selectinload(UnlockedCosmetic.cosmetic_item))
        .where(UnlockedCosmetic.user_id == user_id)
        .order_by(UnlockedCosmetic.unlocked_at.desc())
    )
    return result.scalars().all()
