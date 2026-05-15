"""
Integrations Router — проксирует /api/v1/integrations/* → integration-service:8003
"""
import httpx
from fastapi import APIRouter, Request, Response
from app.config import settings
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


async def _proxy(request: Request, upstream_url: str) -> Response:
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length")
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request(
                method=request.method,
                url=upstream_url,
                headers=headers,
                content=await request.body(),
                params=dict(request.query_params),
            )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=dict(resp.headers),
            media_type=resp.headers.get("content-type"),
        )
    except httpx.ConnectError:
        logger.error(f"integration-service unavailable: {upstream_url}")
        return Response(
            content='{"error": true, "message": "integration-service недоступен"}',
            status_code=503,
            media_type="application/json",
        )
    except httpx.TimeoutException:
        logger.error(f"integration-service timeout: {upstream_url}")
        return Response(
            content='{"error": true, "message": "integration-service не ответил вовремя"}',
            status_code=504,
            media_type="application/json",
        )


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def integrations_proxy(path: str, request: Request):
    """Проксирует любой запрос на /api/v1/integrations/* → integration-service."""
    upstream = f"{settings.INTEGRATION_SERVICE_URL}/api/v1/integrations/{path}"
    logger.debug(f"PROXY INTEGRATIONS → {upstream}")
    return await _proxy(request, upstream)
