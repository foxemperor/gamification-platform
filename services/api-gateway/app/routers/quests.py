"""
Quests Router — проксирует /api/v1/quests/* → gamification-service:8002
"""
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response
from app.config import settings
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

BASE = settings.GAMIFICATION_SERVICE_URL


async def _proxy(request: Request, path: str) -> Response:
    upstream = f"{BASE}/api/v1/quests/{path}" if path else f"{BASE}/api/v1/quests"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.request(
                method=request.method,
                url=upstream,
                headers=headers,
                content=await request.body(),
                params=dict(request.query_params),
            )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("content-type"),
        )
    except httpx.ConnectError:
        logger.error(f"gamification-service unavailable: {upstream}")
        return Response(
            content='{"error": true, "message": "gamification-service недоступен"}',
            status_code=503, media_type="application/json",
        )
    except httpx.TimeoutException:
        logger.error(f"gamification-service timeout: {upstream}")
        return Response(
            content='{"error": true, "message": "gamification-service не ответил вовремя"}',
            status_code=504, media_type="application/json",
        )


@router.api_route("", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def quests_root(request: Request):
    return await _proxy(request, "")

@router.api_route("/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def quests_root_slash(request: Request):
    return await _proxy(request, "")

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def quests_proxy(path: str, request: Request):
    return await _proxy(request, path)
