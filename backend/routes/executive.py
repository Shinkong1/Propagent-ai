"""Executive AI Assistant routes — natural language portfolio queries"""
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.plan_gate import require_plan, check_and_increment_ai_calls
from services.executive_agent import answer_query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/executive", tags=["executive"])


class ExecutiveQuery(BaseModel):
    query: str


EXAMPLE_QUERIES = [
    "Show me all vacant units.",
    "What repairs cost over $500 this month?",
    "Which tenants are likely to renew?",
    "What properties are underperforming?",
    "Forecast next month's revenue.",
    "What capital improvements should I prioritize?",
]


@router.get("/suggestions")
async def suggestions(current_user: User = Depends(require_plan(PlanType.professional))):
    return {"suggestions": EXAMPLE_QUERIES}


@router.post("/query")
async def query_executive_assistant(
    payload: ExecutiveQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_plan(PlanType.professional)),
):
    check_and_increment_ai_calls(db, current_user.organization, feature="executive_query")
    return await answer_query(db, current_user.organization_id, payload.query)
