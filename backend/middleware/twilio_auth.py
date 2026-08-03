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
    if not settings.TWILIO_TOKEN:
        logger.warning("TWILIO_TOKEN not configured — skipping Twilio signature verification.")
        return
    if not settings.PUBLIC_BASE_URL:
        logger.warning("PUBLIC_BASE_URL not configured — skipping Twilio signature verification.")
        return

    signature = request.headers.get("X-Twilio-Signature", "")
    form = await request.form()
    params = {k: v for k, v in form.items()}

    url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}{request.url.path}"

    validator = RequestValidator(settings.TWILIO_TOKEN)
    if not validator.validate(url, params, signature):
        logger.warning(f"Rejected webhook call to {request.url.path}: invalid Twilio signature")
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")
