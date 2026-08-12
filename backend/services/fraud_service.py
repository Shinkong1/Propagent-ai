"""Fraud/risk heuristics — rule-based scans over real tenant, lease, and
payment records. Every flag names the exact records and values that
triggered it; nothing here is a black-box ML score.
"""
from collections import defaultdict

from sqlalchemy.orm import Session

from models.tenant import Tenant, Lease, LeaseStatus
from models.accounting import RentPayment, PaymentStatus


def scan_duplicate_applications(db: Session, organization_id) -> list:
    """Flags tenant records that share identity or contact details — a common
    signature of duplicate or fraudulent applications."""
    # is_active == True -- without this, a soft-deleted tenant (delete_tenant
    # never hard-deletes, only flips is_active) keeps tripping this scan
    # forever, even after the org "removed" them. Real report: staff deleted
    # the duplicate tenant and the same-email/phone flag never cleared,
    # showing up again on every subsequent add and making it look like
    # adding a tenant was failing.
    tenants = db.query(Tenant).filter(
        Tenant.organization_id == organization_id, Tenant.is_active == True
    ).all()

    flags = []

    by_identity = defaultdict(list)
    for t in tenants:
        if t.ssn_last4 and t.date_of_birth:
            by_identity[(t.ssn_last4, t.date_of_birth)].append(t)
    for (ssn4, dob), group in by_identity.items():
        if len(group) > 1:
            flags.append({
                "type": "duplicate_identity",
                "severity": "high",
                "tenant_ids": [str(t.id) for t in group],
                "tenant_names": [t.full_name for t in group],
                "explanation": (
                    f"{len(group)} tenant records share the same last-4 SSN ({ssn4}) and date of birth ({dob}) — "
                    f"possible duplicate or identity-reuse application."
                ),
            })

    by_email = defaultdict(list)
    by_phone = defaultdict(list)
    for t in tenants:
        if t.email:
            by_email[t.email.lower()].append(t)
        if t.phone:
            by_phone[t.phone].append(t)
    for email, group in by_email.items():
        if len(group) > 1:
            flags.append({
                "type": "duplicate_contact",
                "severity": "medium",
                "tenant_ids": [str(t.id) for t in group],
                "tenant_names": [t.full_name for t in group],
                "explanation": f"{len(group)} tenant records share the same email address ({email}).",
            })
    for phone, group in by_phone.items():
        if len(group) > 1:
            flags.append({
                "type": "duplicate_contact",
                "severity": "medium",
                "tenant_ids": [str(t.id) for t in group],
                "tenant_names": [t.full_name for t in group],
                "explanation": f"{len(group)} tenant records share the same phone number ({phone}).",
            })

    return flags


def scan_income_anomalies(db: Session, organization_id) -> list:
    """Flags active leases where the tenant was approved despite failing the
    standard income-to-rent bar used elsewhere in the app (screening_service)."""
    leases = db.query(Lease).join(Tenant).filter(
        Tenant.organization_id == organization_id,
        Lease.status == LeaseStatus.active,
    ).all()

    flags = []
    for lease in leases:
        tenant = lease.tenant
        if not tenant or not tenant.annual_income or not lease.monthly_rent:
            continue
        ratio = tenant.annual_income / (lease.monthly_rent * 12)
        if ratio < 2.5 and tenant.screening_approved:
            flags.append({
                "type": "income_ratio_override",
                "severity": "high" if ratio < 2.0 else "medium",
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.full_name,
                "lease_id": str(lease.id),
                "income_to_rent_ratio": round(ratio, 2),
                "explanation": (
                    f"{tenant.full_name} was marked screening-approved despite an income-to-rent ratio of "
                    f"{ratio:.1f}x on ${lease.monthly_rent:,.0f}/mo rent — below the standard 2.5x minimum."
                ),
            })
    return flags


def scan_payment_anomalies(db: Session, organization_id) -> list:
    """Flags duplicate or mismatched payment records across all leases."""
    leases = db.query(Lease).join(Tenant).filter(
        Tenant.organization_id == organization_id,
    ).all()

    flags = []
    for lease in leases:
        payments = db.query(RentPayment).filter(RentPayment.lease_id == lease.id).all()

        by_due_amount = defaultdict(list)
        for p in payments:
            by_due_amount[(p.due_date, p.amount)].append(p)
        for (due_date, amount), group in by_due_amount.items():
            if len(group) > 1:
                flags.append({
                    "type": "duplicate_payment",
                    "severity": "high",
                    "lease_id": str(lease.id),
                    "tenant_name": lease.tenant.full_name if lease.tenant else "Unknown",
                    "payment_ids": [str(p.id) for p in group],
                    "explanation": (
                        f"{len(group)} payment records exist for the same due date ({due_date}) and amount "
                        f"(${amount:,.2f}) on {lease.tenant.full_name if lease.tenant else 'this lease'}'s lease — "
                        f"possible duplicate entry or double-payment claim."
                    ),
                })

        for p in payments:
            if p.status == PaymentStatus.paid and p.amount != lease.monthly_rent:
                flags.append({
                    "type": "payment_amount_mismatch",
                    "severity": "low",
                    "lease_id": str(lease.id),
                    "tenant_name": lease.tenant.full_name if lease.tenant else "Unknown",
                    "payment_id": str(p.id),
                    "explanation": (
                        f"Payment of ${p.amount:,.2f} marked paid does not match the lease's monthly rent of "
                        f"${lease.monthly_rent:,.2f} and isn't flagged as partial."
                    ),
                })

    return flags
