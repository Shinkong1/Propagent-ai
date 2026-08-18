"""Maintenance ticket routes"""
import json
import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from models.maintenance import MaintenanceTicket, Vendor, TicketStatus, TicketPriority
from models.property import Property
from schemas.maintenance import (
    MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse, ChatMessage,
    VendorCreate, VendorUpdate, VendorResponse,
)
from middleware.auth import get_current_user
from middleware.plan_gate import check_and_increment_ai_calls
from models.owner_message import OwnerMessageSource
from services.owner_notify import notify_owner
from models.workflow import WorkflowTrigger
from services.workflow_engine import run_workflows

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("/", response_model=List[MaintenanceResponse])
async def list_tickets(
    status: Optional[str] = None,
    property_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(MaintenanceTicket).join(Property).filter(
        Property.organization_id == current_user.organization_id
    )
    if status:
        query = query.filter(MaintenanceTicket.status == status)
    if property_id:
        query = query.filter(MaintenanceTicket.property_id == property_id)
    return query.order_by(MaintenanceTicket.created_at.desc()).all()


@router.post("/", response_model=MaintenanceResponse, status_code=201)
async def create_ticket(
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prop = db.query(Property).filter(
        Property.id == payload.property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    # unit_id/tenant_id are optional on this payload and were previously
    # persisted unchecked -- a foreign org's real unit_id/tenant_id would
    # both create a cross-org dangling reference AND leak that unit's
    # unit_number back in the response (MaintenanceResponse.unit_number is
    # a computed property off the real relationship). Found in a security audit.
    if payload.unit_id:
        from models.property import Unit
        owns_unit = db.query(Unit.id).filter(Unit.id == payload.unit_id, Unit.property_id == payload.property_id).first()
        if not owns_unit:
            raise HTTPException(status_code=404, detail="Unit not found")
    if payload.tenant_id:
        from models.tenant import Tenant
        owns_tenant = db.query(Tenant.id).filter(Tenant.id == payload.tenant_id, Tenant.organization_id == current_user.organization_id).first()
        if not owns_tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

    ticket = MaintenanceTicket(**payload.dict())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Auto-assign vendor if available
    from services.maintenance_service import auto_assign_vendor
    await auto_assign_vendor(ticket, db)

    try:
        from models.tenant import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == ticket.tenant_id).first() if ticket.tenant_id else None
        # See leads.py's create_lead for why this needs the threadpool: a
        # matching rule can send email/SMS synchronously, and this is a
        # single-worker server.
        await run_in_threadpool(run_workflows, db, current_user.organization, WorkflowTrigger.maintenance_created, {
            "title": ticket.title,
            "category": ticket.category.value if ticket.category else None,
            "priority": ticket.priority.value if ticket.priority else None,
            "status": ticket.status.value if ticket.status else None,
            "estimated_cost": ticket.estimated_cost,
            "email": tenant.email if tenant else None,
            "phone": tenant.phone if tenant else None,
        })
    except Exception as e:
        logger.warning(f"Workflow evaluation failed for maintenance ticket {ticket.id}: {e}")

    return ticket


@router.patch("/{ticket_id}", response_model=MaintenanceResponse)
async def update_ticket(
    ticket_id: UUID,
    payload: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(MaintenanceTicket).join(Property).filter(
        MaintenanceTicket.id == ticket_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    for field, value in payload.dict(exclude_none=True).items():
        setattr(ticket, field, value)

    if payload.status == "completed" and ticket.completed_date is None:
        ticket.completed_date = datetime.utcnow()
    elif payload.status is not None and payload.status != "completed":
        ticket.completed_date = None

    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/ai-chat")
async def ai_chat(
    payload: ChatMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Process a tenant message via AI agent and return response"""
    from agents.graph import process_message
    org = current_user.organization
    check_and_increment_ai_calls(db, org, feature="maintenance_chat")
    result = await process_message(
        message=payload.message,
        tenant_id=str(payload.tenant_id) if payload.tenant_id else None,
        property_id=str(payload.property_id) if payload.property_id else None,
        organization_id=str(current_user.organization_id) if current_user.organization_id else None,
        channel=payload.channel,
        db=db,
        language=org.language if org else "en",
    )

    try:
        # blocking SMTP call under the hood — keep it off the event loop.
        await run_in_threadpool(
            notify_owner,
            db=db,
            source=OwnerMessageSource.chat,
            subject=f"Chat message from {current_user.full_name}" + (f" ({org.name})" if org else ""),
            body=f"Message: {payload.message}\n\nAI response: {result.get('response', '')}\nIntent: {result.get('intent', '')}",
            organization=org,
            sender_name=current_user.full_name,
            sender_email=current_user.email,
        )
    except Exception as e:
        logger.warning(f"Failed to notify owner of chat message: {e}")

    return result


def _vendor_out(v: Vendor) -> dict:
    return {
        "id": v.id, "name": v.name, "company": v.company, "email": v.email, "phone": v.phone,
        "specialties": json.loads(v.specialties) if v.specialties else [],
        "hourly_rate": v.hourly_rate, "rating": v.rating, "is_preferred": v.is_preferred,
        "notes": v.notes, "created_at": v.created_at,
    }


@router.get("/vendors", response_model=List[VendorResponse])
async def list_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vendors = db.query(Vendor).filter(
        Vendor.organization_id == current_user.organization_id,
        Vendor.is_active == True
    ).order_by(Vendor.is_preferred.desc(), Vendor.name).all()
    return [_vendor_out(v) for v in vendors]


@router.post("/vendors", response_model=VendorResponse, status_code=201)
async def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vendor = Vendor(
        organization_id=current_user.organization_id,
        name=payload.name, company=payload.company, email=payload.email, phone=payload.phone,
        specialties=json.dumps(payload.specialties) if payload.specialties else None,
        hourly_rate=payload.hourly_rate, is_preferred=payload.is_preferred, notes=payload.notes,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return _vendor_out(vendor)


@router.patch("/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: UUID,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id, Vendor.organization_id == current_user.organization_id
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    data = payload.dict(exclude_unset=True)
    if "specialties" in data:
        data["specialties"] = json.dumps(data["specialties"]) if data["specialties"] else None
    for field, value in data.items():
        setattr(vendor, field, value)
    db.commit()
    db.refresh(vendor)
    return _vendor_out(vendor)


@router.delete("/vendors/{vendor_id}", status_code=204)
async def delete_vendor(
    vendor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id, Vendor.organization_id == current_user.organization_id
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    # Soft-delete, same pattern as delete_tenant -- keeps history on any
    # ticket/expense that already references this vendor intact.
    vendor.is_active = False
    db.commit()
    return None
