"""Investment Analysis Agent routes"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.plan_gate import require_plan
from middleware.auth import get_current_user
from services.investment_agent import compute_investment_analysis

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/investment", tags=["investment"], dependencies=[Depends(require_plan(PlanType.enterprise))])


@router.get("/analysis")
async def get_investment_analysis(
    # Optional: adds an income-approach value ESTIMATE (NOI / this cap rate) -- see
    # services/investment_agent.compute_investment_analysis. Bounded so a typo
    # (e.g. 0.065 instead of 6.5) is rejected instead of producing nonsense.
    assumed_cap_rate: Optional[float] = Query(None, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compute_investment_analysis(db, current_user.organization_id, assumed_cap_rate)
