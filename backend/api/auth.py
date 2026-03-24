from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx

from backend.config import get_settings
from backend.db.session import get_db
from backend.db.models import DiscordUser, AuditLog, TokenBlocklist
from backend.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
)
from backend.api.deps import get_current_user

router = APIRouter()
settings = get_settings()

DISCORD_API_BASE = "https://discord.com/api/v10"
DISCORD_OAUTH_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"


def _is_secure() -> bool:
    return settings.frontend_url.startswith("https")


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    secure = _is_secure()
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.jwt_access_token_expire_minutes * 60,
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.jwt_refresh_token_expire_days * 86400,
    )


def _clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", httponly=True)
    response.delete_cookie("refresh_token", httponly=True)


def _add_audit_log(db: Session, action: str, actor_id: str | None = None,
                   target: str | None = None, details: str | None = None,
                   ip: str | None = None):
    log = AuditLog(
        actor_discord_id=actor_id,
        action=action,
        target=target,
        details=details,
        ip_address=ip,
    )
    db.add(log)
    db.commit()


@router.get("/discord/login")
async def discord_login():
    """Redirect to Discord OAuth2 authorization page."""
    params = (
        f"client_id={settings.discord_client_id}"
        f"&redirect_uri={settings.oauth2_redirect_uri}"
        f"&response_type=code"
        f"&scope=identify"
    )
    return RedirectResponse(f"{DISCORD_OAUTH_URL}?{params}")


@router.get("/discord/callback")
async def discord_callback(
    request: Request,
    code: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Handle Discord OAuth2 callback."""
    ip = request.client.host if request.client else None

    if error or not code:
        return RedirectResponse(f"{settings.frontend_url}/no-access")

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            DISCORD_TOKEN_URL,
            data={
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.oauth2_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if token_resp.status_code != 200:
        _add_audit_log(db, "discord_oauth_token_error", details=token_resp.text, ip=ip)
        return RedirectResponse(f"{settings.frontend_url}/no-access")

    token_data = token_resp.json()
    discord_access_token = token_data.get("access_token")

    # Get Discord user info
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            f"{DISCORD_API_BASE}/users/@me",
            headers={"Authorization": f"Bearer {discord_access_token}"},
        )

    if user_resp.status_code != 200:
        _add_audit_log(db, "discord_oauth_user_error", details=user_resp.text, ip=ip)
        return RedirectResponse(f"{settings.frontend_url}/no-access")

    discord_user_data = user_resp.json()
    discord_id = discord_user_data["id"]
    username = discord_user_data.get("username", "Unknown")

    # Check/create DB user
    user = db.query(DiscordUser).filter(DiscordUser.discord_id == discord_id).first()

    if not user:
        # Auto-create owner
        if discord_id == settings.owner_discord_id:
            user = DiscordUser(
                discord_id=discord_id,
                username=username,
                role="owner",
                verified=True,
                active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            _add_audit_log(db, "login_denied_unknown_user", actor_id=discord_id,
                           target=username, ip=ip)
            return RedirectResponse(f"{settings.frontend_url}/no-access")
    else:
        if not user.active:
            _add_audit_log(db, "login_denied_inactive_user", actor_id=discord_id,
                           target=username, ip=ip)
            return RedirectResponse(f"{settings.frontend_url}/no-access")
        # Update username
        user.username = username
        user.last_action = datetime.now(timezone.utc)
        db.commit()

    # Issue JWT tokens
    access_token = create_access_token({"sub": discord_id})
    refresh_token = create_refresh_token(discord_id)

    _add_audit_log(db, "login_success", actor_id=discord_id, target=username, ip=ip)

    response = RedirectResponse(f"{settings.frontend_url}/dashboard")
    _set_auth_cookies(response, access_token, refresh_token)
    return response


@router.post("/refresh")
async def refresh_tokens(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Rotate refresh token and issue new access + refresh tokens."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    payload = verify_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    jti = payload.get("jti")
    if jti:
        blocked = db.query(TokenBlocklist).filter(TokenBlocklist.jti == jti).first()
        if blocked:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    discord_id = payload.get("sub")
    user = db.query(DiscordUser).filter(DiscordUser.discord_id == discord_id).first()
    if not user or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Blocklist old refresh token
    if jti:
        exp = payload.get("exp")
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else datetime.now(timezone.utc)
        blocked_entry = TokenBlocklist(
            jti=jti,
            expires_at=expires_at,
            reason="rotated",
        )
        db.add(blocked_entry)
        db.commit()

    # Issue new tokens
    new_access = create_access_token({"sub": discord_id})
    new_refresh = create_refresh_token(discord_id)

    _set_auth_cookies(response, new_access, new_refresh)
    return {"message": "Tokens refreshed"}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Blocklist both tokens and clear cookies."""
    access_token = request.cookies.get("access_token")
    refresh_token_val = request.cookies.get("refresh_token")

    for token in [access_token, refresh_token_val]:
        if token:
            payload = verify_token(token)
            if payload:
                jti = payload.get("jti")
                exp = payload.get("exp")
                if jti:
                    exists = db.query(TokenBlocklist).filter(TokenBlocklist.jti == jti).first()
                    if not exists:
                        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else datetime.now(timezone.utc)
                        blocked_entry = TokenBlocklist(
                            jti=jti,
                            expires_at=expires_at,
                            reason="logout",
                        )
                        db.add(blocked_entry)

    db.commit()
    _clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.get("/me")
async def get_me(current_user: DiscordUser = Depends(get_current_user)):
    """Return current authenticated user info."""
    return {
        "discord_id": current_user.discord_id,
        "username": current_user.username,
        "role": current_user.role,
        "verified": current_user.verified,
        "active": current_user.active,
        "language": current_user.language,
        "added_at": current_user.added_at,
        "last_action": current_user.last_action,
    }
