"""
Analytics Service — stub
Будет реализован в следующих итерациях: метрики, отчёты, дашборды.

Author: Dmitry Koval
"""
from fastapi import FastAPI
from datetime import datetime

app = FastAPI(
    title="Analytics Service",
    description="Stub: аналитика, метрики, отчёты. В разработке.",
    version="0.1.0",
)


@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "healthy",
        "service": "analytics-service",
        "version": "0.1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "note": "stub — full implementation coming soon",
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Analytics Service stub",
        "docs": "/docs",
        "health": "/health",
    }
