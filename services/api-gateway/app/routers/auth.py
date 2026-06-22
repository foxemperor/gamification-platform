"""Auth Router — проксирует /api/v1/auth/* → auth-service:8001"""
import httpx
from fastapi import APIRouter, Request
from fastapi.responses import Response
from app.config import settings
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
BASE = settings.AUTH_SERVICE_URL


async def _proxy(request: Request, path: str) -> Response:
    upstream = f"{BASE}/api/v1/auth/{path}" if path else f"{BASE}/api/v1/auth"
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
        return Response(content='{"error": true, "message": "auth-service недоступен"}',
                        status_code=503, media_type="application/json")
    except httpx.TimeoutException:
        return Response(content='{"error": true, "message": "auth-service не ответил вовремя"}',
                        status_code=504, media_type="application/json")


@router.api_route("", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_root(request: Request):
    return await _proxy(request, "")

@router.api_route("/", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_root_slash(request: Request):
    return await _proxy(request, "")

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def auth_proxy(path: str, request: Request):
    return await _proxy(request, path)