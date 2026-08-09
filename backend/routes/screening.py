"""Tenant screening routes"""
import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from schemas.tenant import ScreeningRequest
from services.screening_service import run_full_screening, generate_screening_report
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/screening", tags=["screening"])


@router.post("/evaluate")
async def evaluate_tenant(
    payload: ScreeningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run AI screening evaluation for a tenant application"""
    from models.tenant import Tenant
    tenant = db.query(Tenant).filter(
        Tenant.id == payload.tenant_id,
        Tenant.organization_id == current_user.organization_id,
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Real gap found and fixed: this used to hardcode monthly_rent = 1500.0
    # for every applicant regardless of the actual unit's real rent, which
    # directly fed the income-to-rent-ratio math in evaluate_screening
    # (services/tenant_service.py) -- silently wrong rent in means a
    # silently wrong approve/decline decision out. Use the tenant's real
    # active lease rent; if they don't have one yet, this endpoint can't
    # produce a meaningful score at all, so it says so instead of guessing.
    active_lease = tenant.active_lease
    if not active_lease:
        raise HTTPException(
            status_code=400,
            detail="This tenant has no active lease yet, so there's no real rent to screen against. "
                   "Create a lease first, or use the rental-inquiry screening flow (which takes rent directly) before converting an applicant to a tenant.",
        )
    monthly_rent = active_lease.monthly_rent

    result = await run_full_screening(
        tenant_id=str(payload.tenant_id),
        annual_income=payload.annual_income,
        monthly_rent=monthly_rent,
        credit_score=payload.credit_score,
        employment_status=payload.employment_status,
        employer=payload.employer,
        references=payload.references,
        db=db,
    )

    report = generate_screening_report(result, tenant.full_name, monthly_rent)
    return {**result, "report": report, "tenant_name": tenant.full_name}
