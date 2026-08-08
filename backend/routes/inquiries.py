"""Rental inquiries — the subscriber-facing equivalent of the (owner-only)
Lead CRM: finding *tenants* for a subscriber's vacant units via inbound
capture from a public listing page, rather than finding *subscribers* for
PropAgent AI via scraping. Two halves in this one file since they're
tightly coupled: a public, unauthenticated listing/inquiry surface, and a
staff-facing management surface behind normal auth.
"""
import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from models.property import Property, Unit
from models.tenant import Tenant, Lease, LeaseStatus
from models.inquiry import RentalInquiry, InquiryStatus
from middleware.auth import get_current_user
from services.communication_agent import send_email
from schemas.inquiry import (
    PublicListingOut, PublicUnitOut, PublicListingSummary, InquiryCreate,
    InquiryOut, InquiryUpdate, InquiryScreenRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["inquiries"])


def _inquiry_out(i: RentalInquiry) -> InquiryOut:
    return InquiryOut(
        id=i.id, first_name=i.first_name, last_name=i.last_name, email=i.email, phone=i.phone,
        message=i.message, desired_move_in=i.desired_move_in, status=i.status.value, notes=i.notes,
        property_id=i.property_id, property_name=i.property_name,
        unit_id=i.unit_id, unit_number=i.unit_number, created_at=i.created_at,
        annual_income=i.annual_income, credit_score=i.credit_score,
        employment_status=i.employment_status, employer=i.employer,
        screening_approved=i.screening_approved, screening_score=i.screening_score,
        screening_notes=i.screening_notes, screened_at=i.screened_at,
        priority_label=i.priority_label, priority_score=i.priority_score,
        priority_reasoning=i.priority_reasoning, triaged_at=i.triaged_at,
    )


async def _triage_new_inquiry(inquiry_id):
    """Runs after the response is already sent -- the applicant never
    waits on this. Opens its own DB session since the request-scoped `db`
    from the route handler may already be torn down by the time a
    background task actually executes (same pattern _notify_new_inquiry
    below already uses for the same reason)."""
    from database.base import SessionLocal
    from services.inquiry_triage_service import triage_inquiry
    db = SessionLocal()
    try:
        inquiry = db.query(RentalInquiry).filter(RentalInquiry.id == inquiry_id).first()
        if not inquiry:
            return
        result = await triage_inquiry(
            message=inquiry.message, desired_move_in=inquiry.desired_move_in,
            has_email=bool(inquiry.email), has_phone=bool(inquiry.phone),
        )
        inquiry.priority_label = result["label"]
        inquiry.priority_score = result["score"]
        inquiry.priority_reasoning = result["reasoning"]
        inquiry.triaged_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        logger.warning(f"Inquiry triage failed for {inquiry_id}: {e}")
    finally:
        db.close()


def _notify_new_inquiry(org_id, property_name: str, inquiry: RentalInquiry):
    """Best-effort email to the org's owner(s) — never blocks or fails the
    public submission if it doesn't work."""
    from database.base import SessionLocal
    db = SessionLocal()
    try:
        owners = db.query(User).filter(User.organization_id == org_id, User.role == "owner", User.is_active == True).all()
        for owner in owners:
            body = (
                f"New rental inquiry for {property_name}"
                + (f", Unit {inquiry.unit_number}" if inquiry.unit_number else "")
                + f":\n\n{inquiry.full_name}\n{inquiry.email or 'no email'}\n{inquiry.phone or 'no phone'}\n\n"
                + (inquiry.message or "(no message)")
            )
            send_email(owner.email, f"New rental inquiry — {property_name}", body)
    except Exception as e:
        logger.warning(f"Inquiry notification failed: {e}")
    finally:
        db.close()


# ── Public — no auth, meant to be embedded/linked from anywhere ──

@router.get("/public/listings", response_model=List[PublicListingSummary])
async def browse_public_listings(
    city: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """The public /listings directory — every property whose manager has
    opted in (is_public_listing=True) and that currently has at least one
    vacant unit. This is what gives renters a reason to land on
    propagent.app organically instead of only ever reaching a listing via
    a link someone sent them directly."""
    q = db.query(Property).filter(Property.is_active == True, Property.is_public_listing == True)
    if city:
        q = q.filter(Property.city.ilike(f"%{city.strip()}%"))
    if state:
        q = q.filter(Property.state.ilike(f"%{state.strip()}%"))

    results: List[PublicListingSummary] = []
    for prop in q.order_by(Property.city).all():
        units = [u for u in prop.units if u.is_available and not u.is_occupied]
        if not units:
            continue
        rents = [u.monthly_rent for u in units]
        beds = [u.bedrooms for u in units]
        results.append(PublicListingSummary(
            id=prop.id, name=prop.name, city=prop.city, state=prop.state,
            property_type=prop.property_type.value, unit_count=len(units),
            min_rent=min(rents), max_rent=max(rents),
            min_bedrooms=min(beds), max_bedrooms=max(beds),
        ))
    return results


@router.get("/public/listings/{property_id}", response_model=PublicListingOut)
async def get_public_listing(property_id: UUID, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id, Property.is_active == True).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Listing not found")

    units = db.query(Unit).filter(Unit.property_id == property_id, Unit.is_available == True, Unit.is_occupied == False).all()

    return PublicListingOut(
        id=prop.id, name=prop.name, address=prop.address, city=prop.city, state=prop.state,
        zip_code=prop.zip_code, property_type=prop.property_type.value, description=prop.description,
        units=[PublicUnitOut.model_validate(u) for u in units],
    )


@router.post("/public/listings/{property_id}/inquire", status_code=201)
async def submit_inquiry(
    property_id: UUID,
    payload: InquiryCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    prop = db.query(Property).filter(Property.id == property_id, Property.is_active == True).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Listing not found")

    if payload.unit_id:
        unit = db.query(Unit).filter(Unit.id == payload.unit_id, Unit.property_id == property_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found at this property")

    inquiry = RentalInquiry(
        organization_id=prop.organization_id, property_id=property_id, unit_id=payload.unit_id,
        first_name=payload.first_name, last_name=payload.last_name, email=payload.email, phone=payload.phone,
        message=payload.message, desired_move_in=payload.desired_move_in, status=InquiryStatus.new,
    )
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)

    background_tasks.add_task(_notify_new_inquiry, prop.organization_id, prop.name, inquiry)
    background_tasks.add_task(_triage_new_inquiry, inquiry.id)

    return {"message": "Inquiry submitted"}


# ── Staff-facing — normal auth, org-scoped ──

@router.get("/inquiries", response_model=List[InquiryOut])
async def list_inquiries(
    property_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(RentalInquiry).filter(RentalInquiry.organization_id == current_user.organization_id)
    if property_id:
        q = q.filter(RentalInquiry.property_id == property_id)
    if status:
        q = q.filter(RentalInquiry.status == status)
    inquiries = q.order_by(RentalInquiry.created_at.desc()).all()
    return [_inquiry_out(i) for i in inquiries]


@router.patch("/inquiries/{inquiry_id}", response_model=InquiryOut)
async def update_inquiry(
    inquiry_id: UUID,
    payload: InquiryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = db.query(RentalInquiry).filter(
        RentalInquiry.id == inquiry_id, RentalInquiry.organization_id == current_user.organization_id
    ).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    if payload.status is not None:
        try:
            inquiry.status = InquiryStatus(payload.status)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid status '{payload.status}'")
    if payload.notes is not None:
        inquiry.notes = payload.notes

    db.commit()
    db.refresh(inquiry)
    return _inquiry_out(inquiry)


@router.delete("/inquiries/{inquiry_id}", status_code=204)
async def delete_inquiry(
    inquiry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inquiry = db.query(RentalInquiry).filter(
        RentalInquiry.id == inquiry_id, RentalInquiry.organization_id == current_user.organization_id
    ).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    db.delete(inquiry)
    db.commit()


@router.post("/inquiries/{inquiry_id}/screen", response_model=InquiryOut)
async def screen_inquiry(
    inquiry_id: UUID,
    payload: InquiryScreenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run the same scoring logic as the standalone /screening/evaluate
    endpoint, but against an inquiry directly -- no Tenant record needs to
    exist yet. This is meant to run BEFORE convert-to-tenant, not after:
    decide whether to approve someone before you create their account."""
    from services.tenant_service import evaluate_screening

    inquiry = db.query(RentalInquiry).filter(
        RentalInquiry.id == inquiry_id, RentalInquiry.organization_id == current_user.organization_id
    ).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    result = await evaluate_screening(
        annual_income=payload.annual_income,
        monthly_rent=payload.monthly_rent,
        credit_score=payload.credit_score or 0,
        employment_status=payload.employment_status,
    )

    inquiry.annual_income = payload.annual_income
    inquiry.credit_score = payload.credit_score
    inquiry.employment_status = payload.employment_status
    inquiry.employer = payload.employer
    inquiry.screening_approved = result["approved"]
    inquiry.screening_score = result["score"]
    inquiry.screening_notes = "; ".join(result.get("issues", [])) or None
    inquiry.screened_at = datetime.utcnow()
    if inquiry.status == InquiryStatus.new:
        inquiry.status = InquiryStatus.applied

    db.commit()
    db.refresh(inquiry)
    return _inquiry_out(inquiry)


@router.post("/inquiries/{inquiry_id}/convert-to-tenant", response_model=dict, status_code=201)
async def convert_inquiry_to_tenant(
    inquiry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a real Tenant from this inquiry — and a Lease too, if the
    inquiry was tied to a specific unit that's still vacant. Screening is
    never hard-required here -- it's the property manager's call whether to
    convert an unscreened or declined applicant anyway, same as it would be
    in real life; screening data just carries over onto the Tenant record
    if it exists."""
    inquiry = db.query(RentalInquiry).filter(
        RentalInquiry.id == inquiry_id, RentalInquiry.organization_id == current_user.organization_id
    ).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")

    tenant = Tenant(
        organization_id=current_user.organization_id,
        first_name=inquiry.first_name, last_name=inquiry.last_name,
        email=inquiry.email, phone=inquiry.phone,
        annual_income=inquiry.annual_income, credit_score=inquiry.credit_score,
        employment_status=inquiry.employment_status, employer=inquiry.employer,
        screening_approved=inquiry.screening_approved,
    )
    db.add(tenant)
    db.flush()

    lease_created = False
    if inquiry.unit_id:
        unit = db.query(Unit).filter(Unit.id == inquiry.unit_id, Unit.is_occupied == False).first()
        if unit:
            from datetime import date
            today = date.today()
            db.add(Lease(
                tenant_id=tenant.id, unit_id=unit.id,
                monthly_rent=unit.monthly_rent, security_deposit=unit.monthly_rent * 1.5,
                start_date=today, end_date=today.replace(year=today.year + 1),
                status=LeaseStatus.active,
            ))
            unit.is_occupied = True
            unit.is_available = False
            lease_created = True

    inquiry.status = InquiryStatus.converted
    db.commit()

    return {"tenant_id": str(tenant.id), "lease_created": lease_created}
