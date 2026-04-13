from celery import Celery
import os

# Настройки берутся из переменных окружения, которые в docker-compose
celery_app = Celery(
    "worker",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2")
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(name="process_gamification_event")
def process_gamification_event(data):
    # Эта задача будет выполняться асинхронно воркером
    print(f"Шина сообщений получила данные: {data}")
    return {"status": "success", "processed_data": data}