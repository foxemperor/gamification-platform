"""
Admin Router — проксирует /api/v1/admin/* → auth-service:8001
Исключение:
  - system-metrics → gamification-service:8002
  - users (GET) → auth-service + обогащение XP из gamification-service
"""
import json
import logging

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Пути, которые должны проксироваться в gamification-service вместо auth-service
_GAMIFICATION_PATHS = {"system-metrics"}


async def _proxy_to(request: Request, upstream_url: str) -> Response:
    """Универсальный проксирующий метод к указанному upstream URL."""
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.request(
                method=request.method, url=upstream_url, headers=headers,
                content=await request.body(), params=dict(request.query_params),
            )
        return Response(content=resp.content, status_code=resp.status_code,
                        media_type=resp.headers.get("content-type"))
    except httpx.ConnectError as exc:
        logger.error(f"ConnectError → {upstream_url}: {exc}")
        service = "gamification-service" if settings.GAMIFICATION_SERVICE_URL in upstream_url else "auth-service"
        return Response(
            content=f'{{"error": true, "message": "{service} недоступен"}}',
            status_code=503, media_type="application/json"
        )
    except httpx.TimeoutException:
        return Response(content='{"error": true, "message": "timeout"}',
                        status_code=504, media_type="application/json")


async def _enrich_users_with_xp(request: Request) -> Response:
    """
    GET /api/v1/admin/users:
      1. Получаем список пользователей из auth-service.
      2. Собираем их user_id и делаем POST /api/v1/admin/users/xp-bulk
         в gamification-service (внутренний вызов с заголовками оригинального запроса).
      3. Подставляем реальные xp/level в каждый объект пользователя.
    """
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    upstream_users = (
        f"{settings.AUTH_SERVICE_URL}/api/v1/admin/users"
        if not request.query_params
        else f"{settings.AUTH_SERVICE_URL}/api/v1/admin/users?{request.query_params}"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            # 1. Список пользователей из auth-service
            auth_resp = await client.get(upstream_users, headers=headers)
            if auth_resp.status_code != 200:
                return Response(
                    content=auth_resp.content,
                    status_code=auth_resp.status_code,
                    media_type=auth_resp.headers.get("content-type"),
                )

            users_data: dict = auth_resp.json()
            items: list[dict] = users_data.get("items", [])

            if not items:
                return Response(
                    content=auth_resp.content,
                    status_code=200,
                    media_type="application/json",
                )

            user_ids = [u["id"] for u in items]

            # 2. Batch-запрос реального XP из gamification-service
            xp_resp = await client.post(
                f"{settings.GAMIFICATION_SERVICE_URL}/api/v1/admin/users/xp-bulk",
                headers=headers,
                json={"user_ids": user_ids},
                timeout=10.0,
            )

            if xp_resp.status_code == 200:
                xp_list: list[dict] = xp_resp.json().get("users", [])
                xp_map: dict[str, dict] = {
                    entry["user_id"]: entry for entry in xp_list
                }
                # 3. Обогащаем каждого пользователя реальными xp/level
                for user in items:
                    uid = user["id"]
                    if uid in xp_map:
                        user["xp"] = xp_map[uid]["xp"]
                        user["level"] = xp_map[uid]["level"]
            else:
                logger.warning(
                    f"xp-bulk returned {xp_resp.status_code}: {xp_resp.text[:200]}"
                )

            users_data["items"] = items
            return Response(
                content=json.dumps(users_data, ensure_ascii=False),
                status_code=200,
                media_type="application/json",
            )

    except httpx.ConnectError as exc:
        logger.error(f"ConnectError in _enrich_users_with_xp: {exc}")
        return Response(
            content='{"error": true, "message": "auth-service недоступен"}',
            status_code=503, media_type="application/json",
        )
    except httpx.TimeoutException:
        return Response(
            content='{"error": true, "message": "timeout"}',
            status_code=504, media_type="application/json",
        )


async def _proxy(request: Request, path: str) -> Response:
    """Маршрутизирует запрос к нужному сервису по имени пути."""
    # Обогащаем GET /admin/users реальным XP из gamification
    if path == "users" and request.method == "GET":
        return await _enrich_users_with_xp(request)

    # system-metrics → gamification-service
    first_segment = path.split("/")[0] if path else ""
    if first_segment in _GAMIFICATION_PATHS:
        upstream = f"{settings.GAMIFICATION_SERVICE_URL}/api/v1/admin/{path}"
    else:
        upstream = (
            f"{settings.AUTH_SERVICE_URL}/api/v1/admin/{path}"
            if path else f"{settings.AUTH_SERVICE_URL}/api/v1/admin"
        )
    return await _proxy_to(request, upstream)


@router.api_route("", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@router.api_route("/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def admin_root(request: Request):
    return await _proxy(request, "")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def admin_proxy(path: str, request: Request):
    return await _proxy(request, path)