"""Voice AI routes — Twilio webhook handlers"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, Form, Response, Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import PlainTextResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from middleware.twilio_auth import verify_twilio_signature
from middleware.auth import get_current_user
from middleware.plan_gate import require_plan
from database.session import get_db
from models.user import User, PlanType
from models.voice_call import VoiceCall
from schemas.voice import VoiceCallOut, VoiceCallListOut

logger = logging.getLogger(__name__)

# Twilio webhooks — verified by Twilio's request signature, not a user session.
router = APIRouter(prefix="/voice", tags=["voice"], dependencies=[Depends(verify_twilio_signature)])

# Staff-facing call history — normal session auth, deliberately a separate
# router so it isn't gated behind Twilio signature verification (that check
# would reject every browser request since it's not coming from Twilio).
# Voice AI call center is sold as a Professional-tier feature on pricing.tsx
# -- this was missing entirely (real gap found in a pricing-page audit: any
# Starter org could hit /voice/calls and use it for free), same require_plan
# pattern as inspections.py/compliance.py/etc.
staff_router = APIRouter(prefix="/voice", tags=["voice"], dependencies=[Depends(require_plan(PlanType.professional))])


@staff_router.get("/calls", response_model=VoiceCallListOut)
async def list_calls(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Call history for the current user's organization -- only calls that
    could be attributed to an org (i.e. from a recognized tenant's phone
    number) show up here; that's a limitation of the shared Twilio number
    used across all organizations, not a bug."""
    q = db.query(VoiceCall).filter(VoiceCall.organization_id == current_user.organization_id)

    calls = q.order_by(VoiceCall.started_at.desc()).limit(200).all()

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    calls_this_month = q.filter(VoiceCall.started_at >= month_start).count()

    avg_duration = (
        db.query(func.avg(VoiceCall.duration_seconds))
        .filter(VoiceCall.organization_id == current_user.organization_id, VoiceCall.duration_seconds.isnot(None))
        .scalar()
    )
    resolved_count = q.filter(VoiceCall.status == "completed").count()

    return VoiceCallListOut(
        calls=calls,
        total_calls=q.count(),
        calls_this_month=calls_this_month,
        avg_duration_seconds=int(avg_duration) if avg_duration else None,
        resolved_count=resolved_count,
    )


@router.post("/incoming")
async def incoming_call(request: Request):
    """Twilio webhook for incoming calls"""
    from voice.twilio_webhook import handle_incoming_call
    twiml = await handle_incoming_call(request)
    return Response(content=twiml, media_type="application/xml")


@router.post("/gather")
async def gather_response(
    SpeechResult: str = Form(""),
    CallSid: str = Form(""),
    From: str = Form(""),
):
    """Handle gathered speech from Twilio"""
    from voice.call_agent import process_voice_input
    twiml = await process_voice_input(
        speech=SpeechResult,
        call_sid=CallSid,
        caller_phone=From
    )
    return Response(content=twiml, media_type="application/xml")


@router.post("/status")
async def call_status(
    CallSid: str = Form(""),
    CallStatus: str = Form(""),
    CallDuration: str = Form(""),
):
    """Handle call status updates"""
    logger.info(f"Call {CallSid} status: {CallStatus}")
    if CallStatus in ("completed", "failed", "busy", "no-answer", "canceled"):
        from voice.call_session import clear_session
        from voice.twilio_webhook import finalize_call_record

        duration_seconds = int(CallDuration) if CallDuration.isdigit() else None
        # Blocking DB + email work -- must not run inline on this single-worker server.
        await run_in_threadpool(finalize_call_record, CallSid, CallStatus, duration_seconds)
        clear_session(CallSid)
    return {"status": "ok"}
