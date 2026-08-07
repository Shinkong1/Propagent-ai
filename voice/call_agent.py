"""Voice call AI agent — connects speech to LangGraph pipeline"""
import logging
from fastapi.concurrency import run_in_threadpool
from agents.graph import process_message
from voice.call_session import (
    get_history, append_turns, bump_no_input_count, reset_no_input_count, clear_session,
    get_pending_agent, set_pending_agent,
)
from voice.voice_i18n import get_voice_config, get_prompt, get_org_for_phone

logger = logging.getLogger(__name__)

END_CALL_PHRASES = [
    "that's all", "thats all", "nothing else", "no thanks", "no thank you",
    "goodbye", "good bye", "bye", "i'm done", "im done", "that's it", "thats it",
    "no more", "i'm good", "im good", "that will be all", "that'll be all",
    # Spanish / French / German / Chinese equivalents
    "adiós", "adios", "nada más", "nada mas", "au revoir", "c'est tout",
    "auf wiederhören", "auf wiedersehen", "das ist alles", "再见", "没有了",
]


def _wants_to_end_call(speech: str) -> bool:
    s = speech.lower().strip().rstrip(".!?")
    if s in ("no", "nope", "nah", "no i'm okay", "no im okay"):
        return True
    return any(phrase in s for phrase in END_CALL_PHRASES)


def build_response_twiml(text: str, continue_listening: bool = True, language: str = "en") -> str:
    """Build TwiML response with text-to-speech in the given language"""
    cfg = get_voice_config(language)
    voice = cfg["voice"]
    gather_language = cfg["gather_language"]

    gather_block = f"""
    <Gather input="speech" action="/voice/gather" method="POST"
            speechTimeout="auto" language="{gather_language}" enhanced="true">
    </Gather>""" if continue_listening else ""

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="{voice}">{text}</Say>
    {gather_block}
    {'<Hangup/>' if not continue_listening else ''}
</Response>"""


async def process_voice_input(speech: str, call_sid: str, caller_phone: str) -> str:
    """Process speech input through AI agent and return TwiML"""
    logger.info(f"Voice input [{call_sid}]: {speech}")

    # One resolution per turn covers language + org/tenant/property context --
    # previously this was two separate lookups (get_org_language, then a
    # second _lookup_tenant call further down) that could disagree, and
    # neither surfaced organization_id at all, so agents downstream had no
    # way to ground answers in this caller's actual portfolio.
    org = await run_in_threadpool(get_org_for_phone, caller_phone)
    language = org["language"] if org else "en"

    if not speech or len(speech.strip()) < 2:
        attempts = bump_no_input_count(call_sid)
        if attempts >= 2:
            clear_session(call_sid)
            return build_response_twiml(
                get_prompt(language, "no_input_final"),
                continue_listening=False, language=language,
            )
        return build_response_twiml(get_prompt(language, "no_catch_repeat"), language=language)

    reset_no_input_count(call_sid)

    if _wants_to_end_call(speech):
        clear_session(call_sid)
        return build_response_twiml(
            get_prompt(language, "goodbye"),
            continue_listening=False, language=language,
        )

    try:
        history = get_history(call_sid)
        pending_agent = get_pending_agent(call_sid)

        result = await process_message(
            message=speech,
            tenant_id=org.get("tenant_id") if org else None,
            property_id=org.get("property_id") if org else None,
            organization_id=org.get("id") if org else None,
            channel="voice",
            history=history,
            language=language,
            forced_agent=pending_agent,
        )

        set_pending_agent(call_sid, result.get("agent") if result.get("still_gathering") else None)

        response_text = result.get("response", "I'm processing your request.")

        # Clean text for TTS (remove markdown)
        response_text = response_text.replace("*", "").replace("#", "").replace("\n", " ")

        append_turns(call_sid, [
            {"role": "user", "content": speech},
            {"role": "assistant", "content": response_text},
        ])
        await run_in_threadpool(_sync_call_record, call_sid, get_history(call_sid), result.get("agent"), response_text)

        # Mid-intake (agent just asked a clarifying question and is waiting on
        # a direct answer) — don't tack on "just say goodbye", it reads as the
        # call wrapping up when it's actually still actively gathering info.
        if not result.get("still_gathering"):
            if response_text.rstrip().endswith("?"):
                response_text += " " + get_prompt(language, "just_say_goodbye")
            else:
                response_text += " " + get_prompt(language, "anything_else")

        return build_response_twiml(response_text, continue_listening=True, language=language)

    except Exception as e:
        logger.error(f"Voice processing error: {e}")
        return build_response_twiml(get_prompt(language, "trouble"), language=language)


def _sync_call_record(call_sid: str, history: list, intent: "str | None", latest_response: str) -> None:
    """Mirror the live (Redis) conversation onto the permanent VoiceCall row
    after every turn, not just at the end -- if the caller hangs up without
    Twilio ever firing /voice/status (it does happen), the transcript up to
    that point is still saved rather than lost entirely."""
    if not call_sid:
        return
    try:
        import json
        from database.base import SessionLocal
        from models.voice_call import VoiceCall

        db = SessionLocal()
        try:
            call = db.query(VoiceCall).filter(VoiceCall.call_sid == call_sid).first()
            if call:
                call.transcript = json.dumps(history)
                if intent:
                    call.intent = intent
                call.outcome_summary = latest_response
                db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Failed to sync voice call record for {call_sid}: {e}")
