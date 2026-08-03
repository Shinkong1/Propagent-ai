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


async def auto_assign_vendor(ticket: MaintenanceTicket, db: Session) -> None:
    """Automatically find and assign best vendor for ticket category"""
    try:
        specialties_to_match = CATEGORY_VENDOR_MAP.get(ticket.category, [ticket.category.value if ticket.category else "general"])
        
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
            ticket.vendor_notified = True
            db.commit()
            logger.info(f"Assigned vendor {best_vendor.name} to ticket {ticket.id}")
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
