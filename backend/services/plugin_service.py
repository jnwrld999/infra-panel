from backend.db.models import Server
from backend.services.ssh_service import SSHService


class PluginService:
    def __init__(self, server: Server):
        self.server = server

    def list_minecraft_plugins(self, plugins_path: str) -> list[dict]:
        with SSHService(self.server) as ssh:
            files = ssh.list_files(plugins_path)
        plugins = []
        for f in files:
            if f.endswith(".jar.disabled"):
                plugins.append({"name": f.replace(".jar.disabled", ""), "filename": f, "status": "disabled", "type": "minecraft"})
            elif f.endswith(".jar"):
                plugins.append({"name": f.replace(".jar", ""), "filename": f, "status": "active", "type": "minecraft"})
        return plugins

    def disable_minecraft_plugin(self, plugins_path: str, filename: str) -> dict:
        if not filename.endswith(".jar"):
            return {"success": False, "message": "Not a .jar file"}
        new_name = filename + ".disabled"
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"mv {plugins_path}/{filename} {plugins_path}/{new_name}")

    def enable_minecraft_plugin(self, plugins_path: str, filename: str) -> dict:
        if not filename.endswith(".jar.disabled"):
            return {"success": False, "message": "Not a disabled plugin"}
        new_name = filename.replace(".jar.disabled", ".jar")
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"mv {plugins_path}/{filename} {plugins_path}/{new_name}")

    def delete_plugin(self, plugins_path: str, filename: str) -> dict:
        if not (filename.endswith(".jar") or filename.endswith(".jar.disabled")):
            return {"success": False, "message": "Invalid file type"}
        if "/" in filename or ".." in filename:
            return {"success": False, "message": "Invalid filename"}
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"rm {plugins_path}/{filename}")

    def list_discord_bot_cogs(self, bot_path: str) -> list[dict]:
        with SSHService(self.server) as ssh:
            files = ssh.list_files(f"{bot_path}/cogs", "*.py")
        return [
            {"name": f.replace(".py", ""), "filename": f, "status": "active", "type": "discord_cog"}
            for f in files if not f.startswith("__")
        ]
