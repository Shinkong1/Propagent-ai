"""Tenant management routes"""
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType, UserRole
from models.tenant import Tenant, Lease, LeaseStatus
from models.property import Unit, Property
from schemas.tenant import TenantCreate, TenantUpdate, TenantResponse, LeaseCreate
from middleware.auth import get_current_user
from middleware.plan_gate import require_plan, require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/", response_model=List[TenantResponse])
async def list_tenants(
    property_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Tenant).filter(
        Tenant.organization_id == current_user.organization_id,
        Tenant.is_active == True
    )
    if property_id:
        query = query.join(Lease, Lease.tenant_id == Tenant.id).join(Unit).filter(
            Lease.status == LeaseStatus.active,
            Unit.property_id == property_id
        )
    return query.all()


@router.post("/", response_model=TenantResponse, status_code=201)
async def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant = Tenant(**payload.dict(), organization_id=current_user.organization_id)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.organization_id == current_user.organization_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: UUID,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.organization_id == current_user.organization_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    for field, value in payload.dict(exclude_none=True).items():
        setattr(tenant, field, value)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.manager)),
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.organization_id == current_user.organization_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Free up their unit and close out any active lease so occupancy/revenue stay accurate.
    for lease in tenant.leases:
        if lease.status == LeaseStatus.active:
            lease.status = LeaseStatus.terminated
            if lease.unit:
                lease.unit.is_occupied = False
                lease.unit.is_available = True

    tenant.is_active = False
    db.commit()
    return Response(status_code=204)


@router.post("/leases", status_code=201)
async def create_lease(
    payload: LeaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    unit = db.query(Unit).join(Property).filter(
        Unit.id == payload.unit_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    tenant = db.query(Tenant).filter(
        Tenant.id == payload.tenant_id,
        Tenant.organization_id == current_user.organization_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    lease = Lease(**payload.dict(), status=LeaseStatus.active)
    unit.is_occupied = True
    unit.is_available = False
    db.add(lease)
    db.commit()
    db.refresh(lease)
    return {"id": str(lease.id), "status": "active", "message": "Lease created successfully"}


@router.get("/leases/{lease_id}/contract")
async def generate_lease_contract(
    lease_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_plan(PlanType.professional)),
):
    """Generate a rental lease contract PDF — Professional plan and up"""
    lease = db.query(Lease).join(Unit).join(Property).filter(
        Lease.id == lease_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")

    from services.contract_service import generate_lease_contract_pdf
    org_name = current_user.organization.name if current_user.organization else "Landlord"
    pdf_bytes = generate_lease_contract_pdf(lease, org_name)

    tenant_slug = lease.tenant.full_name.replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="lease_{tenant_slug}.pdf"'},
    )
