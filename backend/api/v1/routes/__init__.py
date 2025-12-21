"""
API v1 routes
"""

from backend.api.v1.routes.chat import router as chat_router
from backend.api.v1.routes.health import router as health_router
from backend.api.v1.routes.auth import router as auth_router
from backend.api.v1.routes.users import router as users_router
from backend.api.v1.routes.subscriptions import router as subscriptions_router
from backend.api.v1.routes.documents import router as documents_router

__all__ = ["chat_router", "health_router", "auth_router", "users_router", "subscriptions_router", "documents_router"]

