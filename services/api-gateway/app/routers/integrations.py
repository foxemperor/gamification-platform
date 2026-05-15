"""
Integrations router — proxy to integration-service
"""
from fastapi import APIRouter, Request
from fastapi.responses import Response
import httpx
from app.config import settings

router = APIRouter()


async def _proxy(request: Request, path: str) -> Response:
    base = f"{settings.INTEGRATION_SERVICE_URL}/api/v1/integrations"
    url = f"{base}/{path}".rstrip("/") if path else base
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.request(
            method=request.method,
            url=url,
            headers={k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")},
            content=await request.body(),
            params=request.query_params,
            follow_redirects=True,
        )
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )


@router.api_route("", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_integrations_root(request: Request):
    return await _proxy(request, "")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_integrations(path: str, request: Request):
    return await _proxy(request, path)
