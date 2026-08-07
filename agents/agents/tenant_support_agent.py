"""General Tenant Support Agent"""
import logging
from fastapi.concurrency import run_in_threadpool
from agents.state import AgentState
from agents.agents._shared import get_available_listings
from voice.voice_i18n import VOICE_CONFIG
from config import settings

logger = logging.getLogger(__name__)


async def tenant_support_agent_node(state: AgentState) -> AgentState:
    state["current_agent"] = "tenant_support"

    if not settings.OPENAI_API_KEY:
        state["response"] = (
            "Hi! I'm your property management assistant. I can help you with maintenance requests, "
            "lease questions, rent payments, and more. How can I assist you today?"
        )
        return state

    # This is also where a leasing-shaped question lands if intent
    # classification misses it (it does happen) -- ground it the same way
    # leasing_agent does, so a caller asking about availability here isn't
    # any more likely to get an invented answer than if they'd been routed
    # correctly.
    org_id = state.get("organization_id")
    listings_context = await run_in_threadpool(get_available_listings, org_id) if org_id else None

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        language_name = VOICE_CONFIG.get(state.get("language", "en"), VOICE_CONFIG["en"])["name"]
        language_instruction = "" if language_name == "English" else f" Respond in {language_name}, regardless of the language the tenant writes in."
        listings_instruction = (
            f"\n\nIf the tenant/caller asks about unit availability, pricing, or a specific property/location, "
            f"here is the ONLY real data you may reference:\n{listings_context}\n"
            f"Never claim a property, city, or vacancy exists outside this data -- say plainly it's not "
            f"something you have on file instead of guessing."
            if listings_context else
            "\n\nYou don't have this caller's organization on file, so if they ask about unit availability, "
            "pricing, or a specific property, do not invent any details -- tell them plainly you can't look "
            "that up right now and offer to take a message."
        )

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a helpful property management assistant.
Assist tenants with: maintenance requests, lease information, rent payments, move-in/move-out, amenities.
Be friendly, efficient, and empathetic. If you detect a maintenance issue, offer to create a ticket.
You can only speak in this conversation — you have no ability to send emails, text messages, or any other written communication yourself. Never promise to "email you", "text you", or "send a confirmation" — if the tenant needs something in writing, tell them a member of the property team will follow up with them directly.{listings_instruction}{language_instruction}"""
                },
                *[{"role": m["role"], "content": m["content"]} for m in state.get("history", [])],
                {"role": "user", "content": state["message"]}
            ],
            max_tokens=300,
        )
        state["response"] = response.choices[0].message.content
    except Exception as e:
        logger.error(f"Support agent error: {e}")
        state["response"] = "I'm here to help! Could you tell me more about what you need assistance with?"

    return state
