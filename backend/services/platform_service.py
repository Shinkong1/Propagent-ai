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


def grant_referral_reward_if_eligible(db: Session, org) -> bool:
    """Referral reward program. Call this whenever `org`'s plan has just
    been set to a real paid plan (checkout completed, or finance
    reconciliation self-healing a missed webhook) -- i.e. its trial just
    converted to a paying subscription.

    Reward mechanism chosen: a simple credit counter
    (Organization.referral_credits_earned) on the REFERRING org, one credit
    per converted referral, surfaced in the dashboard for the owner to see
    and apply real-world (a free month via the Stripe billing portal, a
    manual coupon, etc.) -- NOT an automatic Stripe coupon/invoice credit.
    This was a deliberate choice over wiring a real Stripe credit directly:
    this session already hit (and fixed) a real production incident caused
    by stripe-python 15.x's dict-style .get()/dict() removal silently
    breaking billing webhooks, so adding a brand-new money-touching Stripe
    call (Coupon/PromotionCode + attaching it to a specific customer's next
    invoice) in the same session is exactly the kind of "complex/risky to
    get right confidently" surface the task calls out. Tracking a plain
    integer is deterministic, trivially testable, and never silently fails
    in a way that shortchanges a customer or double-charges anyone.

    Idempotent: `org.referral_reward_granted` (on the REFERRED org, i.e.
    `org` itself) is checked and flipped in the same call, so this can be
    called repeatedly (webhook retries, reconciliation re-runs) for the
    same org without ever granting more than one credit to its referrer.
    """
    if not org or not getattr(org, "referred_by_org_id", None):
        return False
    if getattr(org, "referral_reward_granted", False):
        return False

    from models.user import Organization
    referrer = db.query(Organization).filter(Organization.id == org.referred_by_org_id).first()
    if not referrer:
        return False

    referrer.referral_credits_earned = (referrer.referral_credits_earned or 0) + 1
    org.referral_reward_granted = True
    db.commit()

    log_org_event(
        db, referrer.id, OrgEventType.referral_reward_granted,
        to_plan=org.plan.value if getattr(org, "plan", None) else None,
    )
    return True
