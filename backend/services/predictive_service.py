"""Predictive-signal heuristics — statistical scoring over real historical
data (no fabricated ML predictions). Every signal ships with a confidence
score and a plain-English explanation of the inputs that produced it, per
the same transparency standard used across every other AI-flavored feature
in this app (pricing_agent, investment_agent, collections_agent, etc.).
"""
from datetime import date, datetime, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session

from models.property import Property, Unit
from models.maintenance import MaintenanceTicket, TicketStatus
from models.tenant import Lease, LeaseStatus, Tenant
from models.accounting import RentPayment, PaymentStatus

LOOKBACK_DAYS = 365
RENEWAL_WINDOW_DAYS = 90


def predict_maintenance_risk(db: Session, organization_id) -> list:
    """Flags recurring-failure categories per property from real ticket history."""
    cutoff = datetime.utcnow() - timedelta(days=LOOKBACK_DAYS)
    tickets = db.query(MaintenanceTicket).join(Property).filter(
        Property.organization_id == organization_id,
        MaintenanceTicket.created_at >= cutoff,
    ).all()

    by_property = defaultdict(list)
    for t in tickets:
        by_property[t.property_id].append(t)

    results = []
    for property_id, plist in by_property.items():
        prop = plist[0].property
        by_category = defaultdict(list)
        for t in plist:
            by_category[t.category.value if t.category else "other"].append(t)

        for category, cat_tickets in by_category.items():
            count = len(cat_tickets)
            if count < 2:
                continue
            most_recent = max(t.created_at for t in cat_tickets)
            days_since_last = (datetime.utcnow() - most_recent).days
            recency_bonus = 0.15 if days_since_last <= 30 else (0.05 if days_since_last <= 90 else 0)
            confidence = min(0.95, 0.35 + 0.15 * count + recency_bonus)

            age_note = ""
            if prop.year_built and (datetime.utcnow().year - prop.year_built) >= 20:
                age_note = f" The property is {datetime.utcnow().year - prop.year_built} years old, which raises baseline risk for this system."

            results.append({
                "property_id": str(property_id),
                "property_name": prop.name,
                "category": category,
                "risk_level": "high" if count >= 4 else ("medium" if count >= 3 else "low"),
                "confidence": round(confidence, 2),
                "occurrences_last_year": count,
                "most_recent_date": most_recent.date().isoformat(),
                "explanation": (
                    f"{count} {category} maintenance tickets logged at {prop.name} in the last 12 months, "
                    f"most recently {days_since_last} day(s) ago.{age_note}"
                ),
            })

    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results


def predict_lease_renewal_risk(db: Session, organization_id) -> list:
    """Scores active leases expiring soon for renewal/churn risk using real
    payment history and maintenance complaint volume for that tenant."""
    today = date.today()
    window_end = today + timedelta(days=RENEWAL_WINDOW_DAYS)

    leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organization_id == organization_id,
        Lease.status == LeaseStatus.active,
        Lease.end_date <= window_end,
        Lease.end_date >= today,
    ).all()

    results = []
    for lease in leases:
        payments = db.query(RentPayment).filter(RentPayment.lease_id == lease.id).all()
        total_payments = len(payments)
        late_payments = sum(
            1 for p in payments
            if p.status in (PaymentStatus.late, PaymentStatus.missed) or (p.paid_date and p.paid_date > p.due_date)
        )
        late_rate = (late_payments / total_payments) if total_payments else 0.0

        complaint_count = db.query(MaintenanceTicket).filter(
            MaintenanceTicket.tenant_id == lease.tenant_id
        ).count()

        days_until_expiry = (lease.end_date - today).days
        risk_score = min(1.0, 0.5 * late_rate + min(0.35, complaint_count * 0.08))
        risk_level = "high" if risk_score >= 0.5 else ("medium" if risk_score >= 0.25 else "low")
        confidence = round(min(0.9, 0.3 + 0.08 * total_payments + 0.05 * complaint_count), 2)

        tenant = lease.tenant
        results.append({
            "lease_id": str(lease.id),
            "tenant_name": tenant.full_name if tenant else "Unknown",
            "unit_number": lease.unit.unit_number if lease.unit else None,
            "property_name": lease.unit.property.name if lease.unit and lease.unit.property else None,
            "days_until_expiry": days_until_expiry,
            "risk_level": risk_level,
            "risk_score": round(risk_score, 2),
            "confidence": confidence,
            "explanation": (
                f"Lease expires in {days_until_expiry} day(s). "
                f"{late_payments} of {total_payments} rent payment(s) were late "
                f"({round(late_rate * 100)}%), and {complaint_count} maintenance ticket(s) were filed during this tenancy."
            ),
        })

    results.sort(key=lambda r: r["risk_score"], reverse=True)
    return results
