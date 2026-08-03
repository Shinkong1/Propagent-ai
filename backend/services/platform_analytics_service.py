"""Platform business-analytics — the data layer behind the Owner Admin
executive dashboard (Subscribers, Revenue, Marketing/Growth, Platform & AI
Ops, Business Analytics).

Every number here is computed from real rows (Organization, OrganizationEvent,
AICallLog, ErrorLog, User.last_login_at) or a live check (DB/Redis/Celery
ping). Where the underlying data doesn't exist yet (e.g. no cancellations
logged, Stripe not configured), the function returns an honest 'insufficient
data' / 'not configured' signal instead of a fabricated number — same pattern
used by predictive_service.py and fraud_service.py.
"""
import logging
from datetime import datetime, timedelta, date
from collections import defaultdict

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from config import settings
from models.user import User, Organization, PlanType
from models.platform import OrganizationEvent, OrgEventType, ErrorLog, AICallLog
from models.workflow import WorkflowRule

logger = logging.getLogger(__name__)

PLAN_PRICE = {"starter": 49, "professional": 149, "enterprise": 499}


# ---------------------------------------------------------------- Subscribers

def list_subscribers(db: Session, search: str = None, status_filter: str = None) -> list:
    query = db.query(Organization)
    if search:
        like = f"%{search}%"
        query = query.filter(Organization.name.ilike(like))
    orgs = query.order_by(Organization.created_at.desc()).all()

    results = []
    for o in orgs:
        status = o.subscription_status or ("active" if o.is_active else "inactive")
        if status_filter and status_filter != status:
            continue
        user_count = db.query(func.count(User.id)).filter(User.organization_id == o.id).scalar() or 0
        results.append({
            "id": str(o.id), "name": o.name, "plan": o.plan.value, "is_active": o.is_active,
            "status": status, "user_count": user_count, "created_at": o.created_at,
            "referral_code": o.referral_code, "stripe_configured": bool(o.stripe_subscription_id),
        })
    return results


# ------------------------------------------------------------------- Revenue

def revenue_summary(db: Session) -> dict:
    active_orgs = db.query(Organization).filter(Organization.is_active == True).all()
    mrr = sum(PLAN_PRICE.get(o.plan.value, 0) for o in active_orgs)
    arr = mrr * 12
    arpu = round(mrr / len(active_orgs), 2) if active_orgs else 0.0

    # Churn: cancellations/deactivations logged in the trailing 30 days vs.
    # orgs that were active at the start of that window.
    cutoff = datetime.utcnow() - timedelta(days=30)
    churned = db.query(OrganizationEvent).filter(
        OrganizationEvent.event_type.in_([OrgEventType.deactivated, OrgEventType.subscription_canceled]),
        OrganizationEvent.created_at >= cutoff,
    ).count()
    total_orgs_30d_ago = db.query(Organization).filter(Organization.created_at <= cutoff).count()
    churn_rate = round((churned / total_orgs_30d_ago) * 100, 2) if total_orgs_30d_ago > 0 else None
    ltv = round(arpu / (churn_rate / 100), 2) if churn_rate else None

    return {
        "mrr": mrr, "arr": arr, "arpu": arpu, "active_subscriber_count": len(active_orgs),
        "churn_rate_30d": churn_rate, "ltv": ltv,
        "churn_note": None if churn_rate is not None else "Not enough subscription history yet to compute churn.",
    }


def stripe_invoices_for_org(org: Organization) -> dict:
    if not settings.STRIPE_SECRET or not org.stripe_customer_id:
        return {"configured": False, "invoices": []}
    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET
        invoices = stripe.Invoice.list(customer=org.stripe_customer_id, limit=20)
        return {
            "configured": True,
            "invoices": [
                {"id": inv.id, "amount_due": inv.amount_due / 100, "status": inv.status, "created": inv.created}
                for inv in invoices.data
            ],
        }
    except Exception as e:
        logger.warning(f"Stripe invoice fetch failed for org {org.id}: {e}")
        return {"configured": True, "invoices": [], "error": str(e)}


# --------------------------------------------------------- Marketing/Growth

def signup_trend(db: Session, months: int = 6) -> list:
    events = db.query(OrganizationEvent).filter(OrganizationEvent.event_type == OrgEventType.signup).all()
    by_month = defaultdict(int)
    for e in events:
        key = e.created_at.strftime("%Y-%m")
        by_month[key] += 1

    today = date.today().replace(day=1)
    out = []
    for i in range(months - 1, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0:
            m += 12
            y -= 1
        key = f"{y:04d}-{m:02d}"
        out.append({"month": key, "signups": by_month.get(key, 0)})
    return out


def conversion_funnel(db: Session) -> dict:
    total_signups = db.query(OrganizationEvent).filter(OrganizationEvent.event_type == OrgEventType.signup).count()
    active = db.query(Organization).filter(Organization.is_active == True).count()
    paid = db.query(Organization).filter(
        Organization.is_active == True,
        Organization.plan.in_([PlanType.professional, PlanType.enterprise]),
    ).count()
    return {"signups": total_signups, "active": active, "paid_plan": paid}


def referral_leaderboard(db: Session) -> list:
    orgs = db.query(Organization).all()
    by_referrer = defaultdict(int)
    for o in orgs:
        if o.referred_by_org_id:
            by_referrer[o.referred_by_org_id] += 1
    results = []
    for org_id, count in sorted(by_referrer.items(), key=lambda kv: kv[1], reverse=True)[:10]:
        referrer = db.query(Organization).filter(Organization.id == org_id).first()
        if referrer:
            results.append({"organization_name": referrer.name, "referral_code": referrer.referral_code, "referred_count": count})
    return results


# --------------------------------------------------------- Platform/AI Ops

def platform_health(db: Session) -> dict:
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    redis_ok = None
    try:
        import redis as redis_lib
        r = redis_lib.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        redis_ok = r.ping()
    except Exception:
        redis_ok = False

    celery_workers = None
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from workers.celery_app import celery_app
        stats = celery_app.control.inspect(timeout=1.5).stats()
        celery_workers = len(stats) if stats else 0
    except Exception as e:
        logger.warning(f"Celery inspection failed: {e}")
        celery_workers = None

    integrations = {
        "openai": bool(settings.OPENAI_API_KEY),
        "stripe": bool(settings.STRIPE_SECRET),
        "twilio": bool(settings.TWILIO_SID and settings.TWILIO_TOKEN),
        "sendgrid": bool(settings.SMTP_USER and settings.SMTP_PASSWORD),
        "google_oauth": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
    }

    return {
        "database_ok": db_ok, "redis_ok": redis_ok, "celery_workers_online": celery_workers,
        "integrations": integrations,
    }


def ai_call_trend(db: Session, days: int = 14) -> dict:
    cutoff = datetime.utcnow() - timedelta(days=days)
    calls = db.query(AICallLog).filter(AICallLog.created_at >= cutoff).all()
    by_day = defaultdict(int)
    by_feature = defaultdict(int)
    for c in calls:
        by_day[c.created_at.strftime("%Y-%m-%d")] += 1
        by_feature[c.feature] += 1

    trend = []
    for i in range(days - 1, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        trend.append({"date": day, "calls": by_day.get(day, 0)})

    return {"trend": trend, "by_feature": dict(by_feature), "total": len(calls)}


def recent_errors(db: Session, limit: int = 25) -> list:
    errors = db.query(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(limit).all()
    return [
        {"id": str(e.id), "path": e.path, "method": e.method, "error_message": e.error_message, "created_at": e.created_at}
        for e in errors
    ]


# --------------------------------------------------------- Business Analytics

def retention_rate(db: Session, days: int = 30) -> dict:
    active_orgs = db.query(Organization).filter(Organization.is_active == True).all()
    if not active_orgs:
        return {"retention_rate": None, "note": "No active organizations yet."}
    cutoff = datetime.utcnow() - timedelta(days=days)
    engaged = 0
    for o in active_orgs:
        recent_login = db.query(User).filter(
            User.organization_id == o.id, User.last_login_at != None, User.last_login_at >= cutoff,
        ).first()
        if recent_login:
            engaged += 1
    return {"retention_rate": round((engaged / len(active_orgs)) * 100, 1), "engaged_orgs": engaged, "total_active_orgs": len(active_orgs)}


def feature_adoption(db: Session) -> dict:
    orgs_with_workflows = db.query(func.count(func.distinct(WorkflowRule.organization_id))).scalar() or 0
    total_active = db.query(Organization).filter(Organization.is_active == True).count()
    return {
        "orgs_using_workflows": orgs_with_workflows,
        "total_active_orgs": total_active,
        "workflow_adoption_rate": round((orgs_with_workflows / total_active) * 100, 1) if total_active else 0.0,
    }
