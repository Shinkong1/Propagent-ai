"""Tenant management routes"""
import logging
from datetime import date
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType, UserRole
from models.tenant import Tenant, Lease, LeaseStatus
from models.property import Unit, Property
from models.workflow import WorkflowTrigger
from schemas.tenant import TenantCreate, TenantUpdate, TenantResponse, LeaseCreate
from schemas.import_schemas import ImportResult, ImportRowError
from services.import_service import parse_uploaded_table, row_get
from services.workflow_engine import run_workflows
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

    try:
        # "New Tenant Added" was a selectable trigger in the no-code
        # workflow builder that silently never fired -- create_tenant
        # never called run_workflows at all. Same pattern as leads.py's
        # lead_created trigger: run off the event loop since a matching
        # rule can send email/SMS synchronously.
        await run_in_threadpool(run_workflows, db, current_user.organization, WorkflowTrigger.tenant_created, {
            "name": tenant.full_name,
            "email": tenant.email,
            "phone": tenant.phone,
        })
    except Exception as e:
        logger.warning(f"Workflow evaluation failed for tenant {tenant.id}: {e}")

    return tenant


@router.post("/import", response_model=ImportResult, status_code=201)
async def import_tenants(
    file: UploadFile = File(...),
    property_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk-create tenants from an uploaded CSV/XLSX. If property_id is
    given and a row has a unit_number that matches a vacant unit at that
    property, the tenant is also leased into it automatically — same as
    picking a unit in the Add Tenant form. Otherwise the tenant is
    created unassigned (not an error, just noted)."""
    prop = None
    if property_id:
        try:
            prop_uuid = UUID(property_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid property_id")
        prop = db.query(Property).filter(
            Property.id == prop_uuid, Property.organization_id == current_user.organization_id
        ).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

    rows = await parse_uploaded_table(file)

    created = 0
    skipped = 0
    errors: List[ImportRowError] = []

    for i, row in enumerate(rows):
        row_num = i + 2  # header is row 1 in the uploaded file, so first data row is row 2
        first_name = row_get(row, "first_name", "firstname", "first")
        last_name = row_get(row, "last_name", "lastname", "last")
        if not first_name or not last_name:
            skipped += 1
            errors.append(ImportRowError(row=row_num, reason="Missing first or last name"))
            continue

        income_raw = row_get(row, "annual_income", "income")
        annual_income = None
        if income_raw:
            try:
                annual_income = float(income_raw.replace(",", "").replace("$", ""))
            except ValueError:
                errors.append(ImportRowError(row=row_num, reason=f"Invalid annual income '{income_raw}' — tenant created without it"))

        tenant = Tenant(
            organization_id=current_user.organization_id,
            first_name=first_name, last_name=last_name,
            email=row_get(row, "email") or None,
            phone=row_get(row, "phone", "phone_number") or None,
            employer=row_get(row, "employer") or None,
            employment_status=row_get(row, "employment_status", "employment") or None,
            annual_income=annual_income,
        )
        db.add(tenant)
        db.flush()  # assigns tenant.id without committing, so a lease can reference it

        unit_number = row_get(row, "unit_number", "unit", "unit_#")
        if prop and unit_number:
            unit = db.query(Unit).filter(
                Unit.property_id == prop.id,
                Unit.unit_number == unit_number,
                Unit.is_occupied == False,
            ).first()
            if unit:
                today = date.today()
                db.add(Lease(
                    tenant_id=tenant.id, unit_id=unit.id,
                    monthly_rent=unit.monthly_rent, security_deposit=unit.monthly_rent * 1.5,
                    start_date=today, end_date=today.replace(year=today.year + 1),
                    status=LeaseStatus.active,
                ))
                unit.is_occupied = True
                unit.is_available = False
            else:
                errors.append(ImportRowError(row=row_num, reason=f"Tenant created, but unit '{unit_number}' not found or already occupied — left unassigned"))

        created += 1

    db.commit()
    return ImportResult(created=created, skipped=skipped, errors=errors)


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
