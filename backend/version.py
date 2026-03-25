"""Single source of truth for InfraPanel version."""
from pathlib import Path

_VERSION_FILE = Path(__file__).parent.parent / "VERSION"

def _read_version() -> str:
    try:
        return _VERSION_FILE.read_text().strip()
    except OSError:
        return "0.0.0"

__version__ = _read_version()
