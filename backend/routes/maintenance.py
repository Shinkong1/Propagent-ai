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
from schemas.maintenance import MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse, ChatMessage
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
        run_workflows(db, current_user.organization, WorkflowTrigger.maintenance_created, {
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


@router.get("/vendors", response_model=List[dict])
async def list_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    vendors = db.query(Vendor).filter(
        Vendor.organization_id == current_user.organization_id,
        Vendor.is_active == True
    ).all()
    return [{"id": str(v.id), "name": v.name, "company": v.company, "phone": v.phone, 
             "specialties": json.loads(v.specialties) if v.specialties else [], "rating": v.rating} 
            for v in vendors]
