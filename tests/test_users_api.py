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


def _clean_users():
    db = SharedTestSessionLocal(bind=_shared_conn)
    db.query(models.DiscordUser).filter(models.DiscordUser.role != "owner").delete()
    db.commit()
    db.close()


def test_list_users_empty():
    _clean_users()
    response = client.get("/api/users/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_add_user():
    _clean_users()
    payload = {"discord_id": "111222333444555666", "role": "viewer"}
    response = client.post("/api/users/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["discord_id"] == "111222333444555666"
    assert data["role"] == "viewer"
    assert data["verified"] == True


def test_update_user_role():
    _clean_users()
    # Create user first
    client.post("/api/users/", json={"discord_id": "222333444555666777", "role": "viewer"})
    # Update role
    response = client.patch("/api/users/222333444555666777", json={"role": "operator"})
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "operator"


def test_deactivate_user():
    _clean_users()
    # Create user first
    client.post("/api/users/", json={"discord_id": "333444555666777888", "role": "viewer"})
    # Deactivate
    response = client.patch("/api/users/333444555666777888", json={"active": False})
    assert response.status_code == 200
    data = response.json()
    assert data["active"] == False
