"""Predictive Insights routes — Enterprise-tier."""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.auth import get_current_user
from middleware.plan_gate import require_plan
from services.predictive_service import predict_maintenance_risk, predict_lease_renewal_risk

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predictive", tags=["predictive"], dependencies=[Depends(require_plan(PlanType.enterprise))])


@router.get("/maintenance-risk")
async def maintenance_risk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"signals": predict_maintenance_risk(db, current_user.organization_id)}


@router.get("/renewal-risk")
async def renewal_risk(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"signals": predict_lease_renewal_risk(db, current_user.organization_id)}
