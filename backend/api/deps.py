from datetime import datetime, timezone
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import DiscordUser, TokenBlocklist
from backend.core.security import verify_token
from backend.config import get_settings


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> DiscordUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )
    if not access_token:
        raise credentials_exception

    payload = verify_token(access_token)
    if not payload:
        raise credentials_exception

    if payload.get("type") != "access":
        raise credentials_exception

    # Check token blocklist
    jti = payload.get("jti")
    if jti:
        blocked = db.query(TokenBlocklist).filter(TokenBlocklist.jti == jti).first()
        if blocked:
            raise credentials_exception

    discord_id: str = payload.get("sub")
    if not discord_id:
        raise credentials_exception

    user = db.query(DiscordUser).filter(DiscordUser.discord_id == discord_id).first()

    # Auto-create owner if not in DB
    settings = get_settings()
    if not user and discord_id == settings.owner_discord_id:
        user = DiscordUser(
            discord_id=discord_id,
            username="Owner",
            role="owner",
            verified=True,
            active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user or not user.active:
        raise credentials_exception

    # Update last_action
    user.last_action = datetime.now(timezone.utc)
    db.commit()

    return user


def require_owner(current_user: DiscordUser = Depends(get_current_user)) -> DiscordUser:
    settings = get_settings()
    if current_user.discord_id != settings.owner_discord_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    return current_user


def require_admin(current_user: DiscordUser = Depends(get_current_user)) -> DiscordUser:
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
