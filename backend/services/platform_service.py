"""Helpers for logging real organization lifecycle events and generating
referral codes — the honest data backbone for platform analytics."""
import secrets
from sqlalchemy.orm import Session

from models.platform import OrganizationEvent, OrgEventType


def generate_referral_code() -> str:
    return secrets.token_hex(4).upper()


def log_org_event(
    db: Session,
    organization_id,
    event_type: OrgEventType,
    from_plan: str = None,
    to_plan: str = None,
    subscription_status: str = None,
) -> None:
    db.add(OrganizationEvent(
        organization_id=organization_id,
        event_type=event_type,
        from_plan=from_plan,
        to_plan=to_plan,
        subscription_status=subscription_status,
    ))
    db.commit()
