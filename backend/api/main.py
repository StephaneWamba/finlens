"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.core.auth.rate_limit import get_rate_limit_key

from backend.api.v1 import api_router
from backend.config.logging import setup_logging
from backend.config.settings import settings
from backend.core.utils.async_logger import stop_all_async_loggers

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    logger.info("Starting FinLens API...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info("API started successfully")

    yield

    # Shutdown
    logger.info("Shutting down FinLens API...")
    # Stop all async loggers gracefully
    try:
        stop_all_async_loggers()
        logger.info("Async loggers stopped successfully")
    except Exception as e:
        # Use standard logging for shutdown errors (async logger may be stopped)
        import sys
        print(f"Error stopping async loggers: {e}", file=sys.stderr)


# Create FastAPI app
app = FastAPI(
    title="FinLens API",
    description="Financial Reports Analysis API with 3-Agent System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Rate limiting (uses user_id if authenticated, otherwise IP address)
limiter = Limiter(key_func=get_rate_limit_key)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
# Convert CORS_ORIGINS string to list
cors_origins = [
    settings.CORS_ORIGINS] if settings.CORS_ORIGINS != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "FinLens API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check_root():
    """Root-level health check for Railway"""
    from backend.api.v1.routes.health import health_check
    return await health_check()


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
