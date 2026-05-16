"""
Admin Router — проксирует /api/v1/admin/* → auth-service:8001
Исключение: system-metrics → gamification-service:8002
             (эндпоинт живёт в gamification-service/routers/system_metrics.py)
"""
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response
from app.config import settings
import logging

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


async def _proxy(request: Request, path: str) -> Response:
    """Маршрутизирует запрос к нужному сервису по имени пути."""
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