from backend.db.models import Server
from backend.services.ssh_service import SSHService
import json

ALLOWED_ACTIONS = {"start", "stop", "restart", "status"}


def _safe_name(name: str) -> bool:
    return name.replace("-", "").replace("_", "").replace(".", "").isalnum()


class ServiceManager:
    def __init__(self, server: Server):
        self.server = server

    def systemd_action(self, service_name: str, action: str) -> dict:
        if action not in ALLOWED_ACTIONS:
            return {"success": False, "message": f"Invalid action: {action}"}
        if not _safe_name(service_name):
            return {"success": False, "message": "Invalid service name"}
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"systemctl {action} {service_name}")

    def systemd_status(self, service_name: str) -> dict:
        with SSHService(self.server) as ssh:
            result = ssh.run_command(f"systemctl is-active {service_name}")
        return {"active": result["stdout"].strip() == "active", **result}

    def docker_action(self, container_name: str, action: str) -> dict:
        if action not in ALLOWED_ACTIONS:
            return {"success": False, "message": f"Invalid action: {action}"}
        if not _safe_name(container_name):
            return {"success": False, "message": "Invalid container name"}
        with SSHService(self.server) as ssh:
            return ssh.run_command(f"docker {action} {container_name}")

    def docker_list(self) -> list[dict]:
        with SSHService(self.server) as ssh:
            result = ssh.run_command('docker ps --format "{{.Names}}|{{.Status}}|{{.Image}}"')
        containers = []
        for line in result["stdout"].strip().splitlines():
            parts = line.split("|")
            if len(parts) == 3:
                containers.append({"name": parts[0], "status": parts[1], "image": parts[2]})
        return containers

    def pm2_action(self, process_name: str, action: str) -> dict:
        if action not in ALLOWED_ACTIONS:
            return {"success": False, "message": f"Invalid action: {action}"}
        if not _safe_name(process_name):
            return {"success": False, "message": "Invalid process name"}
        cmd = f"pm2 restart {process_name} --update-env" if action == "restart" else f"pm2 {action} {process_name}"
        with SSHService(self.server) as ssh:
            return ssh.run_command(cmd)

    def pm2_list(self) -> list[dict]:
        with SSHService(self.server) as ssh:
            result = ssh.run_command("pm2 jlist 2>/dev/null")
        try:
            processes = json.loads(result["stdout"])
            return [{"name": p.get("name"), "status": p.get("pm2_env", {}).get("status"), "pid": p.get("pid")} for p in processes]
        except Exception:
            return []
