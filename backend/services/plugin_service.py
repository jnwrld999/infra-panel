import shlex
from backend.db.models import Server
from backend.services.ssh_service import SSHService


class PluginService:
    def __init__(self, server: Server):
        self.server = server

    def list_minecraft_plugins(self, plugins_path: str) -> list[dict]:
        try:
            with SSHService(self.server) as ssh:
                files = ssh.list_files(plugins_path)
        except Exception as e:
            raise RuntimeError(f"SSH-Verbindung fehlgeschlagen: {e}")
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
        qpath = shlex.quote(plugins_path)
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"mv {qpath}/{shlex.quote(filename)} {qpath}/{shlex.quote(new_name)}")

    def enable_minecraft_plugin(self, plugins_path: str, filename: str) -> dict:
        if not filename.endswith(".jar.disabled"):
            return {"success": False, "message": "Not a disabled plugin"}
        new_name = filename.replace(".jar.disabled", ".jar")
        qpath = shlex.quote(plugins_path)
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"mv {qpath}/{shlex.quote(filename)} {qpath}/{shlex.quote(new_name)}")

    def delete_plugin(self, plugins_path: str, filename: str) -> dict:
        if not (filename.endswith(".jar") or filename.endswith(".jar.disabled")):
            return {"success": False, "message": "Invalid file type"}
        if "/" in filename or ".." in filename:
            return {"success": False, "message": "Invalid filename"}
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"rm {shlex.quote(plugins_path)}/{shlex.quote(filename)}")

    def list_discord_bot_cogs(self, bot_path: str) -> list[dict]:
        try:
            with SSHService(self.server) as ssh:
                # Auto-detect: Java (src/main/java/main) → Python (cogs/) → Node.js (src/)
                java_files = ssh.list_files(f"{bot_path}/src/main/java/main", "*.java")
                if java_files:
                    return [
                        {"name": f.replace(".java", ""), "filename": f, "status": "active", "type": "java"}
                        for f in java_files
                    ]

                py_files = ssh.list_files(f"{bot_path}/cogs", "*.py")
                if py_files:
                    return [
                        {"name": f.replace(".py", ""), "filename": f, "status": "active", "type": "discord_cog"}
                        for f in py_files if not f.startswith("__")
                    ]

                js_files = ssh.list_files(f"{bot_path}/src", "*.js")
                if js_files:
                    return [
                        {"name": f.replace(".js", ""), "filename": f, "status": "active", "type": "nodejs"}
                        for f in js_files
                    ]
        except Exception as e:
            raise RuntimeError(f"SSH-Verbindung fehlgeschlagen: {e}")

        return []
