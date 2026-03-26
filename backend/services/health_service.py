import asyncio
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.db.models import Server, AppLog
from backend.services.ssh_service import SSHService

async def check_server_health(server: Server, db: Session) -> str:
    loop = asyncio.get_event_loop()
    svc = SSHService(server)
    try:
        result = await loop.run_in_executor(None, svc.test_connection)
        status = "online" if result["success"] else "offline"
        server.status_message = None if result["success"] else result.get("message", "")
    except Exception as e:
        status = "offline"
        server.status_message = str(e)
    server.status = status
    server.last_checked = datetime.now(timezone.utc)
    db.add(AppLog(level="INFO", category="health", server_id=server.id, message=f"Health check: {status}"))
    db.commit()
    return status

async def check_all_servers(db: Session) -> dict:
    """Sequential checks — SQLAlchemy sessions are not concurrent-safe."""
    servers = db.query(Server).all()
    results = {}
    for server in servers:
        try:
            status = await check_server_health(server, db)
            results[server.id] = status
        except Exception:
            results[server.id] = "offline"
    return results
