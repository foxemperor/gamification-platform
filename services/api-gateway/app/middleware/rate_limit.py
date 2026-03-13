"""Rate limiting middleware - TODO"""
from fastapi import Request
from typing import Callable

class RateLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        await self.app(scope, receive, send)
