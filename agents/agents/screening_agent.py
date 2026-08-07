"""Screening Agent — tenant qualification and risk assessment"""
import logging
from agents.state import AgentState
from voice.voice_i18n import VOICE_CONFIG
from config import settings

logger = logging.getLogger(__name__)

FALLBACK_RESPONSE = (
    "I can help you with the rental application and screening process. "
    "To get started, I'll need: your annual income, current employment status, "
    "and consent to run a background/credit check. "
    "Would you like to proceed with the application?"
)


async def screening_agent_node(state: AgentState) -> AgentState:
    state["current_agent"] = "screening"

    if not settings.OPENAI_API_KEY:
        state["response"] = FALLBACK_RESPONSE
        state["actions_taken"] = state.get("actions_taken", []) + ["Screening inquiry handled"]
        return state

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        language_name = VOICE_CONFIG.get(state.get("language", "en"), VOICE_CONFIG["en"])["name"]
        language_instruction = "" if language_name == "English" else f" Respond in {language_name}, regardless of the language they write in."

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a rental application & screening assistant for a property management company.
Walk applicants through what screening requires: annual income, current employment status,
and consent to a credit/background check. Explain, if asked, that approval generally needs
income of at least 2.5-3x the monthly rent and reasonable credit history -- don't quote an
exact score or guarantee approval, since the actual decision is a scored evaluation run
separately, not something you determine in this conversation.
Be warm, clear, and efficient. Keep responses concise (2-4 sentences).
You can only speak in this conversation — you have no ability to send emails, text messages, run
the actual credit check, or any other written communication or system action yourself. Never
promise to "email you", "text you", "run your credit now", or "send a confirmation" — if they're
ready to proceed, tell them a leasing team member will follow up to complete the application.{language_instruction}"""
                },
                *[{"role": m["role"], "content": m["content"]} for m in state.get("history", [])],
                {"role": "user", "content": state["message"]}
            ],
            max_tokens=300,
        )
        state["response"] = response.choices[0].message.content
    except Exception as e:
        logger.error(f"Screening agent AI error: {e}")
        state["response"] = FALLBACK_RESPONSE

    state["actions_taken"] = state.get("actions_taken", []) + ["Screening inquiry handled by AI"]
    return state
