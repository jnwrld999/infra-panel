import subprocess
from datetime import datetime, timezone
from backend.db.models import Server, SyncJob, AppLog


class SyncService:
    def __init__(self, server: Server):
        self.server = server

    def _rsync_cmd(self, source: str, dest_path: str, dry_run: bool = False) -> list[str]:
        cmd = ["rsync", "-avz", "--progress"]
        if dry_run:
            cmd.append("--dry-run")
        ssh_cmd = f"ssh -p {self.server.port}"
        if self.server.ssh_key_path:
            ssh_cmd += f" -i {self.server.ssh_key_path}"
        ssh_cmd += " -o StrictHostKeyChecking=no"
        cmd += ["-e", ssh_cmd]
        cmd.append(source)
        cmd.append(f"{self.server.ssh_user}@{self.server.host}:{dest_path}")
        return cmd

    def sync(self, source: str, dest_path: str, dry_run: bool = False) -> dict:
        cmd = self._rsync_cmd(source, dest_path, dry_run)
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            return {"success": result.returncode == 0, "stdout": result.stdout, "stderr": result.stderr, "dry_run": dry_run, "command": " ".join(cmd)}
        except subprocess.TimeoutExpired:
            return {"success": False, "stderr": "Sync timed out after 300s", "dry_run": dry_run}
        except FileNotFoundError:
            return {"success": False, "stderr": "rsync not found. Install: sudo apt install rsync", "dry_run": dry_run}


def run_sync_job(job_id: int, dry_run: bool = False) -> dict:
    """Creates its own DB session — safe for BackgroundTasks (request session is already closed)."""
    from backend.db.session import SessionLocal
    db = SessionLocal()
    try:
        job = db.query(SyncJob).filter(SyncJob.id == job_id).first()
        if not job:
            return {"success": False, "stderr": f"Job {job_id} not found"}
        svc = SyncService(job.server)
        result = svc.sync(job.source_path, job.dest_path, dry_run=dry_run)
        if not dry_run:
            job.last_run = datetime.now(timezone.utc)
            job.last_status = "success" if result["success"] else "failed"
            db.add(AppLog(level="INFO" if result["success"] else "ERROR", category="sync", server_id=job.server_id,
                         message=f"Sync {'succeeded' if result['success'] else 'failed'}: {job.source_path} → {job.dest_path}",
                         details={"stdout": result.get("stdout", "")[:500]}))
            db.commit()
        return result
    finally:
        db.close()
