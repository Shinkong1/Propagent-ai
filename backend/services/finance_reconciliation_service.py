"""Automated finance reconciliation -- continuously cross-checks Stripe's
own records against our Organization table and self-heals drift.

Why this exists: a real bug (stripe-python 15.x dropping dict-style .get()
on Stripe SDK objects) silently broke the /billing/webhook handler for
EVERY checkout.session.completed event. A real customer (org "NamaStay")
paid, Stripe confirmed the charge, and our webhook crashed before saving
any of it -- the org's plan stayed "starter" with no Stripe linkage at all,
completely invisible until the customer reported it themselves.

This module is the guardrail against that ever happening silently again,
regardless of *why* a future webhook might fail (a new SDK upgrade, a
transient outage, a bug in a webhook handler we haven't written yet). It
does NOT rely on an LLM to decide whether numbers match -- comparing an
amount, a status string, or an org id is a deterministic operation, and a
language model is the wrong tool for that judgment on financial data. The
LLM's only role here is writing the plain-English summary of what a
*already-deterministically-computed* result means, for the alert email --
never the comparison itself.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _to_dict(stripe_obj):
    """stripe-python 15.x's StripeObject/ListObject dropped dict-style
    .get() AND dict(obj) (both confirmed broken via direct reproduction --
    see routes/billing.py and routes/admin.py for the incident). Only
    .to_dict() reliably converts a Stripe SDK object to a plain dict."""
    return stripe_obj.to_dict() if hasattr(stripe_obj, "to_dict") else stripe_obj


def reconcile_stripe_sessions(db: Session, lookback_hours: int = 72, limit: int = 25) -> dict:
    """Fetch recent Stripe Checkout sessions, find any with payment_status
    == "paid" whose org doesn't have a matching stripe_subscription_id on
    file, and self-heal by pulling the real subscription from Stripe and
    writing it to the org record. Returns a summary for the caller to log
    / alert on -- never raises for an individual bad session, only for a
    total inability to reach Stripe at all."""
    import stripe
    from config import settings
    from models.user import Organization, PlanType
    from models.platform import OrgEventType
    from services.platform_service import log_org_event

    stripe.api_key = settings.STRIPE_SECRET

    result = {
        "checked": 0,
        "healed": [],   # orgs that were out of sync and got fixed
        "flagged": [],  # paid sessions we could NOT safely auto-resolve
        "ok": 0,
    }

    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    sessions = stripe.checkout.Session.list(limit=limit)

    for raw in sessions.data:
        s = _to_dict(raw)
        created = s.get("created")
        if created and datetime.fromtimestamp(created, tz=timezone.utc) < cutoff:
            continue
        if s.get("payment_status") != "paid":
            continue

        result["checked"] += 1
        metadata = s.get("metadata") or {}
        org_id = metadata.get("org_id")
        plan = metadata.get("plan", "starter")
        subscription_id = s.get("subscription")
        customer_id = s.get("customer")

        if not org_id or org_id == "test":
            result["flagged"].append({
                "session_id": s.get("id"), "reason": "no valid org_id in session metadata",
            })
            continue

        try:
            org = db.query(Organization).filter(Organization.id == org_id).first()
        except Exception:
            org = None
        if not org:
            result["flagged"].append({
                "session_id": s.get("id"), "org_id": org_id,
                "reason": "paid Stripe session references an org_id that doesn't exist in our DB",
            })
            continue

        # Already in sync -- Stripe's subscription id matches what we have.
        if org.stripe_subscription_id and org.stripe_subscription_id == subscription_id:
            result["ok"] += 1
            continue

        # Drift found: Stripe says paid, we don't have this subscription on
        # file (or it doesn't match). Self-heal from Stripe's own data.
        try:
            plan_enum = PlanType[plan] if plan in PlanType.__members__ else PlanType.starter
        except Exception:
            plan_enum = PlanType.starter

        subscription_status = None
        if subscription_id:
            try:
                sub = stripe.Subscription.retrieve(subscription_id).to_dict()
                subscription_status = sub.get("status")
            except Exception as e:
                logger.warning(f"finance_reconciliation: couldn't fetch subscription {subscription_id}: {e}")

        old_plan = org.plan.value
        org.plan = plan_enum
        org.stripe_customer_id = org.stripe_customer_id or customer_id
        org.stripe_subscription_id = subscription_id
        if subscription_status:
            org.subscription_status = subscription_status
        db.commit()

        log_org_event(db, org.id, OrgEventType.plan_changed, from_plan=old_plan, to_plan=plan_enum.value,
                      subscription_status=subscription_status)
        logger.warning(
            f"finance_reconciliation: HEALED drift for org {org.id} ({org.name}) -- "
            f"Stripe showed paid session {s.get('id')} with subscription {subscription_id}, "
            f"our DB was out of sync (was plan={old_plan}, subscription_id=None or stale). "
            f"Now plan={plan_enum.value}, subscription_id={subscription_id}, status={subscription_status}."
        )
        result["healed"].append({
            "org_id": str(org.id), "org_name": org.name,
            "old_plan": old_plan, "new_plan": plan_enum.value,
            "subscription_id": subscription_id, "subscription_status": subscription_status,
            "session_id": s.get("id"),
        })

    return result


async def summarize_reconciliation_for_alert(result: dict) -> str:
    """Turn the deterministic result dict into a short, plain-English
    summary for the owner alert email. This is the ONLY place an LLM
    touches this pipeline -- narration of an already-computed result, not
    the comparison itself. Falls back to a plain templated summary if the
    LLM call fails for any reason (alerting must never depend on an LLM
    being available)."""
    if not result["healed"] and not result["flagged"]:
        return f"Checked {result['checked']} recent paid Stripe sessions -- all in sync with no drift found."

    try:
        from openai import AsyncOpenAI
        from config import settings
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        prompt = (
            "You are writing a short, plain-English alert email body for a property-management "
            "SaaS founder about an automated Stripe billing reconciliation run. Be concise and factual, "
            "no more than 120 words. Here is the deterministic result data:\n\n"
            f"{result}\n\n"
            "Summarize what was found and what was auto-corrected, in plain language, no jargon."
        )
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=250,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"finance_reconciliation: LLM summary failed, using plain fallback: {e}")
        lines = [f"Checked {result['checked']} recent paid Stripe sessions."]
        for h in result["healed"]:
            lines.append(
                f"AUTO-CORRECTED: {h['org_name']} ({h['org_id']}) was on '{h['old_plan']}' with no "
                f"active subscription on file; Stripe shows a paid session for '{h['new_plan']}' "
                f"(subscription {h['subscription_id']}, status {h['subscription_status']}). Fixed."
            )
        for f in result["flagged"]:
            lines.append(f"NEEDS MANUAL REVIEW: session {f.get('session_id')} -- {f.get('reason')}")
        return "\n".join(lines)
