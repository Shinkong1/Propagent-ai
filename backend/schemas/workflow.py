from typing import List, Optional, Any
from pydantic import BaseModel
from datetime import datetime


class WorkflowCondition(BaseModel):
    field: str
    operator: str  # equals | not_equals | contains | greater_than | less_than
    value: Any


class WorkflowAction(BaseModel):
    type: str  # notify_owner | send_email | send_sms
    params: dict = {}


class WorkflowRuleCreate(BaseModel):
    name: str
    trigger: str
    conditions: List[WorkflowCondition] = []
    actions: List[WorkflowAction] = []
    is_active: bool = True


class WorkflowRuleUpdate(BaseModel):
    name: Optional[str] = None
    conditions: Optional[List[WorkflowCondition]] = None
    actions: Optional[List[WorkflowAction]] = None
    is_active: Optional[bool] = None


class WorkflowRuleResponse(BaseModel):
    id: str
    name: str
    trigger: str
    conditions: List[dict]
    actions: List[dict]
    is_active: bool
    run_count: int
    last_run_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowTestRequest(BaseModel):
    sample_data: dict


class WorkflowTestResponse(BaseModel):
    matched: bool
    would_run_actions: List[dict]
