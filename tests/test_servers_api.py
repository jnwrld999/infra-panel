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

# Setup in-memory test DB using a shared connection so all sessions see the same data
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


def test_list_servers_empty():
    # Ensure DB is clean by deleting all servers before this test
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.Server).delete()
    db.commit()
    db.close()

    response = client.get("/api/servers/")
    assert response.status_code == 200
    assert response.json() == []


def test_create_server():
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.Server).delete()
    db.commit()
    db.close()

    payload = {
        "name": "MyServer",
        "host": "192.168.1.100",
        "port": 22,
        "ssh_user": "root",
    }
    response = client.post("/api/servers/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "MyServer"
    assert data["status"] == "unknown"
    assert "id" in data


def test_get_server():
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.Server).delete()
    db.commit()
    db.close()

    create_resp = client.post("/api/servers/", json={
        "name": "GetServer",
        "host": "10.0.0.1",
    })
    assert create_resp.status_code == 201
    server_id = create_resp.json()["id"]

    response = client.get(f"/api/servers/{server_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == server_id
    assert data["name"] == "GetServer"


def test_update_server():
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.Server).delete()
    db.commit()
    db.close()

    create_resp = client.post("/api/servers/", json={
        "name": "OldName",
        "host": "10.0.0.2",
    })
    assert create_resp.status_code == 201
    server_id = create_resp.json()["id"]

    patch_resp = client.patch(f"/api/servers/{server_id}", json={"name": "NewName"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "NewName"


def test_delete_server():
    db = TestSessionLocal(bind=_shared_connection)
    db.query(models.Server).delete()
    db.commit()
    db.close()

    create_resp = client.post("/api/servers/", json={
        "name": "DeleteMe",
        "host": "10.0.0.3",
    })
    assert create_resp.status_code == 201
    server_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/api/servers/{server_id}")
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/api/servers/{server_id}")
    assert get_resp.status_code == 404
