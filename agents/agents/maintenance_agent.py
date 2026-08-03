"""Maintenance Agent — creates tickets and dispatches vendors"""
import json
import logging
from datetime import datetime
from agents.state import AgentState
from agents.agents.maintenance_i18n import get_category_name, get_template
from config import settings

logger = logging.getLogger(__name__)


async def classify_maintenance_with_ai(description: str) -> dict:
    """AI-powered maintenance classification"""
    if not settings.OPENAI_API_KEY:
        from services.maintenance_service import classify_maintenance_request
        return classify_maintenance_request(description)
    
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are a property maintenance classifier. 
Analyze the maintenance request and respond with JSON:
{"category": "plumbing|electrical|hvac|appliance|structural|pest_control|cleaning|other",
 "priority": "low|medium|high|emergency",
 "title": "brief title",
 "summary": "what needs to be done"}"""
                },
                {"role": "user", "content": description}
            ],
            max_tokens=200,
            temperature=0,
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.warning(f"AI classification failed: {e}")
        from services.maintenance_service import classify_maintenance_request
        return classify_maintenance_request(description)


async def generate_maintenance_response(description: str, classification: dict, vendor_assigned: bool, language: str = "en") -> str:
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
    """Process maintenance request: classify, create ticket, dispatch vendor"""
    logger.info(f"MaintenanceAgent processing request")
    state["current_agent"] = "maintenance"
    
    # Classify the issue
    classification = await classify_maintenance_with_ai(state["message"])
    
    # Create ticket in DB (if we have DB context)
    ticket_id = None
    vendor_assigned = False
    
    if state.get("property_id"):
        try:
            from database.base import SessionLocal
            from models.maintenance import MaintenanceTicket, TicketCategory, TicketPriority
            
            db = SessionLocal()
            try:
                ticket = MaintenanceTicket(
                    property_id=state["property_id"],
                    tenant_id=state.get("tenant_id"),
                    title=classification.get("title", "Maintenance Request"),
                    description=state["message"],
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
    
    response = await generate_maintenance_response(state["message"], classification, vendor_assigned, state.get("language", "en"))
    
    state["ticket_id"] = ticket_id
    state["vendor_assigned"] = vendor_assigned
    state["response"] = response
    state["actions_taken"] = state.get("actions_taken", []) + [
        f"Classified as {classification.get('category')} ({classification.get('priority')} priority)",
        f"Ticket created: {ticket_id or 'pending DB'}",
    ]
    
    return state
