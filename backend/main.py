import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.config import get_settings
from backend.core.rate_limit import limiter
from backend.db.session import create_tables
from backend.version import __version__
from backend.api import auth
from backend.api import info as info_router
from backend.api import servers
from backend.api import plugins
from backend.api import services
from backend.api import logs
from backend.api import bots
from backend.api import users
from backend.api import approvals

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


_dev = os.getenv("ENV", "production") != "production"
app = FastAPI(
    title="GalaxyCraft Bot Panel API",
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


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": __version__}
