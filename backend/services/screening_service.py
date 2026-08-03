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

    # Update tenant record with screening result
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
    except Exception as e:
        logger.error(f"Failed to update tenant screening: {e}")

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
