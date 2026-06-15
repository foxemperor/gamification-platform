"""
API Gateway - Р“Р»Р°РІРЅР°СЏ С‚РѕС‡РєР° РІС…РѕРґР° РґР»СЏ Gamification Platform
============================================================

Р­С‚РѕС‚ РјРѕРґСѓР»СЊ СЃРѕР·РґР°С‘С‚ FastAPI РїСЂРёР»РѕР¶РµРЅРёРµ, РєРѕС‚РѕСЂРѕРµ:
- РџСЂРёРЅРёРјР°РµС‚ РІСЃРµ РІС…РѕРґСЏС‰РёРµ HTTP Р·Р°РїСЂРѕСЃС‹
- РњР°СЂС€СЂСѓС‚РёР·РёСЂСѓРµС‚ Р·Р°РїСЂРѕСЃС‹ Рє СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РёРј РјРёРєСЂРѕСЃРµСЂРІРёСЃР°Рј
- РћР±РµСЃРїРµС‡РёРІР°РµС‚ Р°СѓС‚РµРЅС‚РёС„РёРєР°С†РёСЋ Рё Р°РІС‚РѕСЂРёР·Р°С†РёСЋ
- Р›РѕРіРёСЂСѓРµС‚ РІСЃРµ Р·Р°РїСЂРѕСЃС‹
- РџСЂРµРґРѕСЃС‚Р°РІР»СЏРµС‚ WebSocket РґР»СЏ real-time СѓРІРµРґРѕРјР»РµРЅРёР№

Author: Dmitry Koval
Date: 06.03.2026
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.middleware.logging import LoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import health, auth, users, quests, leaderboard, integrations
from app.celery_app import process_gamification_event
from app.routers import profile
from app.routers import character
from app.routers import auth as auth_router
from app.routers import admin

import logging
import sys

# ===================================
# РќРђРЎРўР РћР™РљРђ Р›РћР“РР РћР’РђРќРРЇ
# ===================================

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


# ===================================
# LIFECYCLE EVENTS
# ===================================

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    РЈРїСЂР°РІР»РµРЅРёРµ Р¶РёР·РЅРµРЅРЅС‹Рј С†РёРєР»РѕРј РїСЂРёР»РѕР¶РµРЅРёСЏ:
    - Startup: РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє Р‘Р”, Redis, РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЃРµСЂРІРёСЃРѕРІ
    - Shutdown: Р·Р°РєСЂС‹С‚РёРµ СЃРѕРµРґРёРЅРµРЅРёР№
    """
    logger.info("рџљЂ Starting Gamification Platform API Gateway...")
    logger.info(f"рџ“Ќ Environment: {settings.ENVIRONMENT}")
    logger.info(f"рџ”§ Debug mode: {settings.DEBUG}")
    
    # TODO: РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїРѕРґРєР»СЋС‡РµРЅРёР№ Рє Р‘Р” Рё Redis
    # await database.connect()
    # await redis.connect()
    
    yield
    
    logger.info("рџ›‘ Shutting down API Gateway...")
    # TODO: Р—Р°РєСЂС‹С‚РёРµ РїРѕРґРєР»СЋС‡РµРЅРёР№
    # await database.disconnect()
    # await redis.disconnect()


# ===================================
# FASTAPI APPLICATION
# ===================================

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "API Gateway РґР»СЏ РїР»Р°С‚С„РѕСЂРјС‹ РіРµР№РјРёС„РёРєР°С†РёРё СЂР°СЃРїСЂРµРґРµР»С‘РЅРЅС‹С… РєРѕРјР°РЅРґ. "
        "РћР±РµСЃРїРµС‡РёРІР°РµС‚ РјР°СЂС€СЂСѓС‚РёР·Р°С†РёСЋ Р·Р°РїСЂРѕСЃРѕРІ Рє РјРёРєСЂРѕСЃРµСЂРІРёСЃР°Рј: "
        "Auth, Gamification, Integration, Analytics."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    redirect_slashes=False,
)


# ===================================
# MIDDLEWARE
# ===================================

# CORS - СЂР°Р·СЂРµС€Р°РµРј Р·Р°РїСЂРѕСЃС‹ СЃ С„СЂРѕРЅС‚РµРЅРґР°
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# РљР°СЃС‚РѕРјРЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ Р·Р°РїСЂРѕСЃРѕРІ
app.add_middleware(LoggingMiddleware)

# Rate limiting РґР»СЏ Р·Р°С‰РёС‚С‹ РѕС‚ DDoS
if settings.ENVIRONMENT == "production":
    app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)


# ===================================
# EXCEPTION HANDLERS
# ===================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    РћР±СЂР°Р±РѕС‚С‡РёРє HTTP РёСЃРєР»СЋС‡РµРЅРёР№
    """
    logger.error(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    РћР±СЂР°Р±РѕС‚С‡РёРє РѕС€РёР±РѕРє РІР°Р»РёРґР°С†РёРё Pydantic
    """
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": True,
            "message": "РћС€РёР±РєР° РІР°Р»РёРґР°С†РёРё РґР°РЅРЅС‹С…",
            "details": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    РћР±СЂР°Р±РѕС‚С‡РёРє РІСЃРµС… РѕСЃС‚Р°Р»СЊРЅС‹С… РёСЃРєР»СЋС‡РµРЅРёР№
    """
    logger.exception(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "message": "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°",
            "detail": str(exc) if settings.DEBUG else "Internal server error",
        },
    )


# ===================================
# Р РћРЈРўР•Р Р«
# ===================================

# Health check СЌРЅРґРїРѕРёРЅС‚С‹
app.include_router(health.router, tags=["Health"])

# РђСѓС‚РµРЅС‚РёС„РёРєР°С†РёСЏ (РїСЂРѕРєСЃРёСЂСѓРµС‚ РЅР° auth-service)
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

# РџРѕР»СЊР·РѕРІР°С‚РµР»Рё
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])

# РљРІРµСЃС‚С‹ Рё РіРµР№РјРёС„РёРєР°С†РёСЏ
app.include_router(quests.router, prefix="/api/v1/quests", tags=["Quests"])

# Р›РёРґРµСЂР±РѕСЂРґС‹
app.include_router(leaderboard.router, prefix="/api/v1/leaderboard", tags=["Leaderboard"])

# РРЅС‚РµРіСЂР°С†РёРё (GitHub, Jira, Slack)
app.include_router(integrations.router, prefix="/api/v1/integrations", tags=["Integrations"])

app.include_router(profile.router, prefix="/api/v1/profile", tags=["Profile"]) 
app.include_router(character.router, prefix="/api/v1/character", tags=["Character"]) 

# ===================================
# CELERY ENDPOINT
# ===================================

# Р­РЅРґРїРѕРёРЅС‚: РџСЂРёРЅРёРјР°РµС‚ СЃРѕР±С‹С‚РёРµ Рё РѕС‚РїСЂР°РІР»СЏРµС‚ РІ С€РёРЅСѓ (Celery)
@app.post("/api/v1/events/complete-task", tags=["Events"])
async def complete_task_event(user_id: int, task_name: str):
    """
    РџСЂРёРЅРёРјР°РµС‚ СЃРѕР±С‹С‚РёРµ Рѕ Р·Р°РІРµСЂС€РµРЅРёРё Р·Р°РґР°С‡Рё Рё РїРµСЂРµРґР°РµС‚ РµРіРѕ РІ С€РёРЅСѓ СЃРѕРѕР±С‰РµРЅРёР№.
    """
    payload = {
        "user_id": user_id,
        "task_name": task_name,
        "points": 50,  # Р‘Р°Р·РѕРІР°СЏ РЅР°РіСЂР°РґР°
        "status": "pending"
    }

    # Р’Р«Р—РћР’ Р—РђР”РђР§Р CELERY (РћС‚РїСЂР°РІРєР° РІ С€РёРЅСѓ СЃРѕРѕР±С‰РµРЅРёР№)
    # .delay() РѕС‚РїСЂР°РІР»СЏРµС‚ Р·Р°РґР°С‡Сѓ РІ Redis, РЅРµ РґРѕР¶РёРґР°СЏСЃСЊ РµС‘ РІС‹РїРѕР»РЅРµРЅРёСЏ
    task = process_gamification_event.delay(payload)

    return {
        "message": "РЎРѕР±С‹С‚РёРµ РѕС‚РїСЂР°РІР»РµРЅРѕ РІ С€РёРЅСѓ СЃРѕРѕР±С‰РµРЅРёР№",
        "task_id": task.id,
        "data": payload
    }

# ===================================
# ROOT ENDPOINT
# ===================================

@app.get("/", tags=["Root"])
async def root():
    """
    РљРѕСЂРЅРµРІРѕР№ СЌРЅРґРїРѕРёРЅС‚ СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ РѕР± API
    """
    return {
        "message": "рџЋ® Gamification Platform API Gateway",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "health": "/health",
        "services": {
            "auth": settings.AUTH_SERVICE_URL,
            "gamification": settings.GAMIFICATION_SERVICE_URL,
            "integration": settings.INTEGRATION_SERVICE_URL,
            "analytics": settings.ANALYTICS_SERVICE_URL,
        },
    }

# ===================================
# HEALTHCHECK
# ===================================
@app.get("/health", tags=["System"])
async def health():
    """
    Р­РЅРґРїРѕРёРЅС‚ РґР»СЏ РїСЂРѕРІРµСЂРєРё Р·РґРѕСЂРѕРІСЊСЏ СЃРµСЂРІРёСЃР° (Healthcheck)
    """
    return {
        "status": "healthy",
        "service": "api-gateway",
        "version": "0.1.0"
    }

# ===================================
# ENTRYPOINT FOR UVICORN
# ===================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_GATEWAY_HOST,
        port=settings.API_GATEWAY_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )

