"""
Gamification Service — системные метрики сервера
=================================================
Эндпоинт GET /api/v1/admin/system-metrics
Возвращает CPU, RAM, Disk через psutil.
Доступен только администраторам (require_admin).
Автор: Dmitry Koval
"""

from fastapi import APIRouter, Depends

try:
    import psutil
    _PSUTIL_AVAILABLE = True
except ImportError:
    _PSUTIL_AVAILABLE = False

from app.dependencies import require_admin

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get(
    "/system-metrics",
    summary="Системные метрики сервера: CPU, RAM, Disk (только админ)",
)
async def system_metrics(_admin: str = Depends(require_admin)):
    """
    Возвращает текущую нагрузку на сервер.
    Если psutil не установлен — возвращает нули, не падает.
    """
    if not _PSUTIL_AVAILABLE:
        return {
            "cpu_percent": 0.0,
            "ram_percent": 0.0,
            "ram_used_mb": 0,
            "ram_total_mb": 0,
            "disk_percent": 0.0,
            "warning": "psutil not installed",
        }

    cpu = psutil.cpu_percent(interval=0.2)
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    return {
        "cpu_percent": round(cpu, 1),
        "ram_percent": round(vm.percent, 1),
        "ram_used_mb": vm.used // (1024 * 1024),
        "ram_total_mb": vm.total // (1024 * 1024),
        "disk_percent": round(disk.percent, 1),
    }
