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


def _bot_to_dict(bot: Bot, restricted: bool = False) -> dict:
    if restricted:
        return {"id": bot.id, "name": bot.name, "restricted": True}
    return {
        "id": bot.id,
        "name": bot.name,
        "server_id": bot.server_id,
        "type": bot.type,
        "status": bot.status,
        "description": bot.description,
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
        "restricted": False,
    }


@router.get("/")
def list_bots(
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    bots = db.query(Bot).all()
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

    # Owner always has access; others need to be whitelisted
    if current_user.role != "owner":
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
