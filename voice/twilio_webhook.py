"""Twilio webhook handlers"""
import logging
from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from voice.voice_i18n import get_voice_config, get_prompt, get_org_for_call

logger = logging.getLogger(__name__)

# Voice AI call handling requires the Professional plan or higher.
PLAN_RANK = {"starter": 0, "professional": 1, "enterprise": 2}
VOICE_MIN_PLAN_RANK = PLAN_RANK["professional"]

# Kept for tests that check static markers (e.g. "<Gather" in GATHER_TWIML)
GATHER_TWIML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Joanna">
        Hello! You've reached the PropAgent AI property management assistant.
        Please describe your request after the tone, and press pound when finished.
    </Say>
    <Gather input="speech" action="/voice/gather" method="POST"
            speechTimeout="auto" language="en-US" enhanced="true">
        <Say voice="Polly.Joanna">Go ahead, I'm listening.</Say>
    </Gather>
    <Say voice="Polly.Joanna">I didn't catch that. Please call back and try again.</Say>
</Response>"""


def build_incoming_twiml(language: str = "en") -> str:
    cfg = get_voice_config(language)
    voice = cfg["voice"]
    gather_language = cfg["gather_language"]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{voice}">{get_prompt(language, 'greeting')}</Say>
    <Gather input="speech" action="/voice/gather" method="POST"
            speechTimeout="auto" language="{gather_language}" enhanced="true">
        <Say voice="{voice}">{get_prompt(language, 'listening')}</Say>
    </Gather>
    <Say voice="{voice}">{get_prompt(language, 'no_catch_retry')}</Say>
</Response>"""


def build_plan_required_twiml(language: str = "en") -> str:
    cfg = get_voice_config(language)
    voice = cfg["voice"]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{voice}">{get_prompt(language, 'plan_required')}</Say>
    <Record maxLength="120" />
</Response>"""


async def handle_incoming_call(request: Request) -> str:
    """Generate TwiML for incoming calls, in the caller's organization's preferred language.

    Voice AI requires the Professional plan or higher. If the caller resolves to a
    known tenant whose organization is on Starter, we short-circuit to a recording
    prompt instead of the full AI flow.

    Org resolution prefers the number actually dialed (`to_number`): an org that
    bought the dedicated Voice AI number addon is matched unambiguously via
    get_org_for_call, with zero risk of cross-org attribution. Orgs without a
    dedicated number (still calling in on the shared platform number) fall back
    to caller-ID matching against known Tenants/RentalInquiries -- unknown/
    unresolvable callers on that path (e.g. a prospective tenant who isn't in
    the system yet) still pass through with no organization to gate against,
    a known limitation of sharing one number across every such org.
    """
    form = await request.form()
    caller = form.get("From", "Unknown")
    call_sid = form.get("CallSid", "")
    to_number = form.get("To", "")
    logger.info(f"Incoming call from {caller} to {to_number}")

    # Blocking DB work (org lookup + call-record write) -- must not run
    # inline on this single-worker server.
    org = await run_in_threadpool(_resolve_and_record_call, caller, call_sid, to_number)
    language = org["language"] if org else "en"

    if org and PLAN_RANK.get(org["plan"], 0) < VOICE_MIN_PLAN_RANK:
        logger.info(f"Org {org['id']} is on '{org['plan']}' plan — Voice AI requires Professional+, recording message instead")
        return build_plan_required_twiml(language)

    return build_incoming_twiml(language)


def _resolve_and_record_call(caller: str, call_sid: str, to_number: str) -> "dict | None":
    org = get_org_for_call(caller, to_number)
    _create_call_record(call_sid, caller, to_number, org)
    return org


def finalize_call_record(call_sid: str, call_status: str, duration_seconds: "int | None") -> None:
    """Called when Twilio reports a call has ended (any terminal status).
    Sets the final status/duration on the permanent record and -- for any
    call that was matched to an organization -- emails that org's owner(s)
    a summary, exactly once (owner_notified guards against Twilio's status
    webhook firing more than once for the same call, which does happen)."""
    if not call_sid:
        return
    try:
        from datetime import datetime
        from database.base import SessionLocal
        from models.voice_call import VoiceCall
        from models.user import User
        from services.communication_agent import send_email

        db = SessionLocal()
        try:
            call = db.query(VoiceCall).filter(VoiceCall.call_sid == call_sid).first()
            if not call:
                return

            call.status = call_status
            call.ended_at = datetime.utcnow()
            if duration_seconds is not None:
                call.duration_seconds = duration_seconds

            if call.organization_id and not call.owner_notified:
                owners = db.query(User).filter(
                    User.organization_id == call.organization_id,
                    User.role == "owner", User.is_active == True,
                ).all()
                if owners:
                    caller_desc = call.caller_name or call.from_number or "Unknown caller"
                    caller_role = " (prospective tenant)" if call.caller_type == "prospect" else ""
                    property_line = f" ({call.property_name})" if call.property_name else ""
                    body = (
                        f"Voice AI handled a call from {caller_desc}{caller_role}{property_line}.\n\n"
                        f"Status: {call_status}\n"
                        + (f"Duration: {duration_seconds}s\n" if duration_seconds else "")
                        + (f"Topic: {call.intent}\n" if call.intent else "")
                        + f"\nSummary of the last thing the AI told them:\n{call.outcome_summary or '(no summary available)'}"
                    )
                    for owner in owners:
                        send_email(owner.email, f"Voice AI call summary — {caller_desc}", body)
                    call.owner_notified = True

            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to finalize voice call record for {call_sid}: {e}")


def _create_call_record(call_sid: str, from_number: str, to_number: str, org: "dict | None") -> None:
    """Persist a real, permanent record of this call as soon as it comes in
    -- previously nothing survived past the in-memory (Redis, 1hr TTL) call
    session, which is deleted the moment the call ends. If org is None (an
    unrecognized caller under the shared-Twilio-number setup), the call is
    still logged, just without organization/tenant/property attribution."""
    if not call_sid:
        return
    try:
        from database.base import SessionLocal
        from models.voice_call import VoiceCall
        from uuid import UUID

        db = SessionLocal()
        try:
            if db.query(VoiceCall).filter(VoiceCall.call_sid == call_sid).first():
                return  # Twilio can retry the same webhook; don't double-log
            db.add(VoiceCall(
                call_sid=call_sid,
                from_number=from_number,
                to_number=to_number,
                organization_id=UUID(org["id"]) if org else None,
                tenant_id=UUID(org["tenant_id"]) if org and org.get("tenant_id") else None,
                inquiry_id=UUID(org["inquiry_id"]) if org and org.get("inquiry_id") else None,
                property_id=UUID(org["property_id"]) if org and org.get("property_id") else None,
                status="in_progress",
            ))
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to create voice call record for {call_sid}: {e}")
