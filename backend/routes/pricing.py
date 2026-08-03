"""Pricing Intelligence Agent routes"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.plan_gate import require_plan
from middleware.auth import get_current_user
from services.pricing_agent import compute_pricing_analysis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pricing-intel", tags=["pricing"], dependencies=[Depends(require_plan(PlanType.enterprise))])


@router.get("/analysis")
async def get_pricing_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compute_pricing_analysis(db, current_user.organization_id)
