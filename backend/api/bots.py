import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import Bot, BotWhitelist, DiscordUser
from backend.api.deps import get_current_user, require_admin
from backend.core.security import encrypt, decrypt

router = APIRouter(prefix="/api/bots", tags=["bots"])


class BotCreate(BaseModel):
    name: str
    server_id: Optional[int] = None
    token: str
    type: str = "discord"
    description: Optional[str] = None


class BotUpdate(BaseModel):
    name: Optional[str] = None
    server_id: Optional[int] = None
    token: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    owner_discord_id: Optional[str] = None


class EmbedFieldPayload(BaseModel):
    name: str = ""
    value: str = ""
    inline: bool = False


class EmbedPayload(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    color: Optional[int] = None
    author: Optional[str] = None
    footer: Optional[str] = None
    image: Optional[str] = None
    thumbnail: Optional[str] = None
    fields: list[EmbedFieldPayload] = []


class SendEmbedRequest(BaseModel):
    embed: EmbedPayload
    channel_id: str
    message_id: Optional[str] = None


def _bot_to_dict(bot: Bot, restricted: bool = False) -> dict:
    if restricted:
        return {"id": bot.id, "name": bot.name, "restricted": True}
    server_info = None
    if bot.server:
        server_info = {
            "name": bot.server.name,
            "host": bot.server.host,
            "status": bot.server.status,
        }
    return {
        "id": bot.id,
        "name": bot.name,
        "server_id": bot.server_id,
        "server": server_info,
        "type": bot.type,
        "status": bot.status,
        "token_configured": bool(bot.token_encrypted),
        "description": bot.description,
        "owner_discord_id": bot.owner_discord_id,
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
        "restricted": False,
    }


@router.get("/")
def list_bots(
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    bots = db.query(Bot).all()

    # Filter for bot_owner role: only show bots where owner_discord_id matches
    if current_user.role == "bot_owner":
        bots = [b for b in bots if b.owner_discord_id == current_user.discord_id]
        return [_bot_to_dict(b) for b in bots]

    result = []
    for bot in bots:
        if current_user.role == "owner":
            result.append(_bot_to_dict(bot, restricted=False))
        else:
            whitelisted = db.query(BotWhitelist).filter(
                BotWhitelist.bot_id == bot.id,
                BotWhitelist.discord_user_id == current_user.discord_id,
            ).first()
            if whitelisted:
                result.append(_bot_to_dict(bot, restricted=False))
            else:
                result.append(_bot_to_dict(bot, restricted=True))
    return result


@router.get("/{bot_id}")
def get_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if current_user.role != "owner":
        whitelisted = db.query(BotWhitelist).filter(
            BotWhitelist.bot_id == bot_id,
            BotWhitelist.discord_user_id == current_user.discord_id,
        ).first()
        if not whitelisted:
            raise HTTPException(status_code=403, detail="Access denied")
    return _bot_to_dict(bot)


@router.patch("/{bot_id}")
def update_bot(
    bot_id: int,
    data: BotUpdate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    is_admin_or_owner = current_user.role in ("admin", "owner")
    is_bot_owner_of_this = (
        current_user.role == "bot_owner"
        and bot.owner_discord_id == current_user.discord_id
    )
    if not is_admin_or_owner and not is_bot_owner_of_this:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = data.model_dump(exclude_unset=True)
    # bot_owner may only update name
    if is_bot_owner_of_this and not is_admin_or_owner:
        update_data = {k: v for k, v in update_data.items() if k == "name"}

    if "token" in update_data:
        bot.token_encrypted = encrypt(update_data.pop("token"))
    for field, value in update_data.items():
        setattr(bot, field, value)
    db.commit()
    db.refresh(bot)
    return _bot_to_dict(bot)


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_bot(
    data: BotCreate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    encrypted_token = encrypt(data.token)
    bot = Bot(
        name=data.name,
        server_id=data.server_id,
        token_encrypted=encrypted_token,
        type=data.type,
        description=data.description,
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return _bot_to_dict(bot)


@router.get("/{bot_id}/token")
def get_bot_token(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Owner always has access; bot_owner can access their own bot; others need to be whitelisted
    if current_user.role != "owner":
        is_bot_owner_of_this = (
            current_user.role == "bot_owner"
            and bot.owner_discord_id == current_user.discord_id
        )
        if not is_bot_owner_of_this:
            whitelisted = db.query(BotWhitelist).filter(
                BotWhitelist.bot_id == bot_id,
                BotWhitelist.discord_user_id == current_user.discord_id,
            ).first()
            if not whitelisted:
                raise HTTPException(status_code=403, detail="Access denied")

    if not bot.token_encrypted:
        raise HTTPException(status_code=404, detail="No token stored")

    token = decrypt(bot.token_encrypted)
    return {"token": token}


@router.post("/{bot_id}/whitelist/{discord_id}", status_code=status.HTTP_201_CREATED)
def add_to_whitelist(
    bot_id: int,
    discord_id: str,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    existing = db.query(BotWhitelist).filter(
        BotWhitelist.bot_id == bot_id,
        BotWhitelist.discord_user_id == discord_id,
    ).first()
    if existing:
        return {"message": "Already whitelisted"}

    entry = BotWhitelist(
        bot_id=bot_id,
        discord_user_id=discord_id,
        added_by=current_user.discord_id,
    )
    db.add(entry)
    db.commit()
    return {"message": "Added to whitelist", "discord_id": discord_id}


@router.delete("/{bot_id}/whitelist/{discord_id}", status_code=status.HTTP_200_OK)
def remove_from_whitelist(
    bot_id: int,
    discord_id: str,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")

    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    entry = db.query(BotWhitelist).filter(
        BotWhitelist.bot_id == bot_id,
        BotWhitelist.discord_user_id == discord_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not in whitelist")

    db.delete(entry)
    db.commit()
    return {"message": "Removed from whitelist", "discord_id": discord_id}


@router.post("/{bot_id}/send-embed")
def send_embed(
    bot_id: int,
    body: SendEmbedRequest,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    """Send or edit a Discord message with an embed using the bot's token."""
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    if current_user.role != "owner":
        is_bot_owner = (
            current_user.role == "bot_owner"
            and bot.owner_discord_id == current_user.discord_id
        )
        if not is_bot_owner:
            whitelisted = db.query(BotWhitelist).filter(
                BotWhitelist.bot_id == bot_id,
                BotWhitelist.discord_user_id == current_user.discord_id,
            ).first()
            if not whitelisted:
                raise HTTPException(status_code=403, detail="Access denied")

    if not bot.token_encrypted:
        raise HTTPException(status_code=400, detail="Bot has no token configured")

    token = decrypt(bot.token_encrypted)
    e = body.embed

    payload_embed: dict = {}
    if e.title:
        payload_embed["title"] = e.title
    if e.description:
        payload_embed["description"] = e.description
    if e.color is not None:
        payload_embed["color"] = e.color
    if e.footer:
        payload_embed["footer"] = {"text": e.footer}
    if e.image:
        payload_embed["image"] = {"url": e.image}
    if e.thumbnail:
        payload_embed["thumbnail"] = {"url": e.thumbnail}
    if e.author:
        payload_embed["author"] = {"name": e.author}
    non_empty_fields = [
        {"name": f.name, "value": f.value, "inline": f.inline}
        for f in e.fields
        if f.name or f.value
    ]
    if non_empty_fields:
        payload_embed["fields"] = non_empty_fields

    headers = {"Authorization": f"Bot {token}"}
    channel_id = body.channel_id
    message_id = body.message_id

    try:
        with httpx.Client(timeout=10) as http:
            if message_id:
                url = f"https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}"
                resp = http.patch(url, headers=headers, json={"embeds": [payload_embed]})
            else:
                url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
                resp = http.post(url, headers=headers, json={"embeds": [payload_embed]})

        if not resp.is_success:
            try:
                detail = resp.json().get("message", str(resp.status_code))
            except Exception:
                detail = str(resp.status_code)
            raise HTTPException(status_code=502, detail=f"Discord API: {detail}")

        return {"success": True, "message_id": resp.json().get("id")}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Discord API unavailable: {exc}")
