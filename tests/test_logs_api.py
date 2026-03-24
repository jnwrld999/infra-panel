import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.db.base import Base
from backend.db import models  # noqa: F401
from backend.db.session import get_db
from backend.core.security import create_access_token
from backend.config import get_settings

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})

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

settings = get_settings()
owner_id = settings.owner_discord_id
owner_token = create_access_token({"sub": owner_id})

client = TestClient(app, follow_redirects=False, cookies={"access_token": owner_token})


def test_logs_empty():
    # Clean up logs table
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.AppLog).delete()
    db.commit()
    db.close()

    response = client.get("/api/logs/")
    assert response.status_code == 200
    assert response.json() == []


def test_audit_logs_empty():
    # Clean up audit logs table
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.AuditLog).delete()
    db.commit()
    db.close()

    response = client.get("/api/logs/audit")
    assert response.status_code == 200
    assert response.json() == []


def test_sync_jobs_empty():
    # Clean up sync jobs table
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.SyncJob).delete()
    db.commit()
    db.close()

    response = client.get("/api/sync/")
    assert response.status_code == 200
    assert response.json() == []


def test_log_export_csv():
    # Clean up logs first
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.AppLog).delete()
    db.commit()
    db.close()

    response = client.get("/api/logs/export/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
