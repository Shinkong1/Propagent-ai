"""Leasing Agent — handles inquiries, tours, and applications"""
import logging
from fastapi.concurrency import run_in_threadpool
from agents.state import AgentState
from agents.agents._shared import get_available_listings, NO_ORG_WARNING
from voice.voice_i18n import VOICE_CONFIG
from config import settings

logger = logging.getLogger(__name__)


async def leasing_agent_node(state: AgentState) -> AgentState:
    state["current_agent"] = "leasing"

    org_id = state.get("organization_id")
    if org_id:
        listings_context = await run_in_threadpool(get_available_listings, org_id)
    else:
        listings_context = NO_ORG_WARNING

    if not settings.OPENAI_API_KEY:
        state["response"] = (
            "Thank you for your interest! I can help you with availability and scheduling a tour. "
            "Which property or area are you interested in?"
        )
        state["actions_taken"] = state.get("actions_taken", []) + ["Leasing inquiry handled"]
        return state

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        language_name = VOICE_CONFIG.get(state.get("language", "en"), VOICE_CONFIG["en"])["name"]
        language_instruction = "" if language_name == "English" else f" Respond in {language_name}, regardless of the language the tenant writes in."

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a friendly leasing assistant for a property management company.
Help prospective tenants with availability, pricing, tours, and applications.
Be warm, professional, and convert interest into scheduled tours or applications.
Keep responses concise (2-4 sentences). Always end with a call to action.

{listings_context}

CRITICAL: You may only ever describe properties, units, cities, prices, and availability that
appear in the data above -- word for word, not approximations. If the caller asks about a
location, property, bedroom/bathroom count, or price point that isn't in that data, tell them
plainly that it's not something you have listed, and offer what IS actually available instead
(name the real properties/cities by name so they have real options to choose from) or offer to
take their info for a human to follow up. Never say "we have several units" or any other vague
claim of availability unless the data above backs it up specifically. Guessing or being
approximately right is not acceptable here -- telling a caller false availability information is
a real business liability, not a minor error.

You can only speak in this conversation — you have no ability to send emails, text messages, or any other written communication yourself. Never promise to "email you", "text you", or "send a confirmation" — if they need something in writing, tell them a leasing team member will follow up with them directly.{language_instruction}"""
                },
                *[{"role": m["role"], "content": m["content"]} for m in state.get("history", [])],
                {"role": "user", "content": state["message"]}
            ],
            max_tokens=300,
        )
        state["response"] = response.choices[0].message.content
    except Exception as e:
        logger.error(f"Leasing agent AI error: {e}")
        state["response"] = "Thanks for your interest! Let me connect you with our leasing team to answer your questions and schedule a tour."

    state["actions_taken"] = state.get("actions_taken", []) + ["Leasing inquiry handled by AI"]
    return state
