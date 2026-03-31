from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.db.models import SavedEmbed, DiscordUser
from backend.api.deps import get_current_user

router = APIRouter(prefix="/api/embed-presets", tags=["embed-presets"])


class SaveEmbedRequest(BaseModel):
    name: str
    bot_id: Optional[int] = None
    channel_id: Optional[str] = None
    data: dict  # embed + buttons + content


class UpdateEmbedRequest(BaseModel):
    name: Optional[str] = None
    bot_id: Optional[int] = None
    channel_id: Optional[str] = None
    data: Optional[dict] = None


def _to_dict(e: SavedEmbed) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "bot_id": e.bot_id,
        "channel_id": e.channel_id,
        "data": e.data,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


@router.get("/")
def list_presets(
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    presets = db.query(SavedEmbed).filter(
        SavedEmbed.discord_user_id == current_user.discord_id
    ).order_by(SavedEmbed.updated_at.desc()).all()
    return [_to_dict(p) for p in presets]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_preset(
    body: SaveEmbedRequest,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    preset = SavedEmbed(
        name=body.name,
        discord_user_id=current_user.discord_id,
        bot_id=body.bot_id,
        channel_id=body.channel_id,
        data=body.data,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return _to_dict(preset)


@router.patch("/{preset_id}")
def update_preset(
    preset_id: int,
    body: UpdateEmbedRequest,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    preset = db.query(SavedEmbed).filter(
        SavedEmbed.id == preset_id,
        SavedEmbed.discord_user_id == current_user.discord_id,
    ).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    if body.name is not None:
        preset.name = body.name
    if body.bot_id is not None:
        preset.bot_id = body.bot_id
    if body.channel_id is not None:
        preset.channel_id = body.channel_id
    if body.data is not None:
        preset.data = body.data
    preset.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(preset)
    return _to_dict(preset)


@router.delete("/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preset(
    preset_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    preset = db.query(SavedEmbed).filter(
        SavedEmbed.id == preset_id,
        SavedEmbed.discord_user_id == current_user.discord_id,
    ).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    db.delete(preset)
    db.commit()
