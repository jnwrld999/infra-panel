import paramiko, os, io, shlex
from typing import Optional
from backend.db.models import Server
from backend.core.security import decrypt

class SSHService:
    def __init__(self, server: Server):
        self.server = server
        self.client: Optional[paramiko.SSHClient] = None

    def _get_pkey(self):
        if self.server.ssh_key_path and os.path.exists(self.server.ssh_key_path):
            try:
                return paramiko.RSAKey.from_private_key_file(self.server.ssh_key_path)
            except Exception:
                try:
                    return paramiko.Ed25519Key.from_private_key_file(self.server.ssh_key_path)
                except Exception:
                    return None
        if self.server.ssh_key_content_encrypted:
            try:
                content = decrypt(self.server.ssh_key_content_encrypted)
                f = io.StringIO(content)
                try:
                    return paramiko.RSAKey.from_private_key(f)
                except Exception:
                    f.seek(0)
                    return paramiko.Ed25519Key.from_private_key(f)
            except Exception:
                return None
        return None

    def connect(self, timeout: int = 10):
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        pkey = self._get_pkey()
        kwargs = {"hostname": self.server.host, "port": self.server.port or 22, "username": self.server.ssh_user or "root", "timeout": timeout}
        if pkey:
            kwargs["pkey"] = pkey
        self.client.connect(**kwargs)

    def disconnect(self):
        if self.client:
            self.client.close()
            self.client = None

    def run_command(self, command: str, timeout: int = 30) -> dict:
        if not self.client:
            self.connect()
        _, stdout, stderr = self.client.exec_command(command, timeout=timeout)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        exit_code = stdout.channel.recv_exit_status()
        return {"stdout": out, "stderr": err, "exit_code": exit_code, "success": exit_code == 0}

    def list_files(self, path: str, pattern: str = "*") -> list[str]:
        result = self.run_command(f"ls {shlex.quote(path)}/{pattern} 2>/dev/null")
        files = []
        for line in result["stdout"].strip().splitlines():
            fname = line.strip().split("/")[-1]
            if fname:
                files.append(fname)
        return files

    def file_exists(self, path: str) -> bool:
        result = self.run_command(f"test -e {path} && echo yes || echo no")
        return result["stdout"].strip() == "yes"

    def read_file(self, path: str) -> str:
        return self.run_command(f"cat {path}")["stdout"]

    def test_connection(self) -> dict:
        try:
            self.connect(timeout=5)
            result = self.run_command("echo pong")
            self.disconnect()
            return {"success": True, "message": "Connection OK", "response": result["stdout"].strip()}
        except paramiko.AuthenticationException:
            return {"success": False, "message": "Authentication failed"}
        except paramiko.SSHException as e:
            return {"success": False, "message": f"SSH error: {e}"}
        except Exception as e:
            return {"success": False, "message": f"Connection failed: {e}"}
        finally:
            self.disconnect()

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *args):
        self.disconnect()
