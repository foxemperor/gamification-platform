"""Character Router — проксирует /api/v1/character/* → gamification-service:8002"""
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response
from app.config import settings
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


async def _proxy(request: Request, path: str) -> Response:
    upstream = (
        f"{settings.GAMIFICATION_SERVICE_URL}/api/v1/character/{path}"
        if path
        else f"{settings.GAMIFICATION_SERVICE_URL}/api/v1/character"
    )
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.request(
                method=request.method, url=upstream, headers=headers,
                content=await request.body(), params=dict(request.query_params),
            )
        return Response(content=resp.content, status_code=resp.status_code,
                        media_type=resp.headers.get("content-type"))
    except httpx.ConnectError:
        return Response(content='{"error": true, "message": "gamification-service недоступен"}',
                        status_code=503, media_type="application/json")
    except httpx.TimeoutException:
        return Response(content='{"error": true, "message": "gamification-service timeout"}',
                        status_code=504, media_type="application/json")


@router.api_route("", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@router.api_route("/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def character_root(request: Request):
    return await _proxy(request, "")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def character_proxy(path: str, request: Request):
    return await _proxy(request, path)
