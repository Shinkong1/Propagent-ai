"""Stripe billing routes"""
import logging
from typing import Optional
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType, UserRole
from middleware.auth import get_current_user
from middleware.plan_gate import require_role
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])
stripe.api_key = settings.STRIPE_SECRET

PLAN_PRICES = {
    "starter": settings.STRIPE_STARTER_PRICE_ID,
    "professional": settings.STRIPE_PRO_PRICE_ID,
    "enterprise": settings.STRIPE_ENTERPRISE_PRICE_ID,
}

PLAN_LIMITS = {
    "starter": {"properties": 3, "units": 25, "ai_calls": 100},
    "professional": {"properties": 15, "units": 150, "ai_calls": 1000},
    "enterprise": {"properties": -1, "units": -1, "ai_calls": -1},
}


@router.post("/checkout")
async def create_checkout(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    plan = payload.get("plan", "starter")
    price_id = PLAN_PRICES.get(plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid plan")

    from models.user import Organization
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    grant_trial = bool(org and not org.trial_used)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/dashboard?upgraded={plan}",
            cancel_url=f"{settings.FRONTEND_URL}/pricing",
            metadata={"org_id": str(current_user.organization_id), "plan": plan},
            managed_payments={"enabled": False},
            **({"subscription_data": {"trial_period_days": 14}} if grant_trial else {}),
        )
        if grant_trial:
            org.trial_used = True
            db.commit()
        return {"url": session.url}
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Payment processing error")


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        # ROOT CAUSE of the "paid but never upgraded" bug: stripe-python 15.x's
        # Event/StripeObject dropped dict-style .get() -- only real attribute
        # access (or bracket access) works now. Every branch below calls
        # .get() on nested Stripe objects (session_data["metadata"].get(...),
        # sub.get("id"), etc.), which raised AttributeError('get') on EVERY
        # checkout.session.completed event, before the org's plan/subscription
        # fields were ever written. Stripe saw that as a failed delivery and
        # retried a few times, then gave up -- so on our side nothing ever
        # updated. .to_dict() recursively converts the whole event (and every
        # nested Stripe object inside it) to plain dicts, so the .get() calls
        # below work exactly as originally written, with no further changes.
        event = event.to_dict()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    from models.user import Organization
    from models.platform import OrgEventType
    from services.platform_service import log_org_event
    from uuid import UUID

    if event["type"] == "checkout.session.completed":
        session_data = event["data"]["object"]
        org_id = session_data["metadata"].get("org_id")
        plan = session_data["metadata"].get("plan", "starter")

        org = db.query(Organization).filter(Organization.id == UUID(org_id)).first()
        if org:
            old_plan = org.plan.value
            org.plan = PlanType[plan]
            org.stripe_subscription_id = session_data.get("subscription")
            db.commit()
            if old_plan != plan:
                log_org_event(db, org.id, OrgEventType.plan_changed, from_plan=old_plan, to_plan=plan)
            logger.info(f"Org {org_id} upgraded to {plan}")

    elif event["type"] in ("customer.subscription.created", "customer.subscription.updated"):
        sub = event["data"]["object"]
        org = db.query(Organization).filter(Organization.stripe_subscription_id == sub.get("id")).first()
        if org:
            org.subscription_status = sub.get("status")
            db.commit()
            event_type = OrgEventType.subscription_created if event["type"].endswith("created") else OrgEventType.subscription_updated
            log_org_event(db, org.id, event_type, subscription_status=sub.get("status"))

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        org = db.query(Organization).filter(Organization.stripe_subscription_id == sub.get("id")).first()
        if org:
            org.subscription_status = "canceled"
            db.commit()
            log_org_event(db, org.id, OrgEventType.subscription_canceled, subscription_status="canceled")

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        org = db.query(Organization).filter(Organization.stripe_customer_id == invoice.get("customer")).first()
        if org:
            log_org_event(db, org.id, OrgEventType.payment_failed)

    return {"status": "ok"}


@router.post("/connect/onboard")
async def connect_onboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    """Start (or resume) Stripe Connect Express onboarding for this org, so
    its tenants can pay rent directly into the org's own bank account —
    never a PropAgent-controlled one. Returns a one-time onboarding URL."""
    from models.user import Organization
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        if not org.stripe_connect_account_id:
            account = stripe.Account.create(
                type="express",
                email=current_user.email,
                capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}},
                business_profile={"name": org.name},
            )
            org.stripe_connect_account_id = account.id
            db.commit()

        account_link = stripe.AccountLink.create(
            account=org.stripe_connect_account_id,
            refresh_url=f"{settings.FRONTEND_URL}/dashboard/settings?connect=refresh",
            return_url=f"{settings.FRONTEND_URL}/dashboard/settings?connect=return",
            type="account_onboarding",
        )
        return {"url": account_link.url}
    except Exception as e:
        logger.error(f"Stripe Connect onboarding error for org {org.id}: {e}")
        raise HTTPException(status_code=502, detail="Couldn't start Stripe onboarding — please try again in a moment.")


@router.get("/connect/status")
async def connect_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Self-healing: if we haven't marked this org onboarded yet, check
    Stripe's current live state directly rather than only ever waiting on
    a webhook — covers the (real, observed) case where the relevant event
    fired before the webhook destination was configured to catch it, so it
    was never going to be delivered no matter how long we waited."""
    from models.user import Organization
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if org.stripe_connect_account_id and not org.stripe_connect_onboarded:
        try:
            import requests
            resp = await run_in_threadpool(
                requests.get,
                f"https://api.stripe.com/v2/core/accounts/{org.stripe_connect_account_id}",
                params={"include": ["configuration.merchant", "configuration.recipient"]},
                headers={
                    "Authorization": f"Bearer {settings.STRIPE_SECRET}",
                    # v2 endpoints require this explicitly — v1 infers it from
                    # the account's default version, v2 does not.
                    "Stripe-Version": "2026-07-29.dahlia",
                },
                timeout=10,
            )
            if resp.ok:
                if _has_active_capability(resp.json()):
                    org.stripe_connect_onboarded = True
                    db.commit()
                    logger.info(f"Org {org.id} Stripe Connect onboarded=True (live status check)")
            else:
                logger.warning(f"Live Connect status check for org {org.id} got HTTP {resp.status_code}: {resp.text[:300]}")
        except Exception as e:
            logger.warning(f"Live Connect status check failed for org {org.id}: {e}")

    return {
        "connected": bool(org.stripe_connect_account_id),
        "onboarded": org.stripe_connect_onboarded,
    }


@router.post("/webhook/connect")
async def stripe_connect_webhook(request: Request, db: Session = Depends(get_db)):
    """Separate endpoint/signing secret from /billing/webhook above — this
    one only ever describes events on *connected* accounts (a tenant's rent
    payment, an org finishing onboarding), never PropAgent's own billing.

    Stripe creates one destination per payload style (snapshot vs thin) even
    when both point at this same URL, and each has its own signing secret —
    so try both rather than assume only one is in play."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    logger.info(f"Connect webhook received: {len(payload)} bytes, sig header present={bool(sig_header)}")

    event = None
    errors = []
    for label, secret in (("v1", settings.STRIPE_CONNECT_WEBHOOK_SECRET), ("v2", settings.STRIPE_CONNECT_WEBHOOK_SECRET_V2)):
        if not secret:
            errors.append(f"{label} secret not configured")
            continue
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, secret)
            logger.info(f"Connect webhook verified against {label} secret")
            break
        except Exception as e:
            errors.append(f"{label} secret: {e}")
    if event is None:
        logger.warning(f"Connect webhook signature verification failed against all configured secrets: {errors}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # Same fix as /billing/webhook above: stripe-python 15.x's Event/
    # StripeObject dropped dict-style .get(), which every helper below
    # (_extract_account_id, _has_active_capability, _handle_account_updated)
    # relies on. .to_dict() makes the whole nested payload plain dicts so
    # those .get() calls behave as originally written.
    event = event.to_dict()

    logger.info(f"Connect webhook event type={event['type']}")

    # Stripe's v2 Core Accounts API doesn't fire a single generic "updated"
    # event — it fires granular ones per configuration/capability instead,
    # e.g. v2.core.account[configuration.merchant].capability_status_updated
    # (charges-equivalent) and .../recipient/... (payouts-equivalent). Treat
    # any of them as "go re-check this account's status" rather than trying
    # to enumerate every possible sub-event Stripe might ever add.
    if event["type"] == "account.updated" or event["type"].startswith("v2.core.account[") or event["type"] == "v2.core.account.updated":
        await run_in_threadpool(_handle_account_updated, db, event)

    elif event["type"] in ("checkout.session.completed", "payment_intent.succeeded"):
        await run_in_threadpool(_handle_rent_payment_succeeded, db, event["data"]["object"])


def _extract_account_id(event: dict) -> Optional[str]:
    """Account update events come in two shapes depending on whether Stripe
    delivered the classic v1 'account.updated' or the newer 'v2.core.
    account.updated' — rather than assume either payload's exact nesting,
    just find the account id wherever it is and re-fetch fresh from the API
    below, which is correct regardless of what shape the payload turns out
    to be."""
    data = event.get("data") or {}
    obj = data.get("object") if isinstance(data, dict) else None
    for candidate in (
        (obj or {}).get("id") if isinstance(obj, dict) else None,
        data.get("id") if isinstance(data, dict) else None,
        (event.get("related_object") or {}).get("id"),
    ):
        if candidate and str(candidate).startswith("acct_"):
            return candidate
    return None


def _has_active_capability(node) -> bool:
    """v2 Core Accounts nest capability status arbitrarily deep under
    configuration.merchant/recipient.capabilities.<name>.status, and which
    branch a given event touches varies per event. Rather than hard-code
    that path, recursively scan whatever the event gives us for any
    {"status": "active"} — good enough signal that at least one relevant
    capability just turned on."""
    if isinstance(node, dict):
        if node.get("status") == "active" and "status_details" in node:
            return True
        return any(_has_active_capability(v) for v in node.values())
    if isinstance(node, list):
        return any(_has_active_capability(v) for v in node)
    return False


def _handle_account_updated(db: Session, event: dict):
    from models.user import Organization

    account_id = _extract_account_id(event)
    if not account_id:
        logger.warning(f"Couldn't find an account id on a {event.get('type')} event — skipping")
        return

    org = db.query(Organization).filter(Organization.stripe_connect_account_id == account_id).first()
    if not org:
        return

    # Once onboarded, stay onboarded from this handler's perspective — a
    # single event only ever tells us about *one* capability changing, so
    # its absence of evidence must never flip an already-onboarded org back
    # to false. Two independent ways to detect the positive transition,
    # since it's unclear whether v1's Account.retrieve returns meaningful
    # charges_enabled/payouts_enabled for an account actually managed
    # through the newer v2 configuration model:
    # 1) a capability visibly went "active" in this event's own before/after diff
    # 2) the classic v1 re-fetch says so
    newly_onboarded = org.stripe_connect_onboarded or _has_active_capability(event.get("data", {}).get("changes", {}))

    try:
        account = stripe.Account.retrieve(account_id).to_dict()
        newly_onboarded = newly_onboarded or bool(account.get("charges_enabled") and account.get("payouts_enabled"))
    except Exception as e:
        logger.warning(f"Couldn't re-fetch Stripe account {account_id} after {event.get('type')}: {e} (continuing with event-embedded signal only)")

    if newly_onboarded != org.stripe_connect_onboarded:
        org.stripe_connect_onboarded = newly_onboarded
        db.commit()
        logger.info(f"Org {org.id} Stripe Connect onboarded={newly_onboarded}")

    return {"status": "ok"}


def _handle_rent_payment_succeeded(db: Session, obj: dict):
    """Shared by both checkout.session.completed and payment_intent.succeeded
    (Stripe sends both for a Checkout-created payment) — idempotent since it
    only ever transitions a payment into 'paid', never re-processes one
    that's already marked paid."""
    from models.accounting import RentPayment, PaymentStatus, PaymentMethod
    from datetime import date as _date

    rent_payment_id = (obj.get("metadata") or {}).get("rent_payment_id")
    if not rent_payment_id:
        return
    try:
        payment = db.query(RentPayment).filter(RentPayment.id == rent_payment_id).first()
    except Exception:
        payment = None
    if not payment or payment.status == PaymentStatus.paid:
        return

    payment.status = PaymentStatus.paid
    payment.paid_date = _date.today()
    payment_method_type = (obj.get("payment_method_types") or ["card"])[0]
    payment.payment_method = PaymentMethod.ach if "bank_account" in payment_method_type else PaymentMethod.card
    db.commit()
    logger.info(f"Rent payment {rent_payment_id} marked paid via Stripe Connect webhook")


@router.get("/plans")
async def get_plans():
    return {
        "plans": [
            {
                "name": "Starter",
                "key": "starter",
                "price": 49,
                "features": ["Up to 3 properties", "25 units", "AI chat support", "Maintenance tracking", "100 AI calls/mo"],
            },
            {
                "name": "Professional",
                "key": "professional",
                "price": 149,
                "features": ["Up to 15 properties", "150 units", "Voice AI call center", "Lead generation", "Automated outreach", "1000 AI calls/mo"],
            },
            {
                "name": "Enterprise",
                "key": "enterprise",
                "price": 499,
                "features": ["Unlimited properties", "Unlimited units", "Full AI autonomy", "Custom integrations", "Dedicated support", "Unlimited AI calls"],
            },
        ]
    }
