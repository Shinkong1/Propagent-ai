"""Collections Agent — automates delinquency escalation.

Workflow (configurable per organization, defaults from the spec):
  day 3  -> friendly reminder
  day 5  -> late fee assessment
  day 10 -> payment plan offer
  day 15 -> manager notification
  day 30 -> legal workflow preparation

Every recommendation is rule-based (not a trained model) and carries an
explanation of which threshold triggered it.
"""
from datetime import date
from sqlalchemy.orm import Session

from models.accounting import RentPayment, PaymentStatus
from models.tenant import Lease
from models.property import Unit, Property
from models.user import Organization
from models.collections import CollectionsAction, CollectionsActionType, STAGE_ORDER

OVERDUE_STATUSES = [PaymentStatus.pending, PaymentStatus.late, PaymentStatus.partial, PaymentStatus.missed]


def _stage_rank(action_type: CollectionsActionType) -> int:
    return STAGE_ORDER.index(action_type)


def _target_stage(org: Organization, days_overdue: int):
    if days_overdue >= org.collections_day_legal_prep:
        return CollectionsActionType.legal_prep
    if days_overdue >= org.collections_day_manager_notify:
        return CollectionsActionType.manager_notification
    if days_overdue >= org.collections_day_payment_plan:
        return CollectionsActionType.payment_plan_offer
    if days_overdue >= org.collections_day_late_fee:
        return CollectionsActionType.late_fee
    if days_overdue >= org.collections_day_reminder:
        return CollectionsActionType.reminder
    return None


def _threshold_days(org: Organization, stage: CollectionsActionType) -> int:
    return {
        CollectionsActionType.reminder: org.collections_day_reminder,
        CollectionsActionType.late_fee: org.collections_day_late_fee,
        CollectionsActionType.payment_plan_offer: org.collections_day_payment_plan,
        CollectionsActionType.manager_notification: org.collections_day_manager_notify,
        CollectionsActionType.legal_prep: org.collections_day_legal_prep,
    }[stage]


def compute_collections_queue(db: Session, org: Organization, property_id=None) -> list:
    today = date.today()

    query = db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).join(Property).filter(
        Property.organization_id == org.id,
        RentPayment.status.in_(OVERDUE_STATUSES),
        RentPayment.due_date < today,
    )
    if property_id:
        query = query.filter(Unit.property_id == property_id)

    payments = query.all()
    results = []

    for payment in payments:
        days_overdue = (today - payment.due_date).days
        target = _target_stage(org, days_overdue)
        if target is None:
            continue

        actions = payment.collections_actions
        reached_ranks = [_stage_rank(a.action_type) for a in actions]
        highest_reached = max(reached_ranks) if reached_ranks else -1
        target_rank = _stage_rank(target)

        recommended_action = target.value if target_rank > highest_reached else None
        current_stage = STAGE_ORDER[highest_reached].value if highest_reached >= 0 else None

        suggested_late_fee = None
        if target == CollectionsActionType.late_fee:
            suggested_late_fee = round(payment.amount * org.collections_late_fee_percent / 100, 2)

        explanation = None
        if recommended_action:
            threshold = _threshold_days(org, target)
            explanation = f"{days_overdue} days overdue meets or exceeds the {threshold}-day threshold for {target.value.replace('_', ' ')}."

        results.append({
            "id": str(payment.id),
            "lease_id": str(payment.lease_id),
            "tenant_name": payment.tenant_name,
            "property_name": payment.property_name,
            "unit_number": payment.unit_number,
            "amount": payment.amount,
            "due_date": str(payment.due_date),
            "status": payment.status.value,
            "days_overdue": days_overdue,
            "current_stage": current_stage,
            "recommended_action": recommended_action,
            "suggested_late_fee": suggested_late_fee,
            "explanation": explanation,
            "confidence": 1.0,
        })

    results.sort(key=lambda r: r["days_overdue"], reverse=True)
    return results


def collections_summary(queue: list) -> dict:
    counts = {"reminder": 0, "late_fee": 0, "payment_plan_offer": 0, "manager_notification": 0, "legal_prep": 0}
    needs_action = 0
    total_overdue = 0.0
    for item in queue:
        total_overdue += item["amount"]
        if item["recommended_action"]:
            needs_action += 1
            counts[item["recommended_action"]] += 1
    return {
        "total_delinquent": len(queue),
        "needs_action": needs_action,
        "total_overdue_amount": round(total_overdue, 2),
        "by_recommended_action": counts,
    }
