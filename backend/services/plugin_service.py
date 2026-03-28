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
                java_files = ssh.list_files(f"{bot_path}/src/main/java/main", "*.java")
                if java_files:
                    return [
                        {"name": f.replace(".java", ""), "filename": f, "status": "active", "type": "java"}
                        for f in java_files
                    ]

                py_files = ssh.list_files(f"{bot_path}/cogs", "*.py") + ssh.list_files(f"{bot_path}/cogs", "*.py.disabled")
                if py_files:
                    result = []
                    for f in py_files:
                        if f.startswith("__"):
                            continue
                        is_disabled = f.endswith(".py.disabled")
                        name = f.replace(".py.disabled", "").replace(".py", "")
                        result.append({"name": name, "filename": f, "status": "disabled" if is_disabled else "active", "type": "discord_cog"})
                    return result

                js_files = ssh.list_files(f"{bot_path}/src", "*.js") + ssh.list_files(f"{bot_path}/src", "*.js.disabled")
                if js_files:
                    result = []
                    for f in js_files:
                        is_disabled = f.endswith(".js.disabled")
                        name = f.replace(".js.disabled", "").replace(".js", "")
                        result.append({"name": name, "filename": f, "status": "disabled" if is_disabled else "active", "type": "nodejs"})
                    return result
        except Exception as e:
            raise RuntimeError(f"SSH-Verbindung fehlgeschlagen: {e}")

        return []

    def toggle_discord_cog(self, bot_path: str, filename: str, enable: bool) -> dict:
        """Disable by renaming .py→.py.disabled or .js→.js.disabled, enable reverses it."""
        if enable:
            if filename.endswith('.py.disabled'):
                new_name = filename[:-len('.disabled')]
                folder = f"{bot_path}/cogs"
            elif filename.endswith('.js.disabled'):
                new_name = filename[:-len('.disabled')]
                folder = f"{bot_path}/src"
            else:
                return {"success": False, "message": "Not a disabled cog"}
        else:
            if filename.endswith('.py'):
                new_name = filename + '.disabled'
                folder = f"{bot_path}/cogs"
            elif filename.endswith('.js'):
                new_name = filename + '.disabled'
                folder = f"{bot_path}/src"
            else:
                return {"success": False, "message": "Cannot disable this file type"}
        if '/' in filename or '..' in filename:
            return {"success": False, "message": "Invalid filename"}
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"mv {shlex.quote(folder)}/{shlex.quote(filename)} {shlex.quote(folder)}/{shlex.quote(new_name)}")
