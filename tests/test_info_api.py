"""Tests for GET /api/info version endpoint."""
from fastapi.testclient import TestClient
from backend.main import app
from backend import version as version_module

client = TestClient(app)


def test_info_returns_200():
    res = client.get("/api/info")
    assert res.status_code == 200


def test_info_has_version():
    res = client.get("/api/info")
    data = res.json()
    assert "version" in data
    assert isinstance(data["version"], str)
    assert len(data["version"]) > 0


def test_info_version_matches_version_module():
    res = client.get("/api/info")
    data = res.json()
    assert data["version"] == version_module.__version__


def test_info_has_required_fields():
    res = client.get("/api/info")
    data = res.json()
    for field in ("version", "build_date", "environment"):
        assert field in data, f"Missing field: {field}"


def test_info_build_date_is_iso_format():
    res = client.get("/api/info")
    data = res.json()
    build_date = data["build_date"]
    # Should be a valid ISO date string like "2026-03-25"
    assert len(build_date) >= 10
    parts = build_date[:10].split("-")
    assert len(parts) == 3
    assert all(p.isdigit() for p in parts)


def test_info_no_auth_required():
    """Public endpoint — no cookie needed."""
    res = client.get("/api/info")
    assert res.status_code != 401


def test_version_module_reads_file():
    assert version_module.__version__ == "1.0.0"
