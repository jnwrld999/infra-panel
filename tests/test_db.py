import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from backend.db.base import Base
from backend.db import models  # noqa: F401


EXPECTED_TABLES = {
    "servers",
    "discord_users",
    "bots",
    "bot_whitelists",
    "plugins",
    "sync_jobs",
    "token_blocklist",
    "audit_logs",
    "approvals",
    "app_logs",
}


@pytest.fixture
def db_engine():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    SessionLocal = sessionmaker(bind=db_engine)
    session = SessionLocal()
    yield session
    session.close()


def test_all_10_tables_exist(db_engine):
    inspector = inspect(db_engine)
    tables = set(inspector.get_table_names())
    # alembic_version table may be missing in memory DB, ignore it
    assert EXPECTED_TABLES.issubset(tables), f"Missing tables: {EXPECTED_TABLES - tables}"


def test_create_server(db_session):
    server = models.Server(
        name="Test Server",
        host="192.168.1.1",
        port=22,
        ssh_user="root",
        description="Test",
        tags=["test", "dev"],
    )
    db_session.add(server)
    db_session.commit()
    db_session.refresh(server)
    assert server.id is not None
    assert server.name == "Test Server"
    assert server.tags == ["test", "dev"]


def test_bot_whitelist_relationship(db_session):
    server = models.Server(name="BotServer", host="10.0.0.1")
    db_session.add(server)
    db_session.commit()

    bot = models.Bot(name="TestBot", server_id=server.id, type="discord")
    db_session.add(bot)
    db_session.commit()

    entry = models.BotWhitelist(
        bot_id=bot.id,
        discord_user_id="123456789",
        added_by="756848540491448332",
    )
    db_session.add(entry)
    db_session.commit()

    db_session.refresh(bot)
    assert len(bot.whitelist) == 1
    assert bot.whitelist[0].discord_user_id == "123456789"
