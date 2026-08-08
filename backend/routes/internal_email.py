"""Webhook fed by the Cloudflare Email Worker (infra/cloudflare/
email-reply-worker.js) — detects when a lead replies to a Lead CRM
outreach email and automatically marks it replied + queues the step-2
follow-up, instead of relying on a human noticing the reply in a real
inbox and clicking "mark replied" manually.

How it connects: every outreach email now carries a per-lead Reply-To of
reply+{lead_id}@propagent.app (see services/lead_service.py's
process_outreach_queue). Cloudflare Email Routing already forwards all
mail for the domain; the Worker additionally inspects the recipient
address, and when it matches that reply+<uuid>@ pattern, extracts the
lead id and POSTs it here — then still forwards the actual email to the
real inbox so a human can read the reply's content, same as before.

Separate shared-secret auth from /internal/cron/* (EMAIL_WORKER_SECRET,
not CRON_SECRET) since this is a different trust boundary — a Cloudflare
Worker's environment, not a scheduler service's.
"""
import logging
import hmac
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from database.session import get_db
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internal/email", tags=["internal-email"])


def _require_email_worker_secret(x_email_worker_secret: str = Header(None, alias="X-Email-Worker-Secret")):
    if not settings.EMAIL_WORKER_SECRET:
        raise HTTPException(status_code=503, detail="EMAIL_WORKER_SECRET is not configured on the server")
    if not x_email_worker_secret or not hmac.compare_digest(x_email_worker_secret, settings.EMAIL_WORKER_SECRET):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Email-Worker-Secret header")


@router.post("/inbound-reply", dependencies=[Depends(_require_email_worker_secret)])
async def inbound_reply(payload: dict, db: Session = Depends(get_db)):
    """Body: {"lead_id": "<uuid>", "from": "<sender address, for logging>"}.
    Idempotent-ish: if the lead's latest outreach email is already marked
    replied, this just no-ops on that part (mark_lead_replied always sets
    replied_at only if it wasn't already set) but will still be called
    again by a duplicate/retried Worker delivery -- harmless either way."""
    lead_id_raw = payload.get("lead_id")
    if not lead_id_raw:
        raise HTTPException(status_code=400, detail="Missing lead_id")
    try:
        lead_id = UUID(lead_id_raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="lead_id is not a valid UUID")

    from services.lead_service import mark_lead_replied, queue_followup_email

    lead = await run_in_threadpool(mark_lead_replied, db, lead_id)
    if not lead:
        logger.warning(f"inbound_reply: no lead found for id {lead_id} (from={payload.get('from')})")
        return {"matched": False}

    logger.info(f"inbound_reply: lead {lead_id} marked replied via inbound email (from={payload.get('from')})")
    await queue_followup_email(lead, db)
    return {"matched": True, "lead_id": str(lead_id)}
