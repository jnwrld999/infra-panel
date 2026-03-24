import csv
import io
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import AppLog, AuditLog, DiscordUser
from backend.api.deps import get_current_user, require_admin
from backend.services.log_service import get_logs

router = APIRouter(prefix="/api/logs", tags=["logs"])


def _log_to_dict(log: AppLog) -> dict:
    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "level": log.level,
        "category": log.category,
        "server_id": log.server_id,
        "discord_user_id": log.discord_user_id,
        "message": log.message,
        "details": log.details,
    }


def _audit_to_dict(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "actor_discord_id": log.actor_discord_id,
        "action": log.action,
        "target": log.target,
        "details": log.details,
        "ip_address": log.ip_address,
    }


@router.get("/")
def list_logs(
    category: Optional[str] = None,
    level: Optional[str] = None,
    server_id: Optional[int] = None,
    days: int = Query(default=7, le=30),
    limit: int = Query(default=500, le=500),
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    logs = get_logs(db, category=category, level=level, server_id=server_id, days=days, limit=limit)
    return [_log_to_dict(log) for log in logs]


@router.get("/audit")
def list_audit_logs(
    days: int = Query(default=7, le=30),
    limit: int = Query(default=500, le=500),
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    logs = db.query(AuditLog).filter(AuditLog.timestamp >= cutoff).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [_audit_to_dict(log) for log in logs]


@router.get("/export/csv")
def export_logs_csv(
    category: Optional[str] = None,
    days: int = Query(default=7, le=30),
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    logs = get_logs(db, category=category, days=days, limit=500)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "timestamp", "level", "category", "server_id", "discord_user_id", "message", "details"])
    for log in logs:
        writer.writerow([
            log.id,
            log.timestamp.isoformat() if log.timestamp else "",
            log.level,
            log.category,
            log.server_id,
            log.discord_user_id,
            log.message,
            str(log.details) if log.details else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=logs.csv"},
    )
