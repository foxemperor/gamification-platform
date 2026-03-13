from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "api-gateway", 
        "timestamp": datetime.utcnow().isoformat()
    }
