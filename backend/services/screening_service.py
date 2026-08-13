"""
Tenant Screening Service — AI-powered risk evaluation
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


async def run_full_screening(
    tenant_id: str,
    annual_income: float,
    monthly_rent: float,
    credit_score: Optional[float],
    employment_status: str,
    employer: Optional[str],
    references: Optional[list],
    db,
) -> dict:
    """
    Comprehensive tenant screening evaluation.
    Returns structured recommendation with score and reasoning.
    """
    from services.tenant_service import evaluate_screening

    result = await evaluate_screening(
        annual_income=annual_income,
        monthly_rent=monthly_rent,
        credit_score=credit_score or 0,
        employment_status=employment_status,
    )

    # Update tenant record with screening result. `persisted` is real, not
    # decorative -- a launch-readiness audit found this used to swallow a
    # commit failure (logged only) and still return `result` as if it
    # succeeded, so a property manager could see "APPROVED" with a full
    # report in the UI while Tenant.screening_approved was never actually
    # written. The caller (routes/screening.py) now checks this and returns
    # a real error instead of a false success when it's False.
    persisted = False
    try:
        from models.tenant import Tenant
        from uuid import UUID
        tenant = db.query(Tenant).filter(Tenant.id == UUID(tenant_id)).first()
        if tenant:
            tenant.screening_approved = result["approved"]
            tenant.annual_income = annual_income
            tenant.credit_score = credit_score
            tenant.employment_status = employment_status
            tenant.employer = employer
            db.commit()
            persisted = True
    except Exception as e:
        logger.error(f"Failed to update tenant screening: {e}")

    result["persisted"] = persisted
    return result


def generate_screening_report(result: dict, tenant_name: str, monthly_rent: float) -> str:
    """Generate a formatted screening report"""
    status = "✅ APPROVED" if result["approved"] else "❌ DECLINED"
    score = result["score"]
    issues = result.get("issues", [])

    lines = [
        f"TENANT SCREENING REPORT",
        f"========================",
        f"Applicant: {tenant_name}",
        f"Requested Unit Rent: ${monthly_rent:,.2f}/mo",
        f"",
        f"Overall Score: {score}/100",
        f"Recommendation: {status}",
        f"",
    ]

    if issues:
        lines.append("Issues Flagged:")
        for issue in issues:
            lines.append(f"  • {issue}")
        lines.append("")

    lines.append(result.get("summary", ""))
    return "\n".join(lines)
