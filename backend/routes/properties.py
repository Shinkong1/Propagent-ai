"""Property management routes"""
import json
import logging
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, UserRole
from models.property import Property, Unit, PropertyType
from schemas.property import PropertyCreate, PropertyResponse, PropertyUpdate, UnitCreate, UnitResponse, UnitUpdate
from middleware.auth import get_current_user
from middleware.plan_gate import get_plan_limits, enforce_count_limit, require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/", response_model=List[PropertyResponse])
async def list_properties(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Property).filter(
        Property.organization_id == current_user.organization_id,
        Property.is_active == True
    ).all()


@router.post("/", response_model=PropertyResponse, status_code=201)
async def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org = current_user.organization
    existing_count = db.query(Property).filter(
        Property.organization_id == current_user.organization_id,
        Property.is_active == True,
    ).count()
    enforce_count_limit(existing_count, get_plan_limits(org)["properties"], "properties")

    prop = Property(**payload.dict(), organization_id=current_user.organization_id)
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


@router.patch("/{property_id}", response_model=PropertyResponse)
async def update_property(
    property_id: UUID,
    payload: PropertyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    data = payload.dict(exclude_unset=True)
    if "property_type" in data:
        try:
            data["property_type"] = PropertyType(data["property_type"])
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid property_type: {data['property_type']}")

    for field, value in data.items():
        setattr(prop, field, value)

    db.commit()
    db.refresh(prop)
    return prop


@router.delete("/{property_id}", status_code=204)
async def delete_property(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.manager)),
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    occupied = sum(1 for u in prop.units if u.is_occupied)
    if occupied > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — {occupied} unit(s) still have active tenants. Remove or reassign them first.",
        )

    prop.is_active = False
    db.commit()
    return Response(status_code=204)


@router.post("/{property_id}/units", response_model=UnitResponse, status_code=201)
async def create_unit(
    property_id: UUID,
    payload: UnitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    existing_units = db.query(Unit).join(Property).filter(
        Property.organization_id == current_user.organization_id
    ).count()
    enforce_count_limit(existing_units, get_plan_limits(current_user.organization)["units"], "units")

    unit = Unit(**payload.dict(), property_id=property_id)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.get("/{property_id}/units", response_model=List[UnitResponse])
async def list_units(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop.units


@router.patch("/{property_id}/units/{unit_id}", response_model=UnitResponse)
async def update_unit(
    property_id: UUID,
    unit_id: UUID,
    payload: UnitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    unit = db.query(Unit).filter(Unit.id == unit_id, Unit.property_id == property_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(unit, field, value)

    db.commit()
    db.refresh(unit)
    return unit


@router.delete("/{property_id}/units/{unit_id}", status_code=204)
async def delete_unit(
    property_id: UUID,
    unit_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    unit = db.query(Unit).filter(Unit.id == unit_id, Unit.property_id == property_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    if unit.is_occupied:
        raise HTTPException(status_code=400, detail="Cannot delete an occupied unit — end the tenant's lease first.")

    db.delete(unit)
    db.commit()
    return Response(status_code=204)


@router.get("/{property_id}/stats")
async def property_detail_stats(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models.tenant import Lease, LeaseStatus
    from models.maintenance import MaintenanceTicket, TicketStatus

    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    unit_count = db.query(Unit).filter(Unit.property_id == property_id).count()
    occupied_units = db.query(Unit).filter(Unit.property_id == property_id, Unit.is_occupied == True).count()

    open_tickets = db.query(MaintenanceTicket).filter(
        MaintenanceTicket.property_id == property_id,
        MaintenanceTicket.status.in_([TicketStatus.open, TicketStatus.in_progress, TicketStatus.waiting_vendor, TicketStatus.scheduled])
    ).count()

    monthly_revenue = db.query(Lease).join(Unit).filter(
        Unit.property_id == property_id,
        Lease.status == LeaseStatus.active
    ).with_entities(
        func.sum(Lease.monthly_rent)
    ).scalar() or 0.0

    return {
        "property_id": str(property_id),
        "total_units": unit_count,
        "occupied_units": occupied_units,
        "vacancy_rate": round(((unit_count - occupied_units) / unit_count * 100) if unit_count else 0, 1),
        "open_tickets": open_tickets,
        "monthly_revenue": round(monthly_revenue, 2),
    }


@router.get("/{property_id}/vendors", response_model=List[dict])
async def property_vendors(
    property_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Vendors who have worked a ticket at this property"""
    from models.maintenance import MaintenanceTicket, Vendor

    prop = db.query(Property).filter(
        Property.id == property_id,
        Property.organization_id == current_user.organization_id
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    vendors = db.query(Vendor).join(MaintenanceTicket, MaintenanceTicket.vendor_id == Vendor.id).filter(
        MaintenanceTicket.property_id == property_id
    ).distinct().all()

    return [{"id": str(v.id), "name": v.name, "company": v.company, "phone": v.phone,
             "email": v.email, "hourly_rate": v.hourly_rate,
             "specialties": json.loads(v.specialties) if v.specialties else [], "rating": v.rating}
            for v in vendors]


@router.get("/stats/overview")
async def property_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models.tenant import Tenant, Lease, LeaseStatus
    from models.maintenance import MaintenanceTicket, TicketStatus
    
    org_id = current_user.organization_id
    properties = db.query(Property).filter(Property.organization_id == org_id, Property.is_active == True).all()
    total_units = sum(p.total_units for p in properties)
    
    active_leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
        Lease.status == LeaseStatus.active
    ).count()
    
    open_tickets = db.query(MaintenanceTicket).join(Property).filter(
        Property.organization_id == org_id,
        MaintenanceTicket.status.in_([TicketStatus.open, TicketStatus.in_progress])
    ).count()
    
    monthly_revenue = db.query(Lease).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
        Lease.status == LeaseStatus.active
    ).with_entities(
        func.sum(Lease.monthly_rent)
    ).scalar() or 0.0
    
    return {
        "total_properties": len(properties),
        "total_units": total_units,
        "occupied_units": active_leases,
        "vacancy_rate": round(((total_units - active_leases) / total_units * 100) if total_units else 0, 1),
        "open_tickets": open_tickets,
        "monthly_revenue": round(monthly_revenue, 2),
    }


@router.get("/stats/revenue-trend")
async def revenue_trend(
    months: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actual collected rent revenue by month, from real recorded payments (not projected rent)."""
    from datetime import date
    from dateutil.relativedelta import relativedelta
    from models.accounting import RentPayment, PaymentStatus
    from models.tenant import Lease

    org_id = current_user.organization_id
    today = date.today()
    start_month = (today.replace(day=1) - relativedelta(months=months - 1))

    rows = db.query(RentPayment).join(Lease).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
        RentPayment.status == PaymentStatus.paid,
        RentPayment.paid_date >= start_month,
    ).all()

    by_month: dict = {}
    for i in range(months):
        m = start_month + relativedelta(months=i)
        by_month[m.strftime("%Y-%m")] = 0.0
    for r in rows:
        if r.paid_date:
            key = r.paid_date.strftime("%Y-%m")
            if key in by_month:
                by_month[key] += r.amount or 0.0

    trend = [{"month": k, "amount": round(v, 2)} for k, v in by_month.items()]
    return {"trend": trend, "has_payment_history": len(rows) > 0}


@router.get("/stats/units-detail")
async def units_detail(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-unit occupancy breakdown — which units are occupied vs vacant, and by whom."""
    org_id = current_user.organization_id
    units = db.query(Unit).join(Property).filter(Property.organization_id == org_id).all()

    result = []
    for u in units:
        active_lease = u.active_lease
        result.append({
            "unit_id": str(u.id),
            "property_name": u.property.name if u.property else None,
            "unit_number": u.unit_number,
            "is_occupied": u.is_occupied,
            "tenant_name": active_lease.tenant.full_name if active_lease and active_lease.tenant else None,
            "monthly_rent": active_lease.monthly_rent if active_lease else u.monthly_rent,
        })
    return {"units": result}


@router.get("/stats/ai-activity")
async def ai_activity(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real log of AI feature invocations for this organization. Timestamps and feature
    names are genuinely recorded; full conversation transcripts are not persisted anywhere
    in the app, so this shows call history, not response content."""
    from datetime import datetime, timedelta
    from models.platform import AICallLog

    org_id = current_user.organization_id
    cutoff = datetime.utcnow() - timedelta(days=days)
    calls = db.query(AICallLog).filter(
        AICallLog.organization_id == org_id,
        AICallLog.created_at >= cutoff,
    ).order_by(AICallLog.created_at.desc()).all()

    by_feature: dict = {}
    for c in calls:
        by_feature[c.feature] = by_feature.get(c.feature, 0) + 1

    recent = [{"feature": c.feature, "created_at": c.created_at} for c in calls[:50]]
    return {"total": len(calls), "by_feature": by_feature, "recent": recent}
