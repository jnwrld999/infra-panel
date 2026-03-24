from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.config import get_settings
from backend.core.rate_limit import limiter
from backend.db.session import create_tables
from backend.api import auth

settings = get_settings()

app = FastAPI(
    title="InfraPanel API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth")


@app.on_event("startup")
def on_startup():
    create_tables()


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
