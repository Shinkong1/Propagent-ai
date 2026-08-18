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
        # Real gap found in a launch-readiness audit: this was a direct
        # synchronous call, not offloaded via run_in_threadpool. This server
        # runs a single worker/event loop -- a slow Stripe response here
        # stalled EVERY concurrent user's request for its duration, on one
        # of the most frequently hit endpoints (every trial->paid
        # conversion). Same pattern /billing/portal already used correctly
        # a few lines below.
        session = await run_in_threadpool(
            stripe.checkout.Session.create,
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


@router.post("/voice-number/checkout")
async def create_voice_number_checkout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    """Start Stripe Checkout for the $19/mo dedicated Voice AI number addon.
    The actual Twilio number is NOT purchased here -- only after the
    webhook below confirms the subscription's first payment succeeded, so
    a real per-month Twilio charge never happens ahead of the customer
    actually paying for it."""
    if not settings.STRIPE_VOICE_NUMBER_PRICE_ID:
        raise HTTPException(status_code=503, detail="This addon isn't configured yet -- contact support.")

    from models.user import Organization, PlanType as _PlanType
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.plan == _PlanType.starter:
        raise HTTPException(status_code=400, detail="Voice AI (and this addon) requires the Professional plan or higher.")
    if org.voice_number:
        raise HTTPException(status_code=400, detail=f"This organization already has a dedicated number: {org.voice_number}")

    try:
        session = await run_in_threadpool(
            stripe.checkout.Session.create,
            mode="subscription",
            line_items=[{"price": settings.STRIPE_VOICE_NUMBER_PRICE_ID, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/dashboard/settings?tab=payments&voice_number=purchased",
            cancel_url=f"{settings.FRONTEND_URL}/dashboard/settings?tab=payments",
            metadata={"org_id": str(current_user.organization_id), "type": "voice_number_addon"},
            managed_payments={"enabled": False},
            **({"customer": org.stripe_customer_id} if org.stripe_customer_id else {}),
        )
        return {"url": session.url}
    except Exception as e:
        logger.error(f"Voice number addon checkout error for org {org.id}: {e}")
        raise HTTPException(status_code=500, detail="Payment processing error")


@router.post("/voice-number/cancel")
async def cancel_voice_number(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    """Cancel the dedicated-number addon: stop the $19/mo Stripe charge and
    release the Twilio number. The org's Voice AI calls keep working
    afterward via the shared platform number, same as before they bought
    the addon -- this only removes the isolation/attribution benefit, not
    Voice AI access itself (that's still governed by the base plan)."""
    from models.user import Organization
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org or not org.voice_number:
        raise HTTPException(status_code=400, detail="No dedicated Voice AI number to cancel.")

    canceled_stripe = False
    try:
        item_id = org.voice_number_subscription_item_id
        if not item_id and org.stripe_customer_id and settings.STRIPE_VOICE_NUMBER_PRICE_ID:
            # Fallback for orgs whose subscription_item_id was never
            # recorded (a transient Stripe error during provisioning) --
            # search Stripe directly by customer + price rather than
            # silently no-op the cancellation and leave the customer
            # billed forever with no stored way to find the subscription.
            subs = await run_in_threadpool(
                stripe.Subscription.list,
                customer=org.stripe_customer_id,
                price=settings.STRIPE_VOICE_NUMBER_PRICE_ID,
                status="active",
                limit=5,
            )
            sub_list = subs["data"] if isinstance(subs, dict) else subs.data
            if sub_list:
                first = sub_list[0]
                sub_items = first["items"]["data"] if isinstance(first, dict) else first.items.data
                if sub_items:
                    item_id = sub_items[0]["id"] if isinstance(sub_items[0], dict) else sub_items[0].id

        if item_id:
            item = await run_in_threadpool(stripe.SubscriptionItem.retrieve, item_id)
            await run_in_threadpool(stripe.Subscription.cancel, item.subscription)
            canceled_stripe = True
        else:
            logger.error(f"cancel_voice_number: org {org.id} has no findable Stripe subscription for the addon (checked stored item id and a live Stripe search) -- releasing the Twilio number without canceling any charge.")
    except Exception as e:
        logger.error(f"Failed to cancel voice-number Stripe subscription for org {org.id}: {e}")
        raise HTTPException(status_code=502, detail="Couldn't cancel the Stripe subscription -- please try again or contact support.")

    from services.voice_number_service import release_voice_number
    released = await run_in_threadpool(release_voice_number, org.voice_number_sid)

    if not canceled_stripe or not released:
        # Money or infrastructure may still be leaking -- alert rather than
        # let a clean-looking "canceled" response hide it.
        try:
            from models.user import User
            from services.communication_agent import send_email
            owner = db.query(User).filter(User.is_master == True, User.is_active == True).first()
            if owner and owner.email:
                problems = []
                if not canceled_stripe:
                    problems.append("could not find/cancel the Stripe subscription for this addon — the customer may still be charged $19/mo")
                if not released:
                    problems.append(f"could not release Twilio number {org.voice_number} ({org.voice_number_sid}) — PropAgent may still be charged for it")
                send_email(
                    owner.email,
                    f"[ACTION NEEDED] Voice number cancellation incomplete — org {org.id}",
                    f"Org {org.id} canceled its dedicated Voice AI number addon, but: " + "; ".join(problems)
                    + f".\n\nCheck Stripe customer {org.stripe_customer_id or '(unknown)'} and the Twilio console manually.",
                )
        except Exception as alert_error:
            logger.error(f"Also failed to send the cancellation-incomplete alert email: {alert_error}")

    org.voice_number = None
    org.voice_number_sid = None
    org.voice_number_subscription_item_id = None
    db.commit()

    if canceled_stripe:
        return {"message": "Dedicated Voice AI number canceled and released."}
    return {"message": "Dedicated Voice AI number released, but we couldn't confirm the Stripe subscription was canceled — our team has been notified and will follow up."}


@router.get("/voice-number/status")
async def voice_number_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from models.user import Organization
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"voice_number": org.voice_number, "addon_available": bool(settings.STRIPE_VOICE_NUMBER_PRICE_ID)}


@router.post("/portal")
async def create_billing_portal_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    """Stripe's own hosted Billing Portal -- lets a customer change plan,
    cancel, update their payment method, and see past invoices, without us
    building and maintaining custom UI for each of those. There was
    previously no way to do any of this short of starting a brand-new
    /checkout session (which doesn't cancel or downgrade anything)."""
    from models.user import Organization
    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org or not org.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="No active subscription on file yet -- subscribe to a plan first.",
        )

    try:
        session = await run_in_threadpool(
            stripe.billing_portal.Session.create,
            customer=org.stripe_customer_id,
            return_url=f"{settings.FRONTEND_URL}/dashboard/profile",
        )
        return {"url": session.url}
    except Exception as e:
        logger.error(f"Stripe billing portal error for org {org.id}: {e}")
        # Most common real cause: the Stripe account's Customer Portal
        # hasn't been configured yet (Stripe Dashboard -> Settings ->
        # Billing -> Customer portal) -- a one-time setup step on Stripe's
        # side, not something this endpoint can fix on its own.
        raise HTTPException(
            status_code=502,
            detail="Couldn't open the billing portal. If this keeps happening, the Stripe Customer Portal may need to be configured in the Stripe Dashboard first.",
        )


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
    from services.platform_service import log_org_event, grant_referral_reward_if_eligible
    from uuid import UUID

    if event["type"] == "checkout.session.completed":
        session_data = event["data"]["object"]
        org_id = session_data["metadata"].get("org_id")

        if session_data["metadata"].get("type") == "voice_number_addon":
            await run_in_threadpool(_handle_voice_number_addon_paid, db, org_id, session_data)
            return {"status": "ok"}

        plan = session_data["metadata"].get("plan", "starter")

        org = db.query(Organization).filter(Organization.id == UUID(org_id)).first()
        if org:
            old_plan = org.plan.value
            org.plan = PlanType[plan]
            org.stripe_subscription_id = session_data.get("subscription")
            # This was always missing here, independent of the .get() bug
            # above -- confirmed live: even after that fix landed and this
            # handler ran successfully, stripe_customer_id stayed null.
            # Needed for the billing-debug customer-lookup fallback and any
            # future customer-based billing logic.
            if session_data.get("customer"):
                org.stripe_customer_id = session_data.get("customer")
            db.commit()
            if old_plan != plan:
                log_org_event(db, org.id, OrgEventType.plan_changed, from_plan=old_plan, to_plan=plan)
            # Checkout completing is the real "trial converted to a paying
            # subscription" moment -- if this org was referred by another
            # org's referral code, grant that referrer its credit now.
            # Idempotent on its own (referral_reward_granted flag), so this
            # doesn't need to be gated on old_plan != plan.
            grant_referral_reward_if_eligible(db, org)
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


def _handle_voice_number_addon_paid(db: Session, org_id: str, session_data: dict) -> None:
    """Runs after Stripe confirms the $19/mo voice-number addon's first
    payment succeeded -- only now is it safe to actually buy a real Twilio
    number (a real recurring charge on PropAgent's own Twilio account).

    Idempotent AND concurrency-safe: Stripe can and does redeliver this
    event, and the Twilio purchase below is a slow network round-trip that
    can outlast Stripe's retry window -- with_for_update() row-locks this
    org for the duration of the transaction so a second near-simultaneous
    delivery blocks until the first commits, then sees org.voice_number
    already set and returns, rather than both passing the check and
    buying two real Twilio numbers for one org."""
    from models.user import Organization
    from uuid import UUID as _UUID

    org = db.query(Organization).filter(Organization.id == _UUID(org_id)).with_for_update().first()
    if not org or org.voice_number:
        return

    payment_status = session_data.get("payment_status")
    if payment_status not in ("paid", None):
        # "paid" is normal for card payments; None is tolerated since some
        # event shapes omit the field. Anything explicitly NOT paid (e.g.
        # "unpaid") means a delayed payment method (ACH, SEPA, ...) is still
        # settling -- checkout.session.completed can fire before money has
        # actually moved for those. Do not provision a real, billed Twilio
        # number ahead of confirmed payment; a later successful payment
        # event will need to be handled to complete this (not yet built --
        # flagging as a known gap, not silently pretending it's covered).
        logger.warning(f"checkout.session.completed for org {org_id}'s voice-number addon has payment_status={payment_status!r} -- not provisioning yet.")
        return

    subscription_item_id = None
    sub_id = session_data.get("subscription")
    for attempt in range(2):
        try:
            if sub_id:
                sub = stripe.Subscription.retrieve(sub_id)
                items = sub["items"]["data"] if isinstance(sub, dict) else sub.items.data
                if items:
                    subscription_item_id = items[0]["id"] if isinstance(items[0], dict) else items[0].id
            break
        except Exception as e:
            logger.error(f"Couldn't resolve subscription item for org {org_id}'s voice-number addon (attempt {attempt + 1}/2): {e}")

    from services.voice_number_service import purchase_voice_number, VoiceNumberProvisionError
    try:
        result = purchase_voice_number(str(org.id))
    except VoiceNumberProvisionError as e:
        # The customer has already been charged -- this must never fail
        # silently. Alert the platform owner so it can be fixed by hand
        # (buy/assign a number manually, or refund), rather than leaving a
        # paying customer with nothing and no one aware of it.
        logger.error(f"Voice number provisioning FAILED after payment for org {org_id}: {e}")
        try:
            from models.user import User
            from services.communication_agent import send_email
            owner = db.query(User).filter(User.is_master == True, User.is_active == True).first()
            if owner and owner.email:
                send_email(
                    owner.email,
                    f"[ACTION NEEDED] Voice number addon paid but provisioning failed — org {org_id}",
                    f"Org {org_id} paid for the $19/mo dedicated Voice AI number addon, but Twilio "
                    f"provisioning failed: {e}\n\nThey've been charged with nothing to show for it yet. "
                    f"Provision a number manually in the Twilio console and set Organization.voice_number "
                    f"(+ voice_number_sid) directly in the database, or refund the charge in Stripe.",
                )
        except Exception as alert_error:
            logger.error(f"Also failed to send the provisioning-failure alert email: {alert_error}")
        return

    org.voice_number = result["phone_number"]
    org.voice_number_sid = result["sid"]
    org.voice_number_subscription_item_id = subscription_item_id
    db.commit()
    logger.info(f"Org {org_id} voice-number addon provisioned: {result['phone_number']}")

    if not subscription_item_id:
        # Provisioned successfully, but we still don't know which Stripe
        # subscription item is billing for it. cancel_voice_number can
        # still find it later by searching Stripe directly (customer +
        # price), but alert now rather than silently hoping that path
        # works when the customer eventually cancels -- this exact gap
        # (a lost subscription reference) was found to let a canceled
        # addon keep charging forever with no stored way to stop it.
        try:
            from models.user import User
            from services.communication_agent import send_email
            owner = db.query(User).filter(User.is_master == True, User.is_active == True).first()
            if owner and owner.email:
                send_email(
                    owner.email,
                    f"[Heads up] Voice number provisioned but subscription link missing — org {org_id}",
                    f"Org {org_id}'s dedicated Voice AI number ({result['phone_number']}) provisioned "
                    f"successfully, but a Stripe API error prevented confirming which subscription item "
                    f"is billing for it. Cancellation will still work by searching Stripe directly for "
                    f"this org's subscription, but if that ever fails too, check Stripe customer "
                    f"{org.stripe_customer_id or '(unknown)'} manually.",
                )
        except Exception as alert_error:
            logger.error(f"Also failed to send the missing-subscription-link alert email: {alert_error}")


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
        # Same run_in_threadpool fix as /billing/checkout above -- these were
        # direct synchronous Stripe calls, stalling every other user's
        # request on this single-worker server for the round-trip.
        if not org.stripe_connect_account_id:
            account = await run_in_threadpool(
                stripe.Account.create,
                type="express",
                email=current_user.email,
                capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}},
                business_profile={"name": org.name},
            )
            org.stripe_connect_account_id = account.id
            db.commit()

        account_link = await run_in_threadpool(
            stripe.AccountLink.create,
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
    # Kept in sync with frontend/pages/pricing.tsx's PLANS array by hand --
    # this was found drifted (still describing Professional as "Lead
    # generation, Automated outreach" instead of what it actually ships)
    # during a pricing-page audit. This list is what a logged-in customer
    # sees describing their OWN current plan on /dashboard/profile, so it
    # needs to match what they were actually sold on /pricing, not an
    # earlier draft of the plans.
    return {
        "plans": [
            {
                "name": "Starter",
                "key": "starter",
                "price": 49,
                "features": ["3 properties", "25 units", "3 team members", "AI chat support", "Maintenance tracking", "Document uploads & search", "Rental inquiry & prospect tracking", "100 AI chat messages/mo", "Email support"],
            },
            {
                "name": "Professional",
                "key": "professional",
                "price": 149,
                "features": ["15 properties", "150 units", "10 team members", "Voice AI call center", "Executive AI Assistant", "Lease & notice generation", "Inspection AI (photo damage detection)", "Fraud & risk detection", "Compliance, Collections & Communications agents", "1,000 AI chat & assistant queries/mo", "Priority support"],
            },
            {
                "name": "Enterprise",
                "key": "enterprise",
                "price": 499,
                "features": ["Unlimited properties", "Unlimited units", "Unlimited team members", "Portfolio Dashboard", "Investment Analysis", "Pricing Intelligence", "Predictive insights", "No-code workflow automation", "API access", "Dedicated CSM", "Unlimited AI chat & assistant queries", "SLA guarantee"],
            },
        ]
    }
