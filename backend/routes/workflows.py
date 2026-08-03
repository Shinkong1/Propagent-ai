"""No-code workflow automation — CRUD for org-defined rules plus a dry-run
test endpoint so the builder UI can preview matches before saving."""
import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from models.workflow import WorkflowRule, WorkflowTrigger
from schemas.workflow import (
    WorkflowRuleCreate, WorkflowRuleUpdate, WorkflowRuleResponse,
    WorkflowTestRequest, WorkflowTestResponse,
)
from middleware.auth import get_current_user
from middleware.plan_gate import require_plan
from services.workflow_engine import evaluate_conditions, execute_actions

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workflows", tags=["workflows"], dependencies=[Depends(require_plan(PlanType.enterprise))])

TRIGGER_METADATA = {
    "maintenance_created": {
        "label": "Maintenance Ticket Created",
        "fields": ["title", "category", "priority", "status", "estimated_cost", "email", "phone"],
    },
    "lead_created": {
        "label": "New Lead Created",
        "fields": ["name", "source", "status", "email", "phone"],
    },
    "tenant_created": {
        "label": "New Tenant Added",
        "fields": ["first_name", "last_name", "email", "phone", "monthly_rent"],
    },
    "payment_overdue": {
        "label": "Payment Overdue",
        "fields": ["tenant_name", "amount_due", "days_overdue", "email", "phone"],
    },
}
OPERATORS = ["equals", "not_equals", "contains", "greater_than", "less_than"]
ACTION_TYPES = ["notify_owner", "send_email", "send_sms"]


def _serialize(rule: WorkflowRule) -> WorkflowRuleResponse:
    return WorkflowRuleResponse(
        id=str(rule.id), name=rule.name, trigger=rule.trigger.value,
        conditions=rule.conditions or [], actions=rule.actions or [],
        is_active=rule.is_active, run_count=rule.run_count or 0,
        last_run_at=rule.last_run_at, created_at=rule.created_at,
    )


@router.get("/metadata")
async def get_metadata():
    return {"triggers": TRIGGER_METADATA, "operators": OPERATORS, "action_types": ACTION_TYPES}


@router.get("/", response_model=List[WorkflowRuleResponse])
async def list_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rules = db.query(WorkflowRule).filter(
        WorkflowRule.organization_id == current_user.organization_id
    ).order_by(WorkflowRule.created_at.desc()).all()
    return [_serialize(r) for r in rules]


@router.post("/", response_model=WorkflowRuleResponse, status_code=201)
async def create_rule(
    payload: WorkflowRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.trigger not in TRIGGER_METADATA:
        raise HTTPException(status_code=422, detail=f"Unknown trigger: {payload.trigger}")
    for cond in payload.conditions:
        if cond.operator not in OPERATORS:
            raise HTTPException(status_code=422, detail=f"Unknown operator: {cond.operator}")
    for action in payload.actions:
        if action.type not in ACTION_TYPES:
            raise HTTPException(status_code=422, detail=f"Unknown action type: {action.type}")

    rule = WorkflowRule(
        organization_id=current_user.organization_id,
        name=payload.name,
        trigger=WorkflowTrigger(payload.trigger),
        conditions=[c.dict() for c in payload.conditions],
        actions=[a.dict() for a in payload.actions],
        is_active=payload.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _serialize(rule)


@router.patch("/{rule_id}", response_model=WorkflowRuleResponse)
async def update_rule(
    rule_id: UUID,
    payload: WorkflowRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.query(WorkflowRule).filter(
        WorkflowRule.id == rule_id, WorkflowRule.organization_id == current_user.organization_id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")

    data = payload.dict(exclude_unset=True)
    if "conditions" in data and data["conditions"] is not None:
        rule.conditions = [c if isinstance(c, dict) else c.dict() for c in payload.conditions]
    if "actions" in data and data["actions"] is not None:
        rule.actions = [a if isinstance(a, dict) else a.dict() for a in payload.actions]
    if "name" in data and data["name"] is not None:
        rule.name = data["name"]
    if "is_active" in data and data["is_active"] is not None:
        rule.is_active = data["is_active"]

    db.commit()
    db.refresh(rule)
    return _serialize(rule)


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.query(WorkflowRule).filter(
        WorkflowRule.id == rule_id, WorkflowRule.organization_id == current_user.organization_id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")
    db.delete(rule)
    db.commit()


@router.post("/{rule_id}/test", response_model=WorkflowTestResponse)
async def test_rule(
    rule_id: UUID,
    payload: WorkflowTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rule = db.query(WorkflowRule).filter(
        WorkflowRule.id == rule_id, WorkflowRule.organization_id == current_user.organization_id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Workflow rule not found")

    matched = evaluate_conditions(rule.conditions, payload.sample_data)
    would_run = execute_actions(db, current_user.organization, rule.actions, payload.sample_data, dry_run=True) if matched else []
    return WorkflowTestResponse(matched=matched, would_run_actions=would_run)
