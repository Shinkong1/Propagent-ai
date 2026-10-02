"""Public write endpoint for website visitor analytics.

Called server-to-server by the Next.js route frontend/pages/api/track.ts (never
by the visitor's browser directly), which is why geo comes from the Vercel
edge headers it can see and why a shared secret -- not a per-IP rate limit --
is the access control: every call arrives from Vercel's egress, so an IP-keyed
limit would throttle all real traffic together while doing nothing to stop an
attacker who knows the URL. Without the secret configured the endpoint is
off, same fail-closed pattern as CRON_SECRET in routes/internal_cron.py.

The read side (owner-only summary) is GET /admin/site-traffic in routes/admin.py.
"""
import hmac
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings
from database.session import get_db
from services.site_analytics_service import record_visit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/site-traffic", tags=["site-traffic"])


class TrackPayload(BaseModel):
    path: str = Field(max_length=300)
    is_entry: bool = False
    source: Optional[str] = Field(None, max_length=120)
    referrer_host: Optional[str] = Field(None, max_length=200)
    utm_medium: Optional[str] = Field(None, max_length=120)
    utm_campaign: Optional[str] = Field(None, max_length=120)
    country: Optional[str] = Field(None, max_length=2)
    region: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    device: Optional[str] = Field(None, max_length=10)
    visitor_hash: Optional[str] = Field(None, max_length=64)


def _require_track_secret(x_track_secret: str = Header(None, alias="X-Track-Secret")):
    if not settings.ANALYTICS_TRACK_SECRET:
        raise HTTPException(status_code=503, detail="Site analytics is not configured on this server")
    if not x_track_secret or not hmac.compare_digest(x_track_secret, settings.ANALYTICS_TRACK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Track-Secret header")


@router.post("/track", status_code=204, dependencies=[Depends(_require_track_secret)])
async def track(payload: TrackPayload, db: Session = Depends(get_db)):
    try:
        await run_in_threadpool(record_visit, db, payload.model_dump())
    except Exception:
        # Analytics must never surface as an error to the caller, and a failed
        # insert shouldn't leave the session in a broken transaction state.
        logger.warning("site-traffic: failed to record visit", exc_info=True)
        db.rollback()
