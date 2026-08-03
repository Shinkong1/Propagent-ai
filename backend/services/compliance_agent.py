"""Compliance Agent — tracks rental licenses, inspections, insurance, and
regulatory deadlines per property, and generates alerts before they lapse.
"""
from datetime import date
from sqlalchemy.orm import Session

from models.compliance import ComplianceItem, ComplianceStatus
from models.property import Property

URGENCY_RANK = {"expired": 0, "critical": 1, "warning": 2, "upcoming": 3, "ok": 4, "resolved": 5, "waived": 6}


def compliance_dashboard(db: Session, org_id) -> dict:
    items = db.query(ComplianceItem).join(Property).filter(
        Property.organization_id == org_id,
        ComplianceItem.is_active == True,
    ).all()

    counts = {"expired": 0, "critical": 0, "warning": 0, "upcoming": 0, "ok": 0}
    by_category: dict = {}
    upcoming_alerts = []

    for item in items:
        urgency = item.urgency
        if urgency in counts:
            counts[urgency] += 1

        cat = item.category.value if item.category else "other"
        by_category[cat] = by_category.get(cat, 0) + 1

        if item.status == ComplianceStatus.active and urgency in ("expired", "critical", "warning"):
            upcoming_alerts.append({
                "id": str(item.id),
                "property_name": item.property_name,
                "category": cat,
                "title": item.title,
                "expiration_date": str(item.expiration_date),
                "days_until_expiration": item.days_until_expiration,
                "urgency": urgency,
            })

    upcoming_alerts.sort(key=lambda a: a["days_until_expiration"])

    return {
        "total_tracked": len(items),
        "counts": counts,
        "by_category": by_category,
        "alerts": upcoming_alerts,
    }
