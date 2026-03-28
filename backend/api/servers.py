import json
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import Server
from backend.api.deps import get_current_user, require_admin
from backend.db.models import DiscordUser
from backend.services.ssh_service import SSHService
from backend.services.health_service import check_server_health
from backend.db.session import SessionLocal

router = APIRouter(prefix="/api/servers", tags=["servers"])


def _health_bg(server_id: int) -> None:
    """Run a health check in a background task with its own db session."""
    import asyncio
    db = SessionLocal()
    try:
        server = db.query(Server).filter(Server.id == server_id).first()
        if server:
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(check_server_health(server, db))
            finally:
                loop.close()
    finally:
        db.close()


class ServerCreate(BaseModel):
    name: str
    host: str
    port: int = 22
    ssh_user: str = "root"
    ssh_key_path: Optional[str] = None
    description: Optional[str] = None
    tags: list = []


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    ssh_user: Optional[str] = None
    ssh_key_path: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list] = None


def _server_to_dict(server: Server) -> dict:
    return {
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": server.port,
        "ssh_user": server.ssh_user,
        "description": server.description,
        "tags": server.tags if server.tags is not None else [],
        "status": server.status,
        "status_message": server.status_message,
        "last_checked": server.last_checked.isoformat() if server.last_checked else None,
    }


@router.get("/")
def list_servers(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    servers = db.query(Server).all()
    stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=2)
    for s in servers:
        lc = s.last_checked
        if lc is None or s.status == "unknown" or (lc.tzinfo is None and lc < datetime.utcnow() - timedelta(minutes=2)) or (lc.tzinfo is not None and lc < stale_threshold):
            background_tasks.add_task(_health_bg, s.id)
    return [_server_to_dict(s) for s in servers]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_server(
    data: ServerCreate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = Server(
        name=data.name,
        host=data.host,
        port=data.port,
        ssh_user=data.ssh_user,
        ssh_key_path=data.ssh_key_path,
        description=data.description,
        tags=data.tags,
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return _server_to_dict(server)


@router.get("/{server_id}")
def get_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return _server_to_dict(server)


@router.patch("/{server_id}")
def update_server(
    server_id: int,
    data: ServerUpdate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)
    db.commit()
    db.refresh(server)
    return _server_to_dict(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    db.delete(server)
    db.commit()
    return None


@router.post("/{server_id}/test-connection")
def test_connection(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    svc = SSHService(server)
    result = svc.test_connection()
    return result


@router.post("/{server_id}/health-check")
def trigger_health_check(
    server_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    background_tasks.add_task(_health_bg, server_id)
    return {"message": "Health check triggered", "server_id": server_id}


_STATS_CMD = (
    "python3 -c \""
    "import time,json,subprocess;"
    "s1=list(map(int,open('/proc/stat').readline().split()[1:]));"
    "time.sleep(0.3);"
    "s2=list(map(int,open('/proc/stat').readline().split()[1:]));"
    "idle=s2[3]-s1[3];tot=sum(b-a for a,b in zip(s1,s2));"
    "cpu=round(100*(1-idle/tot),1) if tot else 0.0;"
    "lines=open('/proc/meminfo').readlines();"
    "m={l.split(':')[0]:int(l.split()[1]) for l in lines if ':' in l and len(l.split())>1};"
    "rt=m.get('MemTotal',0)*1024;"
    "ru=(m.get('MemTotal',0)-m.get('MemAvailable',m.get('MemFree',0)))*1024;"
    "r=subprocess.check_output(['df','-B1','/']).decode().splitlines()[1].split();"
    "print(json.dumps({'cpu':cpu,'ram_used':ru,'ram_total':rt,'disk_used':int(r[2]),'disk_total':int(r[1])}));"
    "\""
)


@router.get("/{server_id}/stats")
def get_server_stats(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    try:
        with SSHService(server) as svc:
            result = svc.run_command(_STATS_CMD, timeout=8)
        if result["exit_code"] != 0 or not result["stdout"].strip():
            raise HTTPException(status_code=503, detail="Stats unavailable")
        return json.loads(result["stdout"].strip())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Stats unavailable: {e}")
