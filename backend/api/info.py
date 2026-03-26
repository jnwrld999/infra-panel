"""Public info/version endpoint."""
import os
from datetime import datetime, timezone
from fastapi import APIRouter
from backend.version import __version__
from backend.config import get_settings

router = APIRouter()
settings = get_settings()

# Capture build/startup date once at import time
_BUILD_DATE = datetime.now(timezone.utc).date().isoformat()


@router.get("/api/info")
async def get_info():
    """Return application version and runtime metadata. No authentication required."""
    return {
        "name": "InfraPanel",
        "version": __version__,
        "latest_version": os.getenv("LATEST_VERSION", __version__),
        "build_date": _BUILD_DATE,
        "environment": "production" if settings.frontend_url.startswith("https") else "development",
    }
