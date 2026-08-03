"""Fraud/Risk detection routes — Professional-tier and up, same tier as
tenant screening itself."""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.auth import get_current_user
from middleware.plan_gate import require_plan
from services.fraud_service import scan_duplicate_applications, scan_income_anomalies, scan_payment_anomalies

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/fraud", tags=["fraud"], dependencies=[Depends(require_plan(PlanType.professional))])


@router.get("/scan")
async def fraud_scan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    duplicates = scan_duplicate_applications(db, current_user.organization_id)
    income = scan_income_anomalies(db, current_user.organization_id)
    payments = scan_payment_anomalies(db, current_user.organization_id)
    all_flags = duplicates + income + payments
    return {
        "flags": all_flags,
        "counts": {
            "high": sum(1 for f in all_flags if f["severity"] == "high"),
            "medium": sum(1 for f in all_flags if f["severity"] == "medium"),
            "low": sum(1 for f in all_flags if f["severity"] == "low"),
        },
    }
