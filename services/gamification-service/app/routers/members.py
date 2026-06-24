"""
Gamification Service — эндпоинты участников (members)
=======================================================
Возвращает список участников платформы с их уровнями и XP.
Поддерживает фильтрацию по scope: all, project, department, team.

Используется фронтендом для:
  - Страницы «Список участников»
  - Виджета «Топ игроков» (Dashboard)

Автор: Dmitry Koval
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id
from app.models import UserLevel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/members", tags=["members"])


# ===================================
# СХЕМЫ ОТВЕТА
# ===================================

class MemberResponse(BaseModel):
    user_id: str
    level: int
    xp: int
    xp_to_next_level: int
    total_xp: int
    rank: Optional[int] = None

    model_config = {"from_attributes": True}


# ===================================
# ЭНДПОИНТЫ
# ===================================

@router.get(
    "",
    response_model=list[MemberResponse],
    summary="Список участников платформы",
)
async def list_members(
    scope: str = Query(
        default="all",
        description="Область выборки: all | project | department | team",
    ),
    limit: int = Query(
        default=200,
        ge=1,
        le=500,
        description="Максимальное число записей",
    ),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Возвращает список участников платформы с их уровнем, XP и рангом.

    Параметр scope зарезервирован для будущей фильтрации
    (project / department / team — когда появится модель привязки
    пользователей к командам). Сейчас все значения scope возвращают
    единый глобальный список, отсортированный по убыванию total_xp.
    """
    result = await db.execute(
        select(UserLevel)
        .order_by(UserLevel.total_xp.desc())
        .limit(limit)
    )
    rows = result.scalars().all()

    members = []
    for rank_idx, row in enumerate(rows, start=1):
        members.append(
            MemberResponse(
                user_id=row.user_id,
                level=row.level,
                xp=row.xp,
                xp_to_next_level=row.xp_to_next_level,
                total_xp=row.total_xp,
                rank=rank_idx,
            )
        )

    logger.info(
        f"GET /api/v1/members scope={scope} limit={limit} "
        f"→ {len(members)} записей (запрошено user_id={user_id})"
    )
    return members
