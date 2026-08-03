"""Twilio webhook handlers"""
import logging
from fastapi import Request
from voice.voice_i18n import get_voice_config, get_prompt, get_org_language, get_org_for_phone

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
    prompt instead of the full AI flow. Unknown/unresolvable callers (e.g. a
    prospective tenant who isn't in the system yet) pass through — there's no
    organization to gate against since this demo shares a single Twilio number
    across all organizations rather than provisioning one per org.
    """
    form = await request.form()
    caller = form.get("From", "Unknown")
    logger.info(f"Incoming call from {caller}")

    org = get_org_for_phone(caller)
    language = org["language"] if org else "en"

    if org and PLAN_RANK.get(org["plan"], 0) < VOICE_MIN_PLAN_RANK:
        logger.info(f"Org {org['id']} is on '{org['plan']}' plan — Voice AI requires Professional+, recording message instead")
        return build_plan_required_twiml(language)

    return build_incoming_twiml(language)
