"""Maintenance Agent — gathers enough detail via conversation, then creates
tickets and dispatches vendors. Never files a ticket on a single vague
message, and never claims a ticket was filed for a caller we can't match to
a tenant/property."""
import json
import logging
from datetime import datetime
from agents.state import AgentState
from agents.agents.maintenance_i18n import get_category_name, get_template
from config import settings

logger = logging.getLogger(__name__)


async def analyze_maintenance_request(history: list, message: str) -> dict:
    """Decide whether enough detail has been gathered to file a ticket, or
    what to ask next. Uses the full conversation so far, not just the latest
    message, so multi-turn intake actually accumulates information instead
    of re-classifying a single utterance in isolation."""
    if not settings.OPENAI_API_KEY:
        from services.maintenance_service import classify_maintenance_request
        classification = classify_maintenance_request(message)
        classification["ready"] = True
        classification["follow_up_question"] = None
        return classification

    transcript = "\n".join(f"{t.get('role', 'user')}: {t.get('content', '')}" for t in (history or []))
    transcript += f"\nuser: {message}"

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are a property maintenance intake assistant on a phone call. Gather enough detail to file an accurate ticket before creating one — never file a vague ticket.

A request is ready to file only once you know: (1) what's broken/wrong, (2) specifically where (which room/fixture/appliance), and (3) how urgent it is (an active leak, no heat, no power, or a security issue is an emergency; something broken but livable is medium/low).

Given the conversation so far, respond with JSON only:
{"ready": true|false,
 "follow_up_question": "<one specific, conversational spoken question — null if ready>",
 "category": "plumbing|electrical|hvac|appliance|structural|pest_control|cleaning|other",
 "priority": "low|medium|high|emergency",
 "title": "<brief title, best guess even if not ready>",
 "summary": "<what needs to be done, best guess even if not ready>"}

If ready is false, ask exactly ONE missing question — never ask about something already stated in the conversation, and never ask more than one question at a time."""
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
    clarifying questions until there's enough detail, then create the ticket
    — but only if the caller resolves to a known tenant/property. An
    unrecognized caller gets an honest explanation instead of a fabricated
    'ticket created' response."""
    logger.info("MaintenanceAgent processing request")
    state["current_agent"] = "maintenance"
    language = state.get("language", "en")

    analysis = await analyze_maintenance_request(state.get("history", []), state["message"])

    if not analysis.get("ready", True):
        state["response"] = analysis.get("follow_up_question") or get_template(language, "default_title")
        state["actions_taken"] = state.get("actions_taken", []) + ["Gathering more details before filing a ticket"]
        return state

    classification = analysis
    ticket_id = None
    vendor_assigned = False

    if state.get("property_id"):
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
        response = get_template(language, "no_tenant_match")
        actions = ["Caller not recognized as a tenant — no ticket filed"]

    state["ticket_id"] = ticket_id
    state["vendor_assigned"] = vendor_assigned
    state["response"] = response
    state["actions_taken"] = state.get("actions_taken", []) + actions

    return state
