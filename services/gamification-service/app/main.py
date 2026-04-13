from fastapi import FastAPI
from shared.messagebroker import RedisStreamsBroker  # импорт из shared

app = FastAPI()
broker = RedisStreamsBroker()

@app.post("/test-publish")
async def test_publish():
    event = {"user_id": 123, "action": "task_completed", "points": 100}
    await broker.publish("gamification:events", event)
    return {"status": "published", "event": event}

@app.get("/health")
async def health_check():
    # Здесь можно добавить проверку подключения к БД или Redis
    return {"status": "ok"}