from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import Approval, AuditLog, DiscordUser
from backend.api.deps import require_owner, get_current_user

router = APIRouter(prefix="/api/approvals", tags=["approvals"])

VALID_REVIEW_STATUSES = {"approved", "denied", "held"}


class ApprovalCreate(BaseModel):
    type: str
    payload: dict = {}


class ApprovalReview(BaseModel):
    status: str
    notes: Optional[str] = None
    dm_message: Optional[str] = None


class ApprovalOut(BaseModel):
    id: int
    submitted_by: str
    type: str
    payload: dict
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ApprovalOut])
def list_approvals(
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_owner),
):
    return db.query(Approval).order_by(Approval.created_at.desc()).all()


@router.get("/pending", response_model=list[ApprovalOut])
def list_pending_approvals(
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_owner),
):
    return (
        db.query(Approval)
        .filter(Approval.status == "pending")
        .order_by(Approval.created_at.desc())
        .all()
    )


@router.post("/", response_model=ApprovalOut, status_code=status.HTTP_201_CREATED)
def submit_approval(
    body: ApprovalCreate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    approval = Approval(
        submitted_by=current_user.discord_id,
        type=body.type,
        payload=body.payload,
        status="pending",
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    return approval


@router.patch("/{approval_id}", response_model=ApprovalOut)
def review_approval(
    approval_id: int,
    body: ApprovalReview,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_owner),
):
    if body.status not in VALID_REVIEW_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_REVIEW_STATUSES)}",
        )

    approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    approval.status = body.status
    approval.reviewed_by = current_user.discord_id
    approval.reviewed_at = datetime.now(timezone.utc)
    if body.notes is not None:
        approval.notes = body.notes

    audit = AuditLog(
        actor_discord_id=current_user.discord_id,
        action=f"approval_{body.status}",
        target=str(approval_id),
        details=body.notes or "",
    )
    db.add(audit)
    db.commit()
    db.refresh(approval)

    # Best-effort DM to submitter
    if body.status in ("approved", "denied"):
        dm_msg = body.dm_message or (
            "✅ Deine Anfrage wurde **genehmigt**." if body.status == "approved"
            else "❌ Deine Anfrage wurde **abgelehnt**."
        )
        try:
            import asyncio
            from backend.discord_bot.bot import send_dm as _send_dm
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(_send_dm(approval.submitted_by, dm_msg))
            else:
                asyncio.run(_send_dm(approval.submitted_by, dm_msg))
        except Exception:
            pass  # Bot not running — skip DM silently

    return approval
