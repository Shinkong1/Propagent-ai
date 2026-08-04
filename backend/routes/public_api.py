"""Public REST API (X-API-Key auth) for external integrations — Zapier, Make,
or custom scripts. Separate DTOs from the internal app routes on purpose: this
surface is a versioned contract with third parties and shouldn't silently
change shape when internal models evolve.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.session import get_db
from middleware.auth import get_org_from_api_key
from models.user import Organization
from models.property import Property
from models.tenant import Tenant
from models.maintenance import MaintenanceTicket, TicketCategory, TicketPriority, TicketStatus
from models.lead import Lead, LeadSource, LeadStatus

router = APIRouter(prefix="/api/v1", tags=["public-api"])


# ── Schemas ──

class PropertyOut(BaseModel):
    id: UUID
    name: str
    address: str
    city: str
    state: str
    total_units: int

    class Config:
        from_attributes = True


class TenantOut(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TenantIn(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class MaintenanceTicketOut(BaseModel):
    id: UUID
    property_id: UUID
    title: str
    description: str
    category: str
    priority: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class MaintenanceTicketIn(BaseModel):
    property_id: UUID
    title: str
    description: str
    category: str = "other"
    priority: str = "medium"


class LeadOut(BaseModel):
    id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str
    status: str
    score: int
    created_at: datetime

    class Config:
        from_attributes = True


class LeadIn(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str = "manual"


def _enum_or_400(enum_cls, value: str, field_name: str):
    try:
        return enum_cls(value)
    except ValueError:
        valid = ", ".join(e.value for e in enum_cls)
        raise HTTPException(status_code=422, detail=f"Invalid {field_name} '{value}'. Valid values: {valid}")


# ── Properties (read-only — used to populate dropdowns in Zapier actions) ──

@router.get("/properties", response_model=list[PropertyOut])
async def list_properties(
    org: Organization = Depends(get_org_from_api_key),
    db: Session = Depends(get_db),
):
    return db.query(Property).filter(Property.organization_id == org.id).order_by(Property.name).all()


# ── Tenants ──

@router.get("/tenants", response_model=list[TenantOut])
async def list_tenants(
    since: Optional[datetime] = Query(None, description="Only return tenants created after this ISO timestamp"),
    limit: int = Query(25, le=100),
    org: Organization = Depends(get_org_from_api_key),
    db: Session = Depends(get_db),
):
    q = db.query(Tenant).filter(Tenant.organization_id == org.id)
    if since:
        q = q.filter(Tenant.created_at > since)
    return q.order_by(Tenant.created_at.desc()).limit(limit).all()


@router.post("/tenants", response_model=TenantOut, status_code=201)
async def create_tenant(
    payload: TenantIn,
    org: Organization = Depends(get_org_from_api_key),
    db: Session = Depends(get_db),
):
    tenant = Tenant(organization_id=org.id, **payload.dict())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


# ── Maintenance tickets ──

@router.get("/maintenance", response_model=list[MaintenanceTicketOut])
async def list_maintenance_tickets(
    since: Optional[datetime] = Query(None),
    limit: int = Query(25, le=100),
    org: Organization = Depends(get_org_from_api_key),
    db: Session = Depends(get_db),
):
    q = (
        db.query(MaintenanceTicket)
        .join(Property, MaintenanceTicket.property_id == Property.id)
        .filter(Property.organization_id == org.id)
    )
    if since:
        q = q.filter(MaintenanceTicket.created_at > since)
    return q.order_by(MaintenanceTicket.created_at.desc()).limit(limit).all()


@router.post("/maintenance", response_model=MaintenanceTicketOut, status_code=201)
async def create_maintenance_ticket(
    payload: MaintenanceTicketIn,
    org: Organization = Depends(get_org_from_api_key),
    db: Session = Depends(get_db),
):
    prop = db.query(Property).filter(Property.id == payload.property_id, Property.organization_id == org.id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    category = _enum_or_400(TicketCategory, payload.category, "category")
    priority = _enum_or_400(TicketPriority, payload.priority, "priority")
    ticket = MaintenanceTicket(
        property_id=prop.id, title=payload.title, description=payload.description,
        category=category, priority=priority, status=TicketStatus.open,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


# ── Leads ──

@router.get("/leads", response_model=list[LeadOut])
async def list_leads(
    since: Optional[datetime] = Query(None),
    limit: int = Query(25, le=100),
    org: Organization = Depends(get_org_from_api_key),
    db: Session = Depends(get_db),
):
    q = db.query(Lead).filter(Lead.organization_id == org.id)
    if since:
        q = q.filter(Lead.created_at > since)
    return q.order_by(Lead.created_at.desc()).limit(limit).all()


@router.post("/leads", response_model=LeadOut, status_code=201)
async def create_lead(
    payload: LeadIn,
    org: Organization = Depends(get_org_from_api_key),
    db: Session = Depends(get_db),
):
    source = _enum_or_400(LeadSource, payload.source, "source")
    lead = Lead(organization_id=org.id, **{**payload.dict(exclude={"source"}), "source": source}, status=LeadStatus.new)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
