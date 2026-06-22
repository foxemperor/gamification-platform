"""
Integration Service — stub
Будет реализован в следующих итерациях: GitHub, Jira, Slack webhooks.

Author: Dmitry Koval
"""
from fastapi import FastAPI
from datetime import datetime

app = FastAPI(
    title="Integration Service",
    description="Stub: интеграции GitHub / Jira / Slack. В разработке.",
    version="0.1.0",
)


@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "healthy",
        "service": "integration-service",
        "version": "0.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "note": "stub — full implementation coming soon",
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Integration Service stub",
        "docs": "/docs",
        "health": "/health",
    }
