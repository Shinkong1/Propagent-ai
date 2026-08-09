"""Maintenance service — AI classification and vendor dispatch"""
import json
import logging
from sqlalchemy.orm import Session
from models.maintenance import MaintenanceTicket, Vendor, TicketCategory, TicketPriority

logger = logging.getLogger(__name__)

CATEGORY_VENDOR_MAP = {
    TicketCategory.plumbing: ["plumbing"],
    TicketCategory.electrical: ["electrical"],
    TicketCategory.hvac: ["hvac", "heating", "cooling"],
    TicketCategory.appliance: ["appliance"],
}


def _notify_vendor(vendor: Vendor, ticket: MaintenanceTicket) -> bool:
    """Actually contacts the assigned vendor by email -- previously this
    was entirely missing (see the comment at the call site). Returns True
    only if the send genuinely succeeded, so vendor_notified stays an
    honest signal instead of a flag that's always True regardless of
    whether anyone was actually reached."""
    if not vendor.email:
        logger.warning(f"Vendor {vendor.id} ({vendor.name}) has no email on file -- can't notify, leaving vendor_notified=False.")
        return False

    from services.communication_agent import send_email

    subject = f"New maintenance job: {ticket.title}"
    body = (
        f"Hi {vendor.name},\n\n"
        f"You've been assigned a new maintenance request:\n\n"
        f"Property: {ticket.property_name or 'Unknown'}"
        + (f", Unit {ticket.unit_number}" if ticket.unit_number else "") + "\n"
        f"Category: {ticket.category.value if ticket.category else 'other'}\n"
        f"Priority: {ticket.priority.value if ticket.priority else 'medium'}\n\n"
        f"Description:\n{ticket.description}\n\n"
        f"Please reach out to the property manager to coordinate access and scheduling."
    )
    status, error = send_email(vendor.email, subject, body)
    if status != "sent":
        logger.warning(f"Vendor notification email to {vendor.email} did not send (status={status}): {error}")
        return False
    return True


async def auto_assign_vendor(ticket: MaintenanceTicket, db: Session) -> None:
    """Automatically find and assign best vendor for ticket category"""
    try:
        # ticket.category can be a plain string here rather than a real
        # TicketCategory member -- SQLAlchemy doesn't coerce an Enum column's
        # value until the object round-trips through the DB (a flush isn't
        # enough), so a freshly-constructed, not-yet-refreshed ticket still
        # holds whatever raw value was passed in. Normalize defensively
        # instead of assuming the caller already did.
        category = ticket.category
        if isinstance(category, str):
            try:
                category = TicketCategory(category)
            except ValueError:
                category = None
        specialties_to_match = CATEGORY_VENDOR_MAP.get(category, [category.value if category else "general"])
        
        vendors = db.query(Vendor).filter(
            Vendor.organization_id == db.query(
                __import__('models.property', fromlist=['Property']).Property.organization_id
            ).filter_by(id=ticket.property_id).scalar_subquery(),
            Vendor.is_active == True
        ).all()
        
        best_vendor = None
        for vendor in vendors:
            if vendor.specialties:
                vendor_specialties = json.loads(vendor.specialties)
                for match in specialties_to_match:
                    if any(match.lower() in s.lower() for s in vendor_specialties):
                        if not best_vendor or (vendor.rating or 0) > (best_vendor.rating or 0):
                            best_vendor = vendor
        
        if best_vendor:
            ticket.vendor_id = best_vendor.id
            # Real gap found and fixed: this used to set vendor_notified=True
            # unconditionally the moment a vendor was matched, without ever
            # actually contacting them -- no email, no SMS, nothing. The AI
            # (agents/agents/maintenance_agent.py, reachable from both the
            # Twilio voice line and in-app chat) would then tell the tenant
            # a vendor was being dispatched, which was never true. Now the
            # flag only flips once a real send actually succeeds.
            ticket.vendor_notified = _notify_vendor(best_vendor, ticket)
            db.commit()
            logger.info(f"Assigned vendor {best_vendor.name} to ticket {ticket.id} (notified={ticket.vendor_notified})")
    except Exception as e:
        logger.error(f"Vendor auto-assign failed: {e}")


def classify_maintenance_request(description: str) -> dict:
    """Rule-based classification fallback (used when AI is unavailable)"""
    desc_lower = description.lower()
    
    if any(w in desc_lower for w in ["leak", "pipe", "toilet", "water", "drain", "faucet", "shower"]):
        return {"category": "plumbing", "priority": "high" if "flood" in desc_lower or "overflow" in desc_lower else "medium"}
    elif any(w in desc_lower for w in ["heat", "hvac", "ac", "furnace", "thermostat", "air condition"]):
        return {"category": "hvac", "priority": "high"}
    elif any(w in desc_lower for w in ["electric", "outlet", "breaker", "light", "power"]):
        return {"category": "electrical", "priority": "high" if "spark" in desc_lower else "medium"}
    elif any(w in desc_lower for w in ["oven", "stove", "refrigerator", "dishwasher", "washer", "dryer"]):
        return {"category": "appliance", "priority": "medium"}
    else:
        return {"category": "other", "priority": "low"}
