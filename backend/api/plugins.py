from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import Server, Bot, BotWhitelist, DiscordUser
from backend.api.deps import get_current_user, require_admin
from backend.services.plugin_service import PluginService

router = APIRouter(prefix="/api/plugins", tags=["plugins"])


def _get_server_or_404(server_id: int, db: Session) -> Server:
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return server


@router.get("/minecraft/{server_id}")
def list_minecraft_plugins(
    server_id: int,
    plugins_path: str = "/opt/minecraft/plugins",
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    server = _get_server_or_404(server_id, db)
    svc = PluginService(server)
    return svc.list_minecraft_plugins(plugins_path)


@router.post("/minecraft/{server_id}/disable")
def disable_minecraft_plugin(
    server_id: int,
    filename: str,
    plugins_path: str = "/opt/minecraft/plugins",
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = _get_server_or_404(server_id, db)
    svc = PluginService(server)
    return svc.disable_minecraft_plugin(plugins_path, filename)


@router.post("/minecraft/{server_id}/enable")
def enable_minecraft_plugin(
    server_id: int,
    filename: str,
    plugins_path: str = "/opt/minecraft/plugins",
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = _get_server_or_404(server_id, db)
    svc = PluginService(server)
    return svc.enable_minecraft_plugin(plugins_path, filename)


@router.delete("/minecraft/{server_id}/delete")
def delete_minecraft_plugin(
    server_id: int,
    filename: str,
    plugins_path: str = "/opt/minecraft/plugins",
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = _get_server_or_404(server_id, db)
    svc = PluginService(server)
    return svc.delete_plugin(plugins_path, filename)


@router.get("/read-file")
def read_file_content(
    server_id: int,
    path: str,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    """Read a file's content via SSH for code viewing. Max 100KB."""
    if ".." in path:
        raise HTTPException(status_code=400, detail="Invalid path")
    server = _get_server_or_404(server_id, db)
    from backend.services.ssh_service import SSHService
    with SSHService(server) as ssh:
        result = ssh.run_command(f"head -c 102400 {path}")
    if not result.get("success"):
        raise HTTPException(status_code=404, detail="File not found or not readable")
    return {"content": result.get("stdout", ""), "path": path}


@router.get("/list-files")
def list_files(
    server_id: int,
    path: str,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    """List files in a directory via SSH."""
    if ".." in path:
        raise HTTPException(status_code=400, detail="Invalid path")
    server = _get_server_or_404(server_id, db)
    from backend.services.ssh_service import SSHService
    with SSHService(server) as ssh:
        files = ssh.list_files(path)
    return {"files": files, "path": path}


@router.get("/discord-bot/{bot_id}")
def list_discord_bot_cogs(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    # Check access: owner can always access; others need to be in whitelist
    if current_user.role != "owner":
        whitelisted = db.query(BotWhitelist).filter(
            BotWhitelist.bot_id == bot_id,
            BotWhitelist.discord_user_id == current_user.discord_id,
        ).first()
        if not whitelisted:
            raise HTTPException(
                status_code=403,
                detail="Bot nicht verfügbar — Kontaktiere den Owner",
            )

    if not bot.server_id:
        raise HTTPException(status_code=404, detail="Bot has no associated server")

    server = db.query(Server).filter(Server.id == bot.server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    svc = PluginService(server)
    return svc.list_discord_bot_cogs(f"/opt/bots/{bot.name}")
