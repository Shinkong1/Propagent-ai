"""Stripe billing routes"""
import logging
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
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

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/dashboard?upgraded={plan}",
            cancel_url=f"{settings.FRONTEND_URL}/pricing",
            metadata={"org_id": str(current_user.organization_id), "plan": plan},
            managed_payments={"enabled": False},
        )
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
