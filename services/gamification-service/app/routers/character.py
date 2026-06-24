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
    CosmeticItem, UnlockedCosmetic, CosmeticVisibility, UnlockType,
    Badge,
)
from app.schemas import (
    CharacterResponse, CharacterTypeResponse,
    CosmeticItemResponse, UnlockedCosmeticResponse,
    CharacterCreateRequest, CharacterEquipRequest,
    CosmeticCatalogItemResponse,
    CharacterColorsRequest,
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


@router.patch(
    "/me/colors",
    response_model=CharacterResponse,
    summary="Изменить цвета персонажа",
)
async def update_character_colors(
    payload: CharacterColorsRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Обновляет цвет кожи, волос и глаз персонажа.
    Все поля опциональны: передавайте только те, что нужно изменить.
    """
    character = await _get_character_or_404(user_id, db)

    if payload.skin_color is not None:
        character.skin_color = payload.skin_color
    if payload.hair_color is not None:
        character.hair_color = payload.hair_color
    if payload.eyes_color is not None:
        character.eyes_color = payload.eyes_color

    await db.commit()
    logger.info(f"✅ Цвета персонажа обновлены для user_id={user_id}")
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
    existing = await db.scalar(
        select(Character).where(Character.user_id == user_id)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Персонаж уже существует. Используйте PATCH /equipment для изменения внешности.",
        )

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

    cosmetic = await db.scalar(
        select(CosmeticItem).where(CosmeticItem.id == payload.cosmetic_item_id)
    )
    if not cosmetic:
        raise HTTPException(status_code=404, detail="Косметический предмет не найден.")

    if cosmetic.slot != payload.slot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Предмет находится в слоте '{cosmetic.slot}', а не '{payload.slot}'.",
        )

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


# ===================================
# ИНВЕНТАРЬ (каталог + статус разблокировки)
# ===================================

async def _unlock_requirement_text(
    db: AsyncSession, item: CosmeticItem
) -> str | None:
    if item.visibility == CosmeticVisibility.OPEN or item.unlock_type == UnlockType.NONE:
        return None
    if item.unlock_type == UnlockType.LEVEL and item.unlock_value:
        return f"Достигни {item.unlock_value} уровня персонажа"
    if item.unlock_type == UnlockType.QUEST and item.unlock_value:
        return f"Выполни {item.unlock_value} квестов"
    if item.unlock_type == UnlockType.ACHIEVEMENT:
        if item.unlock_ref:
            badge = await db.scalar(select(Badge).where(Badge.id == item.unlock_ref))
            if badge:
                return f"Получи достижение «{badge.name}»"
        return "Получи особое достижение"
    if item.unlock_type == UnlockType.ADMIN:
        return "Выдаётся администратором / за особые заслуги"
    return "Особое условие разблокировки"


@router.get(
    "/inventory",
    response_model=List[CosmeticCatalogItemResponse],
    summary="Инвентарь: каталог косметики со статусом разблокировки",
)
async def get_inventory(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    items = (await db.execute(
        select(CosmeticItem)
        .where(CosmeticItem.visibility != CosmeticVisibility.HIDDEN)
        .order_by(CosmeticItem.slot, CosmeticItem.name)
    )).scalars().all()

    unlocked_ids = set((await db.execute(
        select(UnlockedCosmetic.cosmetic_item_id)
        .where(UnlockedCosmetic.user_id == user_id)
    )).scalars().all())

    equipped_ids: set[str] = set()
    character = await db.scalar(select(Character).where(Character.user_id == user_id))
    if character:
        equipped_ids = set((await db.execute(
            select(CharacterEquipment.cosmetic_item_id)
            .where(CharacterEquipment.character_id == character.id)
        )).scalars().all())

    result: List[CosmeticCatalogItemResponse] = []
    for it in items:
        is_unlocked = it.visibility == CosmeticVisibility.OPEN or it.id in unlocked_ids
        requirement = None if is_unlocked else await _unlock_requirement_text(db, it)
        result.append(
            CosmeticCatalogItemResponse(
                id=it.id,
                name=it.name,
                slug=it.slug,
                description=it.description,
                preview_url=it.preview_url,
                slot=it.slot,
                rarity=it.rarity,
                visibility=it.visibility,
                unlock_type=it.unlock_type,
                unlock_value=it.unlock_value,
                allowed_character_types=it.allowed_character_types,
                is_unlocked=is_unlocked,
                is_equipped=it.id in equipped_ids,
                unlock_requirement=requirement,
            )
        )
    return result
