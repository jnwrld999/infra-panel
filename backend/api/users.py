from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from backend.db.session import get_db
from backend.db.models import DiscordUser, TokenBlocklist, AuditLog
from backend.api.deps import require_owner, get_current_user
from backend.config import get_settings

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"viewer", "operator", "admin", "owner"}


class UserCreate(BaseModel):
    discord_id: str
    role: str = "viewer"
    language: str = "en"


class UserUpdate(BaseModel):
    role: Optional[str] = None
    active: Optional[bool] = None
    language: Optional[str] = None


class UserOut(BaseModel):
    id: int
    discord_id: str
    username: str
    role: str
    verified: bool
    active: bool
    language: str
    added_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_owner),
):
    return db.query(DiscordUser).all()


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def add_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_owner),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")

    existing = db.query(DiscordUser).filter(DiscordUser.discord_id == body.discord_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")

    user = DiscordUser(
        discord_id=body.discord_id,
        username=body.discord_id,
        role=body.role,
        language=body.language,
        verified=True,
        active=True,
        added_by=current_user.discord_id,
    )
    db.add(user)

    audit = AuditLog(
        actor_discord_id=current_user.discord_id,
        action="add_user",
        target=body.discord_id,
        details=f"role={body.role}",
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{discord_id}", response_model=UserOut)
def update_user(
    discord_id: str,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_owner),
):
    settings = get_settings()
    if discord_id == settings.owner_discord_id:
        raise HTTPException(status_code=403, detail="Cannot modify owner")

    user = db.query(DiscordUser).filter(DiscordUser.discord_id == discord_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        user.role = body.role

    if body.active is not None:
        user.active = body.active
        if not body.active:
            # Block all existing tokens for this user by adding a blocklist entry
            # We add a sentinel entry with jti = "revoke:<discord_id>" to signal revocation
            # In practice the token check in deps.py checks by jti, so we rely on active=False check
            # The active=False check in get_current_user already blocks inactive users
            pass

    if body.language is not None:
        user.language = body.language

    audit = AuditLog(
        actor_discord_id=current_user.discord_id,
        action="update_user",
        target=discord_id,
        details=str(body.model_dump(exclude_none=True)),
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{discord_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    discord_id: str,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_owner),
):
    settings = get_settings()
    if discord_id == settings.owner_discord_id:
        raise HTTPException(status_code=403, detail="Cannot delete owner")

    user = db.query(DiscordUser).filter(DiscordUser.discord_id == discord_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return None
