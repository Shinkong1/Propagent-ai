"""Leasing Agent — handles inquiries, tours, and applications"""
import logging
from fastapi.concurrency import run_in_threadpool
from agents.state import AgentState
from voice.voice_i18n import VOICE_CONFIG
from config import settings

logger = logging.getLogger(__name__)


def _get_available_listings(organization_id: str) -> str:
    """Real, current vacancy data for this org -- the ONLY source of truth
    the leasing agent is allowed to describe. Always returns an explicit
    statement (never a blank string) so the model is never left to fill a
    gap with a plausible-sounding guess -- that's exactly how it ends up
    inventing units in a city ("Sunset, Florida") that isn't in the
    portfolio at all."""
    from database.base import SessionLocal
    from models.property import Property
    from uuid import UUID

    db = SessionLocal()
    try:
        properties = (
            db.query(Property)
            .filter(Property.organization_id == UUID(organization_id), Property.is_active == True)
            .all()
        )
        if not properties:
            return "This organization has no properties on file at all. Do not claim to have any units, properties, or locations available anywhere."

        lines = []
        any_vacancy = False
        for p in properties:
            avail_units = [u for u in p.units if not u.is_occupied]
            if not avail_units:
                continue
            any_vacancy = True
            unit_descs = ", ".join(
                f"Unit {u.unit_number} ({u.bedrooms}bd/{u.bathrooms}ba, ${u.monthly_rent:.0f}/mo)"
                for u in avail_units[:6]
            )
            lines.append(f"- {p.name} in {p.city}, {p.state}: {unit_descs}")

        if not any_vacancy:
            names = ", ".join(f"{p.name} ({p.city}, {p.state})" for p in properties)
            return f"This organization's only properties are: {names}. NONE currently have a vacant unit. Do not claim any unit is available -- offer to take the caller's info for when something opens up instead."

        return "The ONLY real, current vacancies you may describe:\n" + "\n".join(lines)
    finally:
        db.close()


async def leasing_agent_node(state: AgentState) -> AgentState:
    state["current_agent"] = "leasing"

    org_id = state.get("organization_id")
    if org_id:
        listings_context = await run_in_threadpool(_get_available_listings, org_id)
    else:
        listings_context = (
            "No organization could be identified for this caller -- their phone number/session doesn't "
            "match any known tenant, applicant, or account. You have NO property data to draw on. Do not "
            "invent property names, cities, states, or availability under any circumstances. Ask who they're "
            "trying to reach (company or property name) so a human can route them, or offer to take a message."
        )

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
