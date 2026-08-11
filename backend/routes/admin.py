"""Owner Admin portal — platform-wide metrics and organization/user management.

Everything here is gated by require_master: only accounts with User.is_master may
call these routes. This is the one place plan restrictions are managed directly
(rather than through Stripe checkout), so the owner can flip any organization's
plan — including their own — to verify gating behaves correctly at every tier.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from database.session import get_db
from models.user import User, Organization, PlanType
from models.property import Property, Unit
from models.owner_message import OwnerMessage
from schemas.admin import (
    PlatformMetrics, OrganizationAdminResponse, OrganizationAdminUpdate,
    UserAdminResponse, UserAdminUpdate, OwnerMessageResponse, OwnerMessageReplyRequest,
    VerificationFileCreate, VerificationFileOut,
)
from middleware.plan_gate import require_master
from models.platform import OrgEventType, SiteVerificationFile
from services.platform_service import log_org_event
from services import platform_analytics_service as analytics
from services.communication_agent import send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_master)])

PLAN_PRICE = {"starter": 49, "professional": 149, "enterprise": 499}


@router.get("/metrics", response_model=PlatformMetrics)
async def platform_metrics(db: Session = Depends(get_db)):
    orgs = db.query(Organization).all()
    total_users = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    total_properties = db.query(func.count(Property.id)).scalar() or 0
    total_units = db.query(func.count(Unit.id)).scalar() or 0

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_this_month = sum(1 for o in orgs if o.created_at and o.created_at >= month_start)

    orgs_by_plan = {"starter": 0, "professional": 0, "enterprise": 0}
    estimated_mrr = 0.0
    ai_calls_total = 0
    for o in orgs:
        plan_key = o.plan.value if hasattr(o.plan, "value") else str(o.plan)
        orgs_by_plan[plan_key] = orgs_by_plan.get(plan_key, 0) + 1
        if o.is_active:  # revenue only reflects paying/active subscribers, not deactivated orgs
            estimated_mrr += PLAN_PRICE.get(plan_key, 0)
        ai_calls_total += o.ai_calls_this_period or 0

    return PlatformMetrics(
        total_organizations=len(orgs),
        active_organizations=sum(1 for o in orgs if o.is_active),
        total_users=total_users,
        active_users=active_users,
        total_properties=total_properties,
        total_units=total_units,
        new_organizations_this_month=new_this_month,
        ai_calls_this_period=ai_calls_total,
        orgs_by_plan=orgs_by_plan,
        estimated_mrr=estimated_mrr,
    )


@router.get("/organizations", response_model=List[OrganizationAdminResponse])
async def list_organizations(db: Session = Depends(get_db)):
    orgs = db.query(Organization).order_by(Organization.created_at.desc()).all()
    results = []
    for o in orgs:
        user_count = db.query(func.count(User.id)).filter(User.organization_id == o.id).scalar() or 0
        property_count = db.query(func.count(Property.id)).filter(Property.organization_id == o.id).scalar() or 0
        unit_count = db.query(func.count(Unit.id)).join(Property).filter(Property.organization_id == o.id).scalar() or 0
        has_master = db.query(User).filter(User.organization_id == o.id, User.is_master == True).first() is not None
        results.append(OrganizationAdminResponse(
            id=o.id, name=o.name, slug=o.slug, plan=o.plan.value, is_active=o.is_active,
            is_master_org=has_master, user_count=user_count, property_count=property_count,
            unit_count=unit_count, ai_calls_this_period=o.ai_calls_this_period or 0,
            created_at=o.created_at,
        ))
    return results


@router.patch("/organizations/{org_id}", response_model=OrganizationAdminResponse)
async def update_organization(
    org_id: UUID,
    payload: OrganizationAdminUpdate,
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if payload.plan is not None:
        old_plan = org.plan.value
        try:
            new_plan_enum = PlanType(payload.plan)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid plan: {payload.plan}")

        # This endpoint was originally "flip a plan flag to test gating" --
        # fine when an org has no real subscription. But if it DOES have a
        # real stripe_subscription_id, changing only our local plan field
        # would silently desync it from what Stripe actually charges --
        # exactly the drift bug this session spent hours tracking down and
        # fixing for a real customer. So: if there's a real subscription,
        # actually change IT (with proration), and only update our local
        # field once Stripe confirms it. If there's no real subscription
        # (test/manual org), just flip the flag as before.
        if org.stripe_subscription_id and old_plan != new_plan_enum.value:
            import stripe
            from config import settings
            stripe.api_key = settings.STRIPE_SECRET
            price_map = {
                "starter": settings.STRIPE_STARTER_PRICE_ID,
                "professional": settings.STRIPE_PRO_PRICE_ID,
                "enterprise": settings.STRIPE_ENTERPRISE_PRICE_ID,
            }
            new_price_id = price_map.get(new_plan_enum.value)
            if not new_price_id:
                raise HTTPException(status_code=422, detail=f"No Stripe price configured for plan: {new_plan_enum.value}")
            try:
                sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
                items_data = getattr(getattr(sub, "items", None), "data", None)
                if not items_data:
                    raise HTTPException(status_code=502, detail="Stripe subscription has no line items -- can't change its price.")
                item_id = getattr(items_data[0], "id", None)
                stripe.Subscription.modify(
                    org.stripe_subscription_id,
                    items=[{"id": item_id, "price": new_price_id}],
                    proration_behavior="create_prorations",
                )
                logger.info(f"Admin changed Stripe subscription {org.stripe_subscription_id} for org {org.id} from {old_plan} to {new_plan_enum.value}")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Failed to change Stripe subscription for org {org.id}: {type(e).__name__}: {e}")
                raise HTTPException(status_code=502, detail=f"Couldn't update the real Stripe subscription ({type(e).__name__}: {e}) -- plan was NOT changed, to avoid desyncing from what the customer is actually billed.")

        org.plan = new_plan_enum
        if old_plan != org.plan.value:
            log_org_event(db, org.id, OrgEventType.plan_changed, from_plan=old_plan, to_plan=org.plan.value)
    if payload.is_active is not None and payload.is_active != org.is_active:
        org.is_active = payload.is_active
        log_org_event(db, org.id, OrgEventType.activated if payload.is_active else OrgEventType.deactivated)

    db.commit()
    db.refresh(org)

    user_count = db.query(func.count(User.id)).filter(User.organization_id == org.id).scalar() or 0
    property_count = db.query(func.count(Property.id)).filter(Property.organization_id == org.id).scalar() or 0
    unit_count = db.query(func.count(Unit.id)).join(Property).filter(Property.organization_id == org.id).scalar() or 0
    has_master = db.query(User).filter(User.organization_id == org.id, User.is_master == True).first() is not None

    return OrganizationAdminResponse(
        id=org.id, name=org.name, slug=org.slug, plan=org.plan.value, is_active=org.is_active,
        is_master_org=has_master, user_count=user_count, property_count=property_count,
        unit_count=unit_count, ai_calls_this_period=org.ai_calls_this_period or 0,
        created_at=org.created_at,
    )


@router.get("/organizations/{org_id}/activity")
async def organization_activity(
    org_id: UUID,
    db: Session = Depends(get_db),
):
    """Real usage/engagement signals for one subscriber -- not just the
    static counts already on the list view, but whether they're actually
    using the product: who's logged in and when, what's happened to their
    billing over time, and how much real work has moved through the
    platform recently. Answers "is this subscriber actually using it,"
    which the plain org list can't."""
    from models.platform import OrganizationEvent
    from models.voice_call import VoiceCall
    from models.maintenance import MaintenanceTicket

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    users = db.query(User).filter(User.organization_id == org_id).order_by(User.last_login_at.desc().nullslast()).all()
    events = (
        db.query(OrganizationEvent)
        .filter(OrganizationEvent.organization_id == org_id)
        .order_by(OrganizationEvent.created_at.desc())
        .limit(30)
        .all()
    )
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    voice_calls_30d = db.query(func.count(VoiceCall.id)).filter(
        VoiceCall.organization_id == org_id, VoiceCall.started_at >= thirty_days_ago
    ).scalar() or 0
    tickets_30d = (
        db.query(func.count(MaintenanceTicket.id))
        .join(Property, MaintenanceTicket.property_id == Property.id)
        .filter(Property.organization_id == org_id, MaintenanceTicket.created_at >= thirty_days_ago)
        .scalar() or 0
    )

    return {
        "organization_id": str(org_id),
        "users": [
            {
                "id": str(u.id), "email": u.email, "full_name": u.full_name,
                "role": u.role.value, "is_active": u.is_active,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "events": [
            {
                "type": e.event_type.value, "from_plan": e.from_plan, "to_plan": e.to_plan,
                "subscription_status": e.subscription_status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
        "voice_calls_last_30d": voice_calls_30d,
        "maintenance_tickets_last_30d": tickets_30d,
    }


@router.post("/organizations/{org_id}/cancel-subscription")
async def admin_cancel_subscription(
    org_id: UUID,
    db: Session = Depends(get_db),
):
    """Cancels a subscriber's real Stripe subscription at the end of their
    current period (same behavior as a customer using the self-service
    Billing Portal themselves) -- for handling a cancellation request
    directly rather than making the owner ask the customer to do it via
    /billing/portal. No effect on an org with no real subscription."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not org.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="This organization has no active Stripe subscription to cancel.")

    import stripe
    from config import settings
    stripe.api_key = settings.STRIPE_SECRET
    try:
        sub = await run_in_threadpool(stripe.Subscription.modify, org.stripe_subscription_id, cancel_at_period_end=True)
        status = getattr(sub, "status", None)
        cancel_at = getattr(sub, "cancel_at", None) or getattr(sub, "current_period_end", None)
    except Exception as e:
        logger.error(f"Failed to cancel Stripe subscription for org {org.id}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Couldn't cancel the Stripe subscription ({type(e).__name__}: {e})")

    logger.warning(f"Admin scheduled cancellation of subscription {org.stripe_subscription_id} for org {org.id}")
    return {"status": status, "cancel_at": cancel_at}


@router.post("/organizations/{org_id}/wipe-data")
async def wipe_organization_data_endpoint(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    """Delete all operational data (properties, tenants, leases,
    maintenance, inquiries, voice calls, etc.) for an organization while
    keeping the organization and its login accounts intact -- for
    clearing test data out of an org you're keeping, including your own."""
    from services.org_wipe_service import wipe_organization_data

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        counts = wipe_organization_data(db, org_id)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to wipe data for org {org_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Wipe failed and was rolled back: {e}")

    return {"organization_id": str(org_id), "deleted": counts}


@router.delete("/organizations/{org_id}")
async def delete_organization_endpoint(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    """Permanently delete an organization: all its data, its login
    accounts, and the organization itself. Irreversible. Cannot be used
    on your own organization -- use wipe-data on yourself instead."""
    from services.org_wipe_service import delete_organization

    if org_id == current_user.organization_id:
        raise HTTPException(status_code=422, detail="You can't delete your own organization. Use wipe-data instead.")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        counts = delete_organization(db, org_id)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete org {org_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed and was rolled back: {e}")

    return {"organization_id": str(org_id), "deleted": counts}


@router.post("/demo-org/seed")
async def seed_demo_org_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    """Create (or wipe + refresh) a dedicated 'PropAgent Demo' organization
    with realistic data across every feature area, for sales/marketing
    demos -- entirely separate from any real subscriber's data. Returns
    a fresh login (the password is only ever returned here, never stored
    in plaintext or logged)."""
    from services.demo_seed_service import seed_demo_organization

    try:
        result = seed_demo_organization(db)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed demo org: {e}")
        raise HTTPException(status_code=500, detail=f"Seeding failed and was rolled back: {e}")

    return result


@router.post("/demo-org/rotate-password")
async def rotate_demo_password_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    """Generate a fresh random email AND password for the demo login
    without touching any of its seeded data -- for handing a wholly clean
    credential to a new prospect (or invalidating one a previous prospect
    had) without resetting the whole demo account. Use /demo-org/seed
    instead when you also want the data itself refreshed."""
    from services.demo_seed_service import rotate_demo_credentials

    result = rotate_demo_credentials(db)
    if result is None:
        raise HTTPException(status_code=404, detail="Demo account doesn't exist yet -- run /demo-org/seed first.")
    db.commit()

    return result


@router.get("/organizations/{org_id}/billing-debug")
async def billing_debug(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    """Diagnostic: the raw Stripe-linkage fields on an org, not exposed
    anywhere else -- for tracing exactly where a checkout -> webhook ->
    plan-upgrade chain broke for a specific organization."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    result = {
        "organization_id": str(org.id),
        "name": org.name,
        "plan": org.plan.value,
        "is_active": org.is_active,
        "stripe_customer_id": org.stripe_customer_id,
        "stripe_subscription_id": org.stripe_subscription_id,
        "subscription_status": org.subscription_status,
        "trial_used": org.trial_used,
        "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
    }

    # If we have a subscription ID, check what Stripe itself actually has
    # on file for it -- confirms whether Stripe's side succeeded even if
    # our webhook never processed it.
    if org.stripe_subscription_id:
        try:
            import stripe
            from config import settings
            stripe.api_key = settings.STRIPE_SECRET
            # stripe-python 15.x's StripeObject/ListObject dropped dict-style
            # .get() -- only attribute access (or bracket access, which
            # still works) is supported. .get() here silently produced
            # "stripe_lookup_error": "get" and masked the real data, which
            # is why this diagnostic looked empty even when it shouldn't
            # have been. Use getattr(...) throughout instead.
            sub = await run_in_threadpool(stripe.Subscription.retrieve, org.stripe_subscription_id)
            result["stripe_actual_status"] = getattr(sub, "status", None)
            result["stripe_cancel_at_period_end"] = getattr(sub, "cancel_at_period_end", None)
            result["stripe_cancel_at"] = getattr(sub, "cancel_at", None)
            result["stripe_canceled_at"] = getattr(sub, "canceled_at", None)
            result["stripe_current_period_end"] = getattr(sub, "current_period_end", None)
            result["stripe_trial_end"] = getattr(sub, "trial_end", None)
            items_data = getattr(getattr(sub, "items", None), "data", None)
            result["stripe_actual_plan_nickname"] = (
                getattr(getattr(items_data[0], "price", None), "nickname", None) if items_data else None
            )
        except Exception as e:
            result["stripe_lookup_error"] = f"{type(e).__name__}: {e}"
    elif org.stripe_customer_id:
        try:
            import stripe
            from config import settings
            stripe.api_key = settings.STRIPE_SECRET
            subs = await run_in_threadpool(stripe.Subscription.list, customer=org.stripe_customer_id, limit=5)
            result["stripe_customer_subscriptions"] = [
                {
                    "id": getattr(s, "id", None),
                    "status": getattr(s, "status", None),
                    "created": getattr(s, "created", None),
                }
                for s in subs.data
            ]
        except Exception as e:
            result["stripe_lookup_error"] = f"{type(e).__name__}: {e}"

    return result


@router.get("/stripe-recent-sessions")
async def stripe_recent_sessions(
    current_user: User = Depends(require_master),
):
    """Diagnostic: the last 10 Stripe Checkout sessions, straight from
    Stripe's own API -- to see whether a completed payment actually
    happened on Stripe's side (and with what metadata) even when nothing
    shows up on our own org record, which tells us whether the problem is
    "webhook never delivered" vs "webhook delivered with bad/missing
    metadata" vs "payment never actually completed."""
    import stripe
    from config import settings
    stripe.api_key = settings.STRIPE_SECRET

    # Everything -- the API call AND the response-serialization below --
    # lives inside this try/except now. The earlier version only wrapped
    # the Session.list() call, so any field-access issue while building
    # the response list produced a bare, unlogged 500 with no detail.
    try:
        sessions = await run_in_threadpool(stripe.checkout.Session.list, limit=10)
        result = []
        # stripe-python 15.x's StripeObject/ListObject dropped dict-style
        # .get() -- only real attribute access works now. This was the
        # actual bug (confirmed by reproducing it locally): .get() on a
        # Session or its .metadata raises AttributeError('get'), which is
        # exactly the bare "Stripe lookup failed: get" this endpoint was
        # returning in production.
        for s in sessions.data:
            # dict(stripe_object) is ALSO broken in stripe-python 15.x
            # (raises KeyError: 0 -- confirmed by reproducing it locally,
            # right after this exact line broke the same way in production).
            # .to_dict() is the only reliable full conversion.
            sd = s.to_dict()
            result.append({
                "id": sd.get("id"),
                "created": sd.get("created"),
                "payment_status": sd.get("payment_status"),
                "status": sd.get("status"),
                "customer": sd.get("customer"),
                "subscription": sd.get("subscription"),
                "metadata": sd.get("metadata") or {},
            })
        return {"sessions": result}
    except Exception as e:
        logger.error(f"stripe-recent-sessions failed: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Stripe lookup failed ({type(e).__name__}): {e}")


@router.post("/finance-reconcile")
async def finance_reconcile_manual(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    """On-demand version of the /internal/cron/finance-reconcile job -- same
    deterministic Stripe-vs-DB drift check and self-heal, runnable right now
    from the Owner Admin portal instead of waiting for the next scheduled
    run. Returns the result inline (no email) so it doubles as a way to
    verify a fix actually worked immediately after making one."""
    from services.finance_reconciliation_service import reconcile_stripe_sessions
    from fastapi.concurrency import run_in_threadpool
    result = await run_in_threadpool(reconcile_stripe_sessions, db)
    return result


@router.get("/users", response_model=List[UserAdminResponse])
async def list_users(db: Session = Depends(get_db)):
    # joinedload -- without it, u.organization.name below lazy-loads a
    # separate query PER USER (N+1). Real report: "admin tab loads very
    # slowly."
    users = db.query(User).options(joinedload(User.organization)).order_by(User.created_at.desc()).all()
    return [
        UserAdminResponse(
            id=u.id, email=u.email, full_name=u.full_name, role=u.role.value,
            is_master=u.is_master, is_active=u.is_active,
            organization_id=u.organization_id,
            organization_name=u.organization.name if u.organization else None,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: UUID,
    payload: UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(status_code=422, detail="You can't deactivate your own account.")

    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)
    return UserAdminResponse(
        id=user.id, email=user.email, full_name=user.full_name, role=user.role.value,
        is_master=user.is_master, is_active=user.is_active,
        organization_id=user.organization_id,
        organization_name=user.organization.name if user.organization else None,
        created_at=user.created_at,
    )


@router.post("/users/{user_id}/mfa-disable")
async def admin_disable_mfa(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    """Last-resort MFA recovery: turns off MFA on a user's account entirely
    (clears the TOTP secret and any backup codes) so they can log back in
    with just their password, then re-enroll fresh. Only exists for the
    case where someone's authenticator app AND all 10 backup codes are
    unusable/lost -- the backup codes generated at /auth/mfa/verify should
    cover almost every real case before this is ever needed."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled on this account.")

    user.mfa_enabled = False
    user.mfa_secret = None
    user.mfa_backup_codes = None
    db.commit()
    logger.warning(f"Admin {current_user.email} disabled MFA on user {user.email} ({user.id}) via recovery endpoint.")
    return {"mfa_enabled": False, "email": user.email}


@router.get("/messages", response_model=List[OwnerMessageResponse])
async def list_owner_messages(db: Session = Depends(get_db)):
    """Complaints, advice, and notes routed here from the AI chat assistant and the Contact Us page."""
    messages = db.query(OwnerMessage).order_by(OwnerMessage.created_at.desc()).limit(200).all()
    return [
        OwnerMessageResponse(
            id=m.id, source=m.source.value, organization_id=m.organization_id,
            organization_name=m.organization_name, sender_name=m.sender_name,
            sender_email=m.sender_email, subject=m.subject, body=m.body,
            email_status=m.email_status, email_error=m.email_error, created_at=m.created_at,
            reply_body=m.reply_body, reply_status=m.reply_status, reply_error=m.reply_error, replied_at=m.replied_at,
        )
        for m in messages
    ]


@router.post("/messages/{message_id}/reply", response_model=OwnerMessageResponse)
async def reply_to_owner_message(message_id: UUID, payload: OwnerMessageReplyRequest, db: Session = Depends(get_db)):
    """Send a real email reply (via the same SMTP path as everything else) back to
    whoever sent this message, and record it on the message so the owner can see
    what was already said."""
    message = db.query(OwnerMessage).filter(OwnerMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if not message.sender_email:
        raise HTTPException(status_code=422, detail="This message has no sender email on file to reply to.")

    status, error = await run_in_threadpool(send_email, message.sender_email, f"Re: {message.subject}", payload.reply)
    message.reply_body = payload.reply
    message.reply_status = status
    message.reply_error = error
    message.replied_at = datetime.utcnow()
    db.commit()
    db.refresh(message)

    return OwnerMessageResponse(
        id=message.id, source=message.source.value, organization_id=message.organization_id,
        organization_name=message.organization_name, sender_name=message.sender_name,
        sender_email=message.sender_email, subject=message.subject, body=message.body,
        email_status=message.email_status, email_error=message.email_error, created_at=message.created_at,
        reply_body=message.reply_body, reply_status=message.reply_status, reply_error=message.reply_error, replied_at=message.replied_at,
    )


@router.delete("/messages/{message_id}", status_code=204)
async def delete_owner_message(message_id: UUID, db: Session = Depends(get_db)):
    message = db.query(OwnerMessage).filter(OwnerMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    db.delete(message)
    db.commit()


# ============================================================
# Business dashboard — Subscriber Management, Revenue, Marketing,
# Platform & AI Ops, Business Analytics
# ============================================================

@router.get("/subscribers")
async def subscribers(
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return {"subscribers": analytics.list_subscribers(db, search=search, status_filter=status)}


@router.get("/revenue")
async def revenue(db: Session = Depends(get_db)):
    return analytics.revenue_summary(db)


@router.get("/revenue/invoices/{org_id}")
async def revenue_invoices(org_id: UUID, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return analytics.stripe_invoices_for_org(org)


@router.get("/growth")
async def growth(db: Session = Depends(get_db)):
    return {
        "signup_trend": analytics.signup_trend(db),
        "conversion_funnel": analytics.conversion_funnel(db),
        "referral_leaderboard": analytics.referral_leaderboard(db),
    }


@router.get("/platform-health")
async def platform_health_route(db: Session = Depends(get_db)):
    return {
        "health": await analytics.platform_health(db),
        "ai_calls": analytics.ai_call_trend(db),
        "recent_errors": analytics.recent_errors(db),
    }


@router.get("/business-analytics")
async def business_analytics(db: Session = Depends(get_db)):
    return {
        "signup_trend": analytics.signup_trend(db),
        "retention": analytics.retention_rate(db),
        "feature_adoption": analytics.feature_adoption(db),
        "orgs_by_plan": {
            plan.value: db.query(Organization).filter(Organization.plan == plan, Organization.is_active == True).count()
            for plan in PlanType
        },
    }


# ── Site verification files (Google Search Console, Bing Webmaster, Facebook
# Domain Verification, etc.) — self-service so a future one never needs a
# code deploy. Served publicly (no auth) from routes/verification.py. ──

@router.get("/verification-files", response_model=List[VerificationFileOut])
async def list_verification_files(db: Session = Depends(get_db)):
    return db.query(SiteVerificationFile).order_by(SiteVerificationFile.created_at.desc()).all()


@router.post("/verification-files", response_model=VerificationFileOut, status_code=201)
async def create_verification_file(payload: VerificationFileCreate, db: Session = Depends(get_db)):
    filename = payload.filename.strip().lstrip("/")
    if not filename or "/" in filename or ".." in filename:
        raise HTTPException(status_code=422, detail="Filename must be a single file name, no slashes.")
    if db.query(SiteVerificationFile).filter(SiteVerificationFile.filename == filename).first():
        raise HTTPException(status_code=400, detail="A verification file with that name already exists.")

    record = SiteVerificationFile(filename=filename, content=payload.content)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/verification-files/{file_id}", status_code=204)
async def delete_verification_file(file_id: UUID, db: Session = Depends(get_db)):
    record = db.query(SiteVerificationFile).filter(SiteVerificationFile.id == file_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(record)
    db.commit()
