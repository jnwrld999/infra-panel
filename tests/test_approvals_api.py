import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient

from backend.main import app
from backend.db import models  # noqa: F401
from backend.core.security import create_access_token
from backend.config import get_settings

# Use the shared DB from conftest (conftest.py is loaded first by pytest)
from tests.conftest import SharedTestSessionLocal, _shared_conn

settings = get_settings()
owner_id = settings.owner_discord_id
owner_token = create_access_token({"sub": owner_id})

client = TestClient(app, follow_redirects=False, cookies={"access_token": owner_token})


def _clean_approvals():
    db = SharedTestSessionLocal(bind=_shared_conn)
    db.query(models.Approval).delete()
    db.query(models.AuditLog).delete()
    db.commit()
    db.close()


def test_list_approvals_empty():
    _clean_approvals()
    response = client.get("/api/approvals/")
    assert response.status_code == 200
    assert response.json() == []


def test_submit_approval():
    _clean_approvals()
    payload = {"type": "server_restart", "payload": {"server": "prod-1"}}
    response = client.post("/api/approvals/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "server_restart"
    assert data["status"] == "pending"
    assert data["submitted_by"] == owner_id


def test_approve_approval():
    _clean_approvals()
    # Submit one first
    create_resp = client.post(
        "/api/approvals/",
        json={"type": "deploy", "payload": {"env": "production"}},
    )
    assert create_resp.status_code == 201
    approval_id = create_resp.json()["id"]

    # Approve it
    response = client.patch(f"/api/approvals/{approval_id}", json={"status": "approved"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "approved"
    assert data["reviewed_by"] == owner_id

    # Clean up AuditLog so other tests aren't affected
    _clean_approvals()
