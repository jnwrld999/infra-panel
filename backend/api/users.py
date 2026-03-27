from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from backend.db.session import get_db
from backend.db.models import DiscordUser, TokenBlocklist, AuditLog, Bot
from backend.api.deps import require_owner, require_admin, get_current_user
from backend.config import get_settings

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = {"viewer", "operator", "admin", "moderator", "owner", "bot_owner"}


class UserCreate(BaseModel):
    discord_id: str
    role: str = "viewer"
    language: str = "en"


class UserUpdate(BaseModel):
    role: Optional[str] = None
    verified: Optional[bool] = None
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
    added_by: Optional[str] = None
    added_at: Optional[datetime] = None
    last_action: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
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


@router.patch("/{user_id}", response_model=UserOut)
def update_user_by_id(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    user = db.query(DiscordUser).filter(DiscordUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    settings = get_settings()
    if user.discord_id == settings.owner_discord_id and current_user.discord_id != settings.owner_discord_id:
        raise HTTPException(status_code=403, detail="Cannot modify the owner account")

    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        user.role = body.role

    if body.verified is not None:
        user.verified = body.verified

    if body.active is not None:
        user.active = body.active

    if body.language is not None:
        user.language = body.language

    audit = AuditLog(
        actor_discord_id=current_user.discord_id,
        action="update_user",
        target=user.discord_id,
        details=str(body.model_dump(exclude_none=True)),
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{discord_id}/by_discord_id", response_model=UserOut)
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


@router.get("/{user_id}/bot-access")
def get_user_bot_access(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    user = db.query(DiscordUser).filter(DiscordUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    from backend.db.models import BotWhitelist
    entries = db.query(BotWhitelist).filter(BotWhitelist.discord_user_id == user.discord_id).all()
    bot_ids = [e.bot_id for e in entries]
    return {"discord_id": user.discord_id, "bot_ids": bot_ids}


@router.get("/{user_id}")
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    user = db.query(DiscordUser).filter(DiscordUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_dict = {
        "id": user.id,
        "discord_id": user.discord_id,
        "username": user.username,
        "role": user.role,
        "verified": user.verified,
        "active": user.active,
        "language": user.language,
        "added_by": user.added_by,
        "added_at": user.added_at,
        "last_action": user.last_action,
        "assigned_bot": None,
    }

    if user.role == "bot_owner":
        bot = db.query(Bot).filter(Bot.owner_discord_id == user.discord_id).first()
        if bot:
            user_dict["assigned_bot"] = {"id": bot.id, "name": bot.name}

    return user_dict


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
