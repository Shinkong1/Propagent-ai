"""Dedicated Voice AI phone number addon ($19/mo, Professional+ only).

Every org's Voice AI calls work today via the platform's single shared
Twilio number (voice/twilio_webhook.py + voice/voice_i18n.py's caller-ID
matching fallback) -- but that only attributes calls from people already
known to that org (an existing tenant, or someone who submitted a rental
inquiry). A genuinely new caller can't be attributed to any org at all.

This addon buys the org its own real Twilio number. Calls to it are
attributed unambiguously (voice_i18n.get_org_for_call matches on the
dialed number directly, no guessing), which also means a brand-new
prospect calling in gets properly routed instead of falling through
unattributed.

Provisioning only ever happens *after* Stripe confirms the addon
subscription's first payment succeeded (see routes/billing.py's
checkout.session.completed handler) -- never before, since a real Twilio
number is a real recurring charge on PropAgent's own Twilio account the
moment it's purchased, addon payment or not.
"""
import logging

from config import settings

logger = logging.getLogger(__name__)


class VoiceNumberProvisionError(Exception):
    """Raised when Twilio can't find or buy a number -- caller decides how
    to surface this (e.g. flag for manual follow-up, since the org has
    already paid by the time this runs)."""


def _client():
    from twilio.rest import Client
    if not (settings.TWILIO_SID and settings.TWILIO_TOKEN):
        raise VoiceNumberProvisionError("Twilio credentials not configured")
    return Client(settings.TWILIO_SID, settings.TWILIO_TOKEN)


def purchase_voice_number(org_id: str) -> dict:
    """Buy a US local Twilio number and point it at the same webhook every
    org's calls already go through -- voice/twilio_webhook.py tells them
    apart by the `To` number, not by which Twilio number config sent the
    request. Returns {"phone_number": "+1...", "sid": "PN..."}.

    Synchronous (blocking network calls) by design -- callers must run this
    via run_in_threadpool, same as every other Stripe/Twilio call in this
    codebase, since it runs inside an async route handler on a
    single-worker server.
    """
    if not settings.PUBLIC_BASE_URL:
        raise VoiceNumberProvisionError("PUBLIC_BASE_URL is not configured -- can't set a voice webhook URL")

    client = _client()

    try:
        available = client.available_phone_numbers("US").local.list(limit=5, voice_enabled=True)
    except Exception as e:
        raise VoiceNumberProvisionError(f"Twilio number search failed: {e}") from e
    if not available:
        raise VoiceNumberProvisionError("No available US local numbers found -- try again shortly")

    voice_url = f"{settings.PUBLIC_BASE_URL}/voice/incoming"
    status_callback = f"{settings.PUBLIC_BASE_URL}/voice/status"

    last_error = None
    for candidate in available:
        try:
            purchased = client.incoming_phone_numbers.create(
                phone_number=candidate.phone_number,
                voice_url=voice_url,
                voice_method="POST",
                status_callback=status_callback,
                status_callback_method="POST",
            )
            logger.info(f"Provisioned Voice AI number {purchased.phone_number} ({purchased.sid}) for org {org_id}")
            return {"phone_number": purchased.phone_number, "sid": purchased.sid}
        except Exception as e:
            # Another buyer can win the same number between search and buy
            # (rare, but real -- Twilio's inventory is shared) -- try the
            # next candidate rather than fail the whole purchase over it.
            last_error = e
            logger.warning(f"Failed to purchase {candidate.phone_number} for org {org_id}, trying next candidate: {e}")

    raise VoiceNumberProvisionError(f"Could not purchase any candidate number: {last_error}")


def release_voice_number(number_sid: str) -> None:
    """Release a previously-purchased number back to Twilio -- called when
    an org cancels the addon, so PropAgent stops paying Twilio for a number
    nobody's using. Best-effort: logs and swallows failures rather than
    blocking the cancellation flow, since the org's subscription item is
    already canceled by the time this runs and a stuck Twilio number is a
    smaller problem than a customer who can't cancel."""
    if not number_sid:
        return
    try:
        client = _client()
        client.incoming_phone_numbers(number_sid).delete()
        logger.info(f"Released Voice AI number {number_sid}")
    except Exception as e:
        logger.error(f"Failed to release Voice AI number {number_sid} -- may need manual cleanup in Twilio console: {e}")
