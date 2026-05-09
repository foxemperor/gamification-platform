"""
Gamification Service — зависимости FastAPI
==============================================
Верификация JWT-токена (тот же секрет, что и в Auth Service)
и проверка прав администратора.

Админский доступ принимается, если:
  • в JWT payload присутствует claim ``is_superuser: true`` или
    ``role`` со значением ``admin`` / ``superuser``;
  • либо запрос пришёл от доверенного gateway, который выставил
    заголовок ``X-Is-Admin: true`` или ``X-User-Role`` со значением
    ``admin`` / ``superuser``.

Автор: Dmitry Koval
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

security = HTTPBearer()


def _decode_token(token: str) -> dict:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверный или просроченный токен",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        raise exc
    if not payload.get("sub") or payload.get("type") != "access":
        raise exc
    return payload


async def get_current_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    return _decode_token(credentials.credentials)


async def get_current_user_id(
    payload: dict = Depends(get_current_payload),
) -> str:
    """Извлекает user_id (sub) из JWT access-токена."""
    return payload["sub"]


def _header_grants_admin(request: Request) -> bool:
    is_admin_header = request.headers.get("x-is-admin", "").strip().lower()
    if is_admin_header in {"1", "true", "yes"}:
        return True
    role_header = request.headers.get("x-user-role", "").strip().lower()
    if role_header in {"admin", "superuser"}:
        return True
    return False


def _payload_grants_admin(payload: dict) -> bool:
    if bool(payload.get("is_superuser")) is True:
        return True
    role = payload.get("role")
    if isinstance(role, str) and role.lower() in {"admin", "superuser"}:
        return True
    return False


async def require_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> str:
    """
    Возвращает user_id (если был JWT) либо ``"gateway"`` (если доступ
    выдан на основании gateway-заголовков без JWT).
    Поднимает 401 если ничего нет, 403 если есть JWT но не админ.
    """
    payload: Optional[dict] = None
    if credentials and credentials.credentials:
        payload = _decode_token(credentials.credentials)

    if payload is None:
        if _header_grants_admin(request):
            return "gateway"
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if _payload_grants_admin(payload) or _header_grants_admin(request):
        return payload["sub"]

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Требуются права администратора",
    )
