"""
Health check routes
"""

import logging
from fastapi import APIRouter, HTTPException

from backend.api.v1.schemas.chat import HealthResponse
from backend.config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.

    Returns:
        HealthResponse with service status
    """
    services = {}

    # Check Supabase
    try:
        from backend.config.database.supabase_client import get_supabase_client
        client = get_supabase_client()
        # Simple check - try to access client
        services["supabase"] = "connected" if client else "disconnected"
    except Exception as e:
        logger.warning(f"Supabase check failed: {e}")
        services["supabase"] = "error"

    # Check Qdrant
    try:
        from backend.core.ai.vector_db.qdrant_client import get_qdrant_client
        qdrant = get_qdrant_client()
        # Try to get collections (this will fail if Qdrant is not running)
        qdrant.client.get_collections()
        services["qdrant"] = "connected"
    except Exception as e:
        logger.warning(f"Qdrant check failed: {e}")
        # Check if it's a connection error
        error_msg = str(e).lower()
        if "connection" in error_msg or "refused" in error_msg or "timeout" in error_msg:
            services["qdrant"] = "not_running"
        else:
            services["qdrant"] = "error"

    # Check OpenAI (if API key is set)
    try:
        if settings.OPENAI_API_KEY:
            services["openai"] = "configured"
        else:
            services["openai"] = "not_configured"
    except Exception as e:
        logger.warning(f"OpenAI check failed: {e}")
        services["openai"] = "error"

    # Determine overall status
    if all(status in ["connected", "configured"] for status in services.values()):
        status = "healthy"
    elif any(status == "error" for status in services.values()):
        status = "degraded"
    else:
        status = "unhealthy"

    return HealthResponse(
        status=status,
        version="1.0.0",
        services=services
    )


@router.get("/ready")
async def readiness_check():
    """
    Readiness check - verifies all critical services are available.

    Returns:
        200 if ready, 503 if not ready
    """
    try:
        # Check critical services
        from backend.config.database.supabase_client import get_supabase_client

        # Supabase
        supabase_client = get_supabase_client()
        if not supabase_client:
            raise HTTPException(
                status_code=503, detail="Supabase not available")

        # Qdrant
        from backend.core.ai.vector_db.qdrant_client import get_qdrant_client
        qdrant = get_qdrant_client()
        collections = qdrant.client.get_collections()
        if not collections:
            raise HTTPException(status_code=503, detail="Qdrant not available")

        # OpenAI
        if not settings.OPENAI_API_KEY:
            raise HTTPException(
                status_code=503, detail="OpenAI API key not configured")

        return {"status": "ready"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(
            status_code=503, detail=f"Service not ready: {str(e)}")
