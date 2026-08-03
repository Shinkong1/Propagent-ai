"""Voice AI routes — Twilio webhook handlers"""
import logging
from fastapi import APIRouter, Request, Form, Response, Depends
from fastapi.responses import PlainTextResponse
from middleware.twilio_auth import verify_twilio_signature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"], dependencies=[Depends(verify_twilio_signature)])


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
):
    """Handle call status updates"""
    logger.info(f"Call {CallSid} status: {CallStatus}")
    if CallStatus in ("completed", "failed", "busy", "no-answer", "canceled"):
        from voice.call_session import clear_session
        clear_session(CallSid)
    return {"status": "ok"}
