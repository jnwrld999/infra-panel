"""
Shared test infrastructure.

Provides a single in-memory SQLite database for all API tests,
preventing cross-file state contamination when multiple test files
each register app.dependency_overrides[get_db].

This conftest is loaded FIRST by pytest. We use a pytest plugin hook
(pytest_collection_finish) to re-apply our override AFTER all test
modules have been imported (and potentially overridden it), ensuring
all API calls during test execution use a single shared DB.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.db.base import Base
from backend.db import models  # noqa: F401
from backend.db.session import get_db

# Single shared engine / connection for ALL test files
SHARED_TEST_DB_URL = "sqlite:///:memory:"
_shared_engine = create_engine(SHARED_TEST_DB_URL, connect_args={"check_same_thread": False})
_shared_conn = _shared_engine.connect()


@event.listens_for(_shared_engine, "connect")
def _use_shared_conn(dbapi_connection, connection_record):
    connection_record.info["shared"] = _shared_conn.connection.dbapi_connection


SharedTestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_shared_engine)

Base.metadata.create_all(bind=_shared_conn)


def _override_get_db():
    db = SharedTestSessionLocal(bind=_shared_conn)
    try:
        yield db
    finally:
        db.close()


def pytest_collection_finish(session):
    """
    Called after ALL test modules have been collected (and imported).
    Re-apply our single shared DB override so it wins over any
    per-file overrides set during module-level import.
    """
    app.dependency_overrides[get_db] = _override_get_db
