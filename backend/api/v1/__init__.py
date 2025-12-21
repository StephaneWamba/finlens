"""
API v1
"""

from fastapi import APIRouter

from backend.api.v1.routes import chat_router, health_router, auth_router, users_router, subscriptions_router, documents_router

# Create v1 API router
api_router = APIRouter(prefix="/v1")

# Include route modules
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(subscriptions_router)
api_router.include_router(documents_router)
api_router.include_router(chat_router)
api_router.include_router(health_router)

__all__ = ["api_router"]

