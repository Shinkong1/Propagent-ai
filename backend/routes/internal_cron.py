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


@router.post("/finance-reconcile", dependencies=[Depends(_require_cron_secret)])
async def finance_reconcile_endpoint(db: Session = Depends(get_db)):
    """Cross-checks recent Stripe checkout sessions against our Organization
    records and self-heals any drift (a paid Stripe session whose org never
    got its plan/subscription updated -- exactly the failure mode that let
    a real customer's payment go unrecorded until they reported it
    themselves). Alerts the owner by email whenever it heals or flags
    anything; stays silent when everything's already in sync so this
    doesn't become noise. Meant to be hit every 15-30 min by the same free
    external scheduler already driving /process-outreach-queue."""
    from services.finance_reconciliation_service import reconcile_stripe_sessions, summarize_reconciliation_for_alert
    from services.communication_agent import send_email
    from models.user import User

    result = await run_in_threadpool(reconcile_stripe_sessions, db)

    if result["healed"] or result["flagged"]:
        summary = await summarize_reconciliation_for_alert(result)
        subject = (
            f"[PropAgent] Billing reconciliation: {len(result['healed'])} auto-fixed, "
            f"{len(result['flagged'])} need review"
        )
        # Same "find the master/owner account" pattern services/owner_notify.py
        # uses -- no separate OWNER_EMAIL setting to keep in sync.
        owner = db.query(User).filter(User.is_master == True, User.is_active == True).first()
        if owner and owner.email:
            try:
                await run_in_threadpool(send_email, owner.email, subject, summary)
            except Exception as e:
                logger.error(f"finance_reconcile: failed to send owner alert email: {e}")
        else:
            logger.warning("finance_reconcile: no active master/owner account found — alert logged only.")

    return result
