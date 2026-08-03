"""Tenant service — AI-powered screening and communication"""
import logging
from sqlalchemy.orm import Session
from models.tenant import Tenant

logger = logging.getLogger(__name__)


async def evaluate_screening(
    annual_income: float,
    monthly_rent: float,
    credit_score: float,
    employment_status: str
) -> dict:
    """AI-powered tenant screening evaluation"""
    issues = []
    score = 100

    # Income-to-rent ratio (should be 3x)
    income_to_rent = annual_income / (monthly_rent * 12) if monthly_rent else 0
    if income_to_rent < 2.5:
        issues.append(f"Income-to-rent ratio too low ({income_to_rent:.1f}x, min 2.5x)")
        score -= 30
    elif income_to_rent < 3.0:
        score -= 10

    # Credit score
    if credit_score:
        if credit_score < 580:
            issues.append(f"Credit score too low ({credit_score})")
            score -= 30
        elif credit_score < 650:
            issues.append(f"Below-average credit score ({credit_score})")
            score -= 15
        elif credit_score >= 750:
            score += 10

    # Employment
    if employment_status in ["unemployed"]:
        issues.append("Currently unemployed")
        score -= 20
    elif employment_status in ["self-employed", "contractor"]:
        score -= 5  # minor risk flag

    score = max(0, min(100, score))
    approved = score >= 65 and len(issues) == 0 or (score >= 75)
    
    return {
        "score": score,
        "approved": approved,
        "issues": issues,
        "recommendation": "APPROVE" if approved else "DECLINE",
        "summary": f"Screening score: {score}/100. " + (
            "Applicant meets all criteria." if not issues else
            f"Concerns: {'; '.join(issues)}"
        )
    }
