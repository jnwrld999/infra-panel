from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.db.session import get_db
from backend.db.models import SyncJob, Server, DiscordUser
from backend.api.deps import get_current_user, require_admin
from backend.services.sync_service import run_sync_job

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncJobCreate(BaseModel):
    server_id: int
    source_path: str
    dest_path: str
    scheduled: bool = False
    dry_run: bool = False


class SyncRunRequest(BaseModel):
    dry_run: bool = False


def _job_to_dict(job: SyncJob) -> dict:
    return {
        "id": job.id,
        "server_id": job.server_id,
        "source_path": job.source_path,
        "dest_path": job.dest_path,
        "last_run": job.last_run.isoformat() if job.last_run else None,
        "last_status": job.last_status,
        "scheduled": job.scheduled,
        "dry_run": job.dry_run,
    }


@router.get("/")
def list_sync_jobs(
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(get_current_user),
):
    jobs = db.query(SyncJob).all()
    return [_job_to_dict(j) for j in jobs]


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_sync_job(
    data: SyncJobCreate,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    server = db.query(Server).filter(Server.id == data.server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    job = SyncJob(
        server_id=data.server_id,
        source_path=data.source_path,
        dest_path=data.dest_path,
        scheduled=data.scheduled,
        dry_run=data.dry_run,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.post("/{job_id}/run")
def run_sync(
    job_id: int,
    data: SyncRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: DiscordUser = Depends(require_admin),
):
    job = db.query(SyncJob).filter(SyncJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Sync job not found")

    if data.dry_run:
        result = run_sync_job(job_id, dry_run=True)
        return result
    else:
        background_tasks.add_task(run_sync_job, job_id, False)
        return {"message": "Sync job started in background", "job_id": job_id}
