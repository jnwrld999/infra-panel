import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.config import get_settings


def test_owner_discord_id():
    settings = get_settings()
    assert settings.owner_discord_id == "756848540491448332"


def test_allowed_origins_list():
    settings = get_settings()
    origins = settings.allowed_origins_list
    assert isinstance(origins, list)
    assert len(origins) >= 1
    for origin in origins:
        assert origin.startswith("http")
