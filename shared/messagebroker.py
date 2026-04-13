import asyncio
import json
from typing import Any, Dict, List, AsyncGenerator
from redis.asyncio import Redis

class RedisStreamsBroker:
    def __init__(self, redis_url: str = "redis://gamification-redis:6379"):
        self.redis = Redis.from_url(redis_url)
        self.group_name = "gamification-group"
    
    async def publish(self, stream: str, event: Dict[str, Any]):
        """Publisher: публикует событие в stream"""
        await self.redis.xadd(stream, event, maxlen=10000)  # maxlen для персистентности
    
    async def consume(self, stream: str, consumer_name: str = "worker-1") -> List[Dict]:
        """Consumer: читает события из stream (consumer group)"""
        try:
            await self.redis.xgroup_create(stream, self.group_name, mkstream=True)
        except:
            pass  # группа уже существует
        
        while True:
            events = await self.redis.xreadgroup(
                self.group_name, consumer_name, {stream: ">"}, count=10, block=5000
            )
            for _, messages in events:
                for msg_id, msg_data in messages:
                    yield msg_id, msg_data
                    await self.redis.xack(stream, self.group_name, msg_id)
