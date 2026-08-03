"""Plan-tier gating for features restricted to upgraded plans, and usage-cap enforcement"""
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from models.user import User, PlanType, Organization, UserRole
from middleware.auth import get_current_user

ROLE_RANK = {
    UserRole.staff: 0,
    UserRole.manager: 1,
    UserRole.owner: 2,
}


def require_role(min_role: UserRole):
    """Dependency factory: 403s if the caller's role is below min_role.
    A master account always passes — it's the platform owner acting in a
    support/admin capacity, not a member of the org's own role hierarchy."""
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.is_master:
            return current_user
        current_rank = ROLE_RANK.get(current_user.role, 0)
        required_rank = ROLE_RANK[min_role]
        if current_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires the {min_role.value} role or higher.",
            )
        return current_user
    return _check

PLAN_RANK = {
    PlanType.starter: 0,
    PlanType.professional: 1,
    PlanType.enterprise: 2,
}

# Mirrors the caps advertised on the pricing page (backend/routes/billing.py).
# -1 means unlimited.
PLAN_LIMITS = {
    PlanType.starter: {"properties": 3, "units": 25, "ai_calls": 100},
    PlanType.professional: {"properties": 15, "units": 150, "ai_calls": 1000},
    PlanType.enterprise: {"properties": -1, "units": -1, "ai_calls": -1},
}

AI_CALL_WINDOW_DAYS = 30


def require_plan(min_plan: PlanType):
    """Dependency factory: 403s if the caller's org plan is below min_plan.
    Applies to every account, including master — the Owner Admin portal lets a
    master account change its own org's plan on demand specifically so plan
    gating can be exercised realistically at every tier, rather than bypassed."""
    def _check(current_user: User = Depends(get_current_user)) -> User:
        org = current_user.organization
        current_rank = PLAN_RANK.get(org.plan if org else PlanType.starter, 0)
        required_rank = PLAN_RANK[min_plan]
        if current_rank < required_rank:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires the {min_plan.value.capitalize()} plan or higher. Upgrade to unlock it.",
            )
        return current_user
    return _check


def require_master(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: 403s unless the caller is a platform owner/master account. Used for the Owner Admin portal."""
    if not current_user.is_master:
        raise HTTPException(status_code=403, detail="Owner access required.")
    return current_user


def get_plan_limits(org: Organization) -> dict:
    plan = org.plan if org else PlanType.starter
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[PlanType.starter])


def enforce_count_limit(current_count: int, limit: int, resource: str):
    """Raise 403 if current_count has already reached limit. -1 means unlimited."""
    if limit != -1 and current_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You've reached your plan's limit of {limit} {resource}. Upgrade your plan to add more.",
        )


def check_and_increment_ai_calls(db: Session, org: Organization, feature: str = "unknown") -> None:
    """Enforce the monthly AI-call cap and increment the counter (no-op cap
    enforcement for unlimited plans), and always log the call for platform
    analytics regardless of plan — enterprise usage should still be visible."""
    from models.platform import AICallLog

    cap = get_plan_limits(org)["ai_calls"]
    if cap != -1:
        now = datetime.utcnow()
        if not org.ai_calls_period_start or now - org.ai_calls_period_start > timedelta(days=AI_CALL_WINDOW_DAYS):
            org.ai_calls_this_period = 0
            org.ai_calls_period_start = now

        if org.ai_calls_this_period >= cap:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You've reached your plan's limit of {cap} AI calls this month. Upgrade your plan for more.",
            )

        org.ai_calls_this_period += 1

    db.add(AICallLog(organization_id=org.id, feature=feature))
    db.commit()
