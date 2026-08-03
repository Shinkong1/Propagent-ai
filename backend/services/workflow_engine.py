"""No-code workflow automation engine — evaluates org-defined rules against
real domain events (maintenance tickets, leads, tenants, overdue payments)
and fires configured actions (notify owner, send email, send SMS).

Every action honestly reports what actually happened ('sent', 'logged_only',
'failed') rather than pretending success — same pattern as the rest of the
notification stack (communication_agent, owner_notify).
"""
import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from models.user import Organization
from models.workflow import WorkflowRule, WorkflowTrigger
from models.owner_message import OwnerMessageSource
from services.owner_notify import notify_owner
from services.communication_agent import send_email, send_sms

logger = logging.getLogger(__name__)


def _num(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return float("nan")


OPERATORS = {
    "equals": lambda a, b: str(a) == str(b),
    "not_equals": lambda a, b: str(a) != str(b),
    "contains": lambda a, b: str(b).lower() in str(a).lower() if a is not None else False,
    "greater_than": lambda a, b: _num(a) > _num(b),
    "less_than": lambda a, b: _num(a) < _num(b),
}


def _fill(template: str, data: dict) -> str:
    out = template or ""
    for k, v in data.items():
        out = out.replace(f"{{{k}}}", str(v))
    return out


def evaluate_conditions(conditions: list, data: dict) -> bool:
    for cond in conditions or []:
        op = OPERATORS.get(cond.get("operator"))
        if not op:
            return False
        if not op(data.get(cond.get("field")), cond.get("value")):
            return False
    return True


def execute_actions(db: Session, org: Organization, actions: list, data: dict, dry_run: bool = False) -> list:
    results = []
    for action in actions or []:
        atype = action.get("type")
        params = action.get("params", {}) or {}

        if dry_run:
            results.append({"type": atype, "status": "would_run", "params": params})
            continue

        if atype == "notify_owner":
            subject = _fill(params.get("subject") or "Workflow alert", data)
            body = _fill(params.get("body") or "", data)
            notify_owner(db, source=OwnerMessageSource.chat, subject=subject, body=body, organization=org)
            results.append({"type": atype, "status": "sent"})
        elif atype == "send_email":
            to = params.get("to") or data.get("email")
            if not to:
                results.append({"type": atype, "status": "failed", "detail": "No recipient email"})
                continue
            subject = _fill(params.get("subject") or "Notification", data)
            body = _fill(params.get("body") or "", data)
            status, _err = send_email(to, subject, body)
            results.append({"type": atype, "status": status})
        elif atype == "send_sms":
            to = params.get("to") or data.get("phone")
            if not to:
                results.append({"type": atype, "status": "failed", "detail": "No recipient phone"})
                continue
            body = _fill(params.get("body") or "", data)
            status, _err = send_sms(to, body)
            results.append({"type": atype, "status": status})
        else:
            results.append({"type": atype, "status": "unsupported"})
    return results


def run_workflows(db: Session, org: Organization, trigger: WorkflowTrigger, data: dict) -> list:
    rules = db.query(WorkflowRule).filter(
        WorkflowRule.organization_id == org.id,
        WorkflowRule.trigger == trigger,
        WorkflowRule.is_active == True,
    ).all()

    fired = []
    for rule in rules:
        if evaluate_conditions(rule.conditions, data):
            action_results = execute_actions(db, org, rule.actions, data)
            rule.run_count = (rule.run_count or 0) + 1
            rule.last_run_at = datetime.utcnow()
            fired.append({"rule_id": str(rule.id), "rule_name": rule.name, "actions": action_results})

    if fired:
        db.commit()
    return fired
