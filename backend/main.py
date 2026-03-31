import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.config import get_settings
from backend.core.rate_limit import limiter
from backend.db.session import create_tables, get_db
from backend.version import __version__

logger = logging.getLogger(__name__)
from backend.api import auth
from backend.api import info as info_router
from backend.api import servers
from backend.api import plugins
from backend.api import services
from backend.api import logs
from backend.api import bots
from backend.api import users
from backend.api import approvals
from backend.api import embed_presets

settings = get_settings()


def _startup_checks():
    settings = get_settings()
    if settings.jwt_secret in ("changeme", ""):
        logger.critical("SECURITY: jwt_secret is not set — set JWT_SECRET in .env before running in production!")
    if settings.secret_key in ("changeme", ""):
        logger.critical("SECURITY: secret_key is not set — set SECRET_KEY in .env before running in production!")
    if not settings.fernet_key:
        logger.warning("SECURITY: fernet_key is not set — token encryption uses an ephemeral key (data lost on restart)")


def _cleanup_expired_blocklist():
    """Remove TokenBlocklist entries whose original token has already expired."""
    from backend.db.models import TokenBlocklist
    try:
        db = next(get_db())
        cutoff = datetime.now(timezone.utc)
        deleted = db.query(TokenBlocklist).filter(TokenBlocklist.expires_at < cutoff).delete()
        db.commit()
        if deleted:
            logger.info("Cleaned up %d expired token blocklist entries", deleted)
    except Exception as exc:
        logger.warning("Token blocklist cleanup failed: %s", exc)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _startup_checks()
    create_tables()
    _cleanup_expired_blocklist()
    yield


_dev = os.getenv("ENV", "production") != "production"
app = FastAPI(
    title="InfraPanel API",
    version=__version__,
    docs_url="/api/docs" if _dev else None,
    redoc_url="/api/redoc" if _dev else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Cookie"],
)

app.include_router(info_router.router)
app.include_router(auth.router, prefix="/auth")
app.include_router(servers.router)
app.include_router(plugins.router)
app.include_router(services.router)
app.include_router(logs.router)
app.include_router(bots.router)
app.include_router(users.router)
app.include_router(approvals.router)
app.include_router(embed_presets.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": __version__}
