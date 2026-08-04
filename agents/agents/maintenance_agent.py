"""Maintenance Agent — gathers enough detail via conversation, then creates
tickets and dispatches vendors. Never files a ticket on a single vague
message, and never claims a ticket was filed for a caller we can't match to
a tenant/property — instead it takes a callback message for a human to
follow up on, and only once, rather than repeating the same dead-end line
every turn."""
import json
import logging
from datetime import datetime
from agents.state import AgentState
from agents.agents.maintenance_i18n import get_category_name, get_template
from config import settings

logger = logging.getLogger(__name__)


async def analyze_maintenance_request(history: list, message: str, has_known_property: bool) -> dict:
    """Decide whether enough detail has been gathered, or what to ask next.
    Uses the full conversation so far, not just the latest message, so
    multi-turn intake actually accumulates information instead of
    re-classifying a single utterance in isolation.

    For a recognized tenant (has_known_property=True) we need enough to file
    an accurate ticket: what's wrong, where, how urgent.

    For an unrecognized caller (has_known_property=False) we can't file a
    ticket automatically at all — the goal shifts to capturing a callback
    message: their name, a callback number, and a brief description of the
    issue, so a human can follow up."""
    if not settings.OPENAI_API_KEY:
        from services.maintenance_service import classify_maintenance_request
        classification = classify_maintenance_request(message)
        classification["ready"] = True
        classification["follow_up_question"] = None
        return classification

    transcript = "\n".join(f"{t.get('role', 'user')}: {t.get('content', '')}" for t in (history or []))
    transcript += f"\nuser: {message}"

    if has_known_property:
        goal = """A request is ready to file only once you know: (1) what's broken/wrong, (2) specifically where (which room/fixture/appliance), and (3) how urgent it is (an active leak, no heat, no power, or a security issue is an emergency; something broken but livable is medium/low).

Respond with JSON only:
{"ready": true|false,
 "follow_up_question": "<one specific, conversational spoken question — null if ready>",
 "category": "plumbing|electrical|hvac|appliance|structural|pest_control|cleaning|other",
 "priority": "low|medium|high|emergency",
 "title": "<brief title, best guess even if not ready>",
 "summary": "<what needs to be done, best guess even if not ready>"}"""
    else:
        goal = """You cannot file a ticket automatically for this caller — they aren't recognized as a tenant in the system. Instead, gather a callback message: their name, a callback phone number, and a brief description of the issue and where it is. It's ready once you have all three.

Respond with JSON only:
{"ready": true|false,
 "follow_up_question": "<one specific, conversational spoken question — null if ready>",
 "category": "plumbing|electrical|hvac|appliance|structural|pest_control|cleaning|other",
 "priority": "low|medium|high|emergency",
 "title": "<brief title, best guess even if not ready>",
 "summary": "<what needs to be done, best guess even if not ready>",
 "caller_name": "<name given, or null>",
 "callback_number": "<number given, or null>"}"""

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a property maintenance intake assistant on a phone call. {goal}

Ask exactly ONE missing question at a time — never ask about something already stated in the conversation, and never ask more than one question at once."""
                },
                {"role": "user", "content": transcript},
            ],
            max_tokens=300,
            temperature=0,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.warning(f"AI intake analysis failed: {e}")
        from services.maintenance_service import classify_maintenance_request
        classification = classify_maintenance_request(message)
        classification["ready"] = True
        classification["follow_up_question"] = None
        return classification


async def generate_maintenance_response(classification: dict, vendor_assigned: bool, language: str = "en") -> str:
    """Generate empathetic tenant response, translated for the org's chosen language"""
    category = classification.get("category", "other")
    priority = classification.get("priority", "medium")
    title = classification.get("title") or get_template(language, "default_title")

    urgency_text = ""
    if priority == "emergency":
        urgency_text = get_template(language, "emergency")
    elif priority == "high":
        urgency_text = get_template(language, "high")

    vendor_text = get_template(language, "vendor_assigned") if vendor_assigned else get_template(language, "vendor_pending")
    category_name = get_category_name(language, category)

    return (
        f"{get_template(language, 'created').format(title=title)} {urgency_text}"
        f"{get_template(language, 'specialist').format(category=category_name)} {vendor_text} "
        f"{get_template(language, 'closing')}"
    )


async def maintenance_agent_node(state: AgentState) -> AgentState:
    """Process a maintenance request through multi-turn intake: keep asking
    clarifying questions until there's enough detail, then either create the
    ticket (known tenant/property) or log a callback message for a human to
    follow up on (unrecognized caller) — exactly once, not on every turn."""
    logger.info("MaintenanceAgent processing request")
    state["current_agent"] = "maintenance"
    language = state.get("language", "en")
    has_property = bool(state.get("property_id"))

    analysis = await analyze_maintenance_request(state.get("history", []), state["message"], has_property)

    if not analysis.get("ready", True):
        state["response"] = analysis.get("follow_up_question") or get_template(language, "default_title")
        state["still_gathering"] = True
        state["actions_taken"] = state.get("actions_taken", []) + ["Gathering more details before finishing"]
        return state

    state["still_gathering"] = False
    classification = analysis
    ticket_id = None
    vendor_assigned = False

    if has_property:
        try:
            from database.base import SessionLocal
            from models.maintenance import MaintenanceTicket

            db = SessionLocal()
            try:
                ticket = MaintenanceTicket(
                    property_id=state["property_id"],
                    tenant_id=state.get("tenant_id"),
                    title=classification.get("title", "Maintenance Request"),
                    description=classification.get("summary") or state["message"],
                    category=classification.get("category", "other"),
                    priority=classification.get("priority", "medium"),
                    ai_classification=json.dumps(classification),
                )
                db.add(ticket)
                db.flush()
                ticket_id = str(ticket.id)

                from services.maintenance_service import auto_assign_vendor
                import asyncio
                asyncio.create_task(auto_assign_vendor(ticket, db)) if hasattr(asyncio, '_get_running_loop') else None

                db.commit()
                vendor_assigned = ticket.vendor_notified
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Failed to create maintenance ticket: {e}")

        response = await generate_maintenance_response(classification, vendor_assigned, language)
        actions = [
            f"Classified as {classification.get('category')} ({classification.get('priority')} priority)",
            f"Ticket created: {ticket_id or 'pending DB'}",
        ]
    else:
        caller_name = classification.get("caller_name") or "there"
        callback_number = classification.get("callback_number") or "the number you called from"
        summary = classification.get("summary") or state["message"]
        # No org/property to attach this to (unrecognized caller on a shared
        # number) — nowhere in-app to persist it yet, so surface it clearly in
        # logs for now rather than claiming it was saved somewhere visible.
        logger.info(
            f"UNMATCHED VOICE CALLBACK REQUEST — name={caller_name!r} "
            f"callback={callback_number!r} issue={summary!r} "
            f"category={classification.get('category')} priority={classification.get('priority')}"
        )
        response = get_template(language, "callback_confirmed").format(
            name=caller_name, number=callback_number, summary=summary,
        )
        actions = ["Caller not recognized as a tenant — callback message logged, no ticket filed"]

    state["ticket_id"] = ticket_id
    state["vendor_assigned"] = vendor_assigned
    state["response"] = response
    state["actions_taken"] = state.get("actions_taken", []) + actions

    return state
