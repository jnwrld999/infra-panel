from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import Server, DiscordUser
from backend.api.deps import get_current_user, require_admin
from backend.services.service_manager import ServiceManager

router = APIRouter(prefix="/api/services", tags=["services"])


class ServiceActionRequest(BaseModel):
    service_name: str
    action: str
    service_type: str  # "systemd", "docker", "pm2"


def _get_server_or_404(server_id: int, db: Session) -> Server:
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server


@router.post("/{server_id}/action")
def service_action(
    server_id: int,
    data: ServiceActionRequest,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = _get_server_or_404(server_id, db)
    mgr = ServiceManager(server)

    if data.service_type == "systemd":
        return mgr.systemd_action(data.service_name, data.action)
    elif data.service_type == "docker":
        return mgr.docker_action(data.service_name, data.action)
    elif data.service_type == "pm2":
        return mgr.pm2_action(data.service_name, data.action)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown service_type: {data.service_type}")


@router.get("/{server_id}/docker")
def list_docker_containers(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    server = _get_server_or_404(server_id, db)
    mgr = ServiceManager(server)
    return mgr.docker_list()


@router.get("/{server_id}/pm2")
def list_pm2_processes(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    server = _get_server_or_404(server_id, db)
    mgr = ServiceManager(server)
    return mgr.pm2_list()
