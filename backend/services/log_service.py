from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from backend.db.models import AppLog, TokenBlocklist


def write_log(
    db: Session,
    level: str,
    category: str,
    message: str,
    server_id: Optional[int] = None,
    discord_user_id: Optional[str] = None,
    details: Optional[dict] = None,
) -> AppLog:
    log = AppLog(
        level=level,
        category=category,
        message=message,
        server_id=server_id,
        discord_user_id=discord_user_id,
        details=details or {},
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_logs(
    db: Session,
    category: Optional[str] = None,
    level: Optional[str] = None,
    server_id: Optional[int] = None,
    discord_user_id: Optional[str] = None,
    days: int = 7,
    limit: int = 500,
) -> list[AppLog]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = db.query(AppLog).filter(AppLog.timestamp >= cutoff)

    if category:
        query = query.filter(AppLog.category == category)
    if level:
        query = query.filter(AppLog.level == level)
    if server_id is not None:
        query = query.filter(AppLog.server_id == server_id)
    if discord_user_id:
        query = query.filter(AppLog.discord_user_id == discord_user_id)

    return query.order_by(AppLog.timestamp.desc()).limit(limit).all()


def cleanup_old_logs(db: Session, days: int = 30) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    deleted_logs = db.query(AppLog).filter(AppLog.timestamp < cutoff).delete(synchronize_session=False)
    deleted_tokens = db.query(TokenBlocklist).filter(TokenBlocklist.expires_at < datetime.now(timezone.utc)).delete(synchronize_session=False)

    db.commit()
    return {"deleted_logs": deleted_logs, "deleted_tokens": deleted_tokens}
