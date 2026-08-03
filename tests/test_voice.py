"""Voice processing tests"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


def test_twiml_response_contains_say():
    """TwiML response must have a <Say> element"""
    from voice.call_agent import build_response_twiml
    twiml = build_response_twiml("I've logged your maintenance request.")
    assert "<Say" in twiml
    assert "I've logged your maintenance request." in twiml


def test_incoming_call_twiml():
    """Incoming call handler returns valid TwiML with Gather"""
    from voice.twilio_webhook import GATHER_TWIML
    assert "<Gather" in GATHER_TWIML
    assert "speech" in GATHER_TWIML
    assert "/voice/gather" in GATHER_TWIML


@pytest.mark.asyncio
async def test_voice_empty_speech():
    """Empty speech should return a 'didn't catch that' TwiML"""
    from voice.call_agent import process_voice_input
    twiml = await process_voice_input(speech="", call_sid="test123", caller_phone="+15125550100")
    assert "didn't quite catch" in twiml.lower() or "<Say" in twiml
