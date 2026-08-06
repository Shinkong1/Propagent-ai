"""Endpoints meant to be hit by an external scheduler (e.g. cron-job.org),
not a browser or the dashboard — production has no paid background worker
deployed, so anything that would normally run on a Celery beat schedule
runs here instead, triggered by a free periodic HTTP call. Protected by a
shared secret header rather than user auth, since the caller isn't a
logged-in user.
"""
import logging
import hmac

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from database.session import get_db
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal/cron", tags=["internal-cron"])


def _require_cron_secret(x_cron_secret: str = Header(None, alias="X-Cron-Secret")):
    if not settings.CRON_SECRET:
        raise HTTPException(status_code=503, detail="CRON_SECRET is not configured on the server")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, settings.CRON_SECRET):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Cron-Secret header")


@router.post("/process-outreach-queue", dependencies=[Depends(_require_cron_secret)])
async def process_outreach_queue_endpoint(db: Session = Depends(get_db)):
    from services.lead_service import process_outreach_queue
    result = await run_in_threadpool(process_outreach_queue, db)
    return result
