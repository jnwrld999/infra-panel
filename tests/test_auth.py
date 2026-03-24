import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.db.base import Base
from backend.db import models  # noqa: F401
from backend.db.session import get_db


# Setup in-memory test DB using a shared connection so all sessions see the same data
from sqlalchemy import event

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})

# Use a single shared connection to keep the in-memory DB alive across sessions
_shared_connection = test_engine.connect()

@event.listens_for(test_engine, "connect")
def _use_shared_connection(dbapi_connection, connection_record):
    connection_record.info["shared"] = _shared_connection.connection.dbapi_connection

TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.create_all(bind=_shared_connection)


def override_get_db():
    db = TestSessionLocal(bind=_shared_connection)
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app, follow_redirects=False)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


def test_discord_login_redirects():
    response = client.get("/auth/discord/login")
    assert response.status_code in (302, 307)
    location = response.headers.get("location", "")
    assert "discord.com" in location
    assert "oauth2/authorize" in location
    assert "client_id=" in location


def test_logout_clears_cookies():
    # Logout without being authenticated still returns 200 and clears cookies
    response = client.post("/auth/logout")
    assert response.status_code == 200
    # Check cookies are cleared (Set-Cookie header with empty value or deleted)
    data = response.json()
    assert data["message"] == "Logged out"


def test_unauthenticated_me_returns_401():
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token_returns_401():
    client_with_cookie = TestClient(app, follow_redirects=False, cookies={"access_token": "invalid.token.here"})
    response = client_with_cookie.get("/auth/me")
    assert response.status_code == 401


def test_refresh_without_cookie_returns_401():
    response = client.post("/auth/refresh")
    assert response.status_code == 401


def test_me_authenticated_owner_returns_200():
    from backend.core.security import create_access_token
    from backend.config import get_settings

    settings = get_settings()
    owner_id = settings.owner_discord_id

    token = create_access_token({"sub": owner_id})
    response = client.get("/auth/me", cookies={"access_token": token})
    assert response.status_code == 200
    data = response.json()
    assert data["discord_id"] == owner_id
