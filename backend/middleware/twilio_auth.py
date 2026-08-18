"""Twilio webhook signature verification.

Twilio signs every webhook request with an X-Twilio-Signature header — an
HMAC-SHA1 over the exact URL it called plus the sorted POST params, keyed by
your Auth Token. Verifying it proves the request actually came from Twilio
and not a spoofed POST from anyone who found the URL.
"""
import logging
from fastapi import Request, HTTPException
from twilio.request_validator import RequestValidator
from config import settings

logger = logging.getLogger(__name__)


async def verify_twilio_signature(request: Request) -> None:
    # Fail CLOSED, not open, when unconfigured -- same pattern as
    # CRON_SECRET/EMAIL_WORKER_SECRET in internal_cron.py/internal_email.py.
    # This used to just log a warning and let the request through
    # unverified, which meant a forgotten/misconfigured TWILIO_TOKEN or
    # PUBLIC_BASE_URL (both manually-set env vars, not auto-generated)
    # turned every /voice/* endpoint into an open, unauthenticated POST
    # anyone could hit to inject fake call transcripts/status updates.
    # Found in a security audit.
    if not settings.TWILIO_TOKEN or not settings.PUBLIC_BASE_URL:
        logger.error("TWILIO_TOKEN or PUBLIC_BASE_URL not configured — refusing all Twilio webhook calls rather than accepting them unverified.")
        raise HTTPException(status_code=503, detail="Voice webhook verification is not configured")

    signature = request.headers.get("X-Twilio-Signature", "")
    form = await request.form()
    params = {k: v for k, v in form.items()}

    url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}{request.url.path}"

    validator = RequestValidator(settings.TWILIO_TOKEN)
    if not validator.validate(url, params, signature):
        logger.warning(f"Rejected webhook call to {request.url.path}: invalid Twilio signature")
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")
