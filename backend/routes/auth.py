"""Authentication routes — signup, login, token refresh"""
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, Organization, UserRole
from schemas.auth import (
    SignupRequest, LoginRequest, TokenResponse, LanguageUpdate,
    ThemeUpdate, OrganizationUpdate, PasswordChangeRequest,
)
from middleware.auth import hash_password, verify_password, create_access_token, get_current_user
from middleware.plan_gate import require_role
from middleware.rate_limit import limiter
from datetime import datetime, timedelta
from models.platform import OrgEventType
from services.platform_service import generate_referral_code, log_org_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

SUPPORTED_CURRENCIES = {"USD", "EUR", "GBP", "CAD", "AUD", "JPY", "MXN", "INR"}


def slugify(text: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return slug[:50]


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, payload: SignupRequest, db: Session = Depends(get_db)):
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create organization
    base_slug = slugify(payload.organization_name)
    slug = base_slug
    count = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{count}"
        count += 1

    referred_by_org_id = None
    if payload.referral_code:
        referrer = db.query(Organization).filter(Organization.referral_code == payload.referral_code.upper()).first()
        if referrer:
            referred_by_org_id = referrer.id

    org = Organization(
        name=payload.organization_name, slug=slug,
        referral_code=generate_referral_code(), referred_by_org_id=referred_by_org_id,
        trial_ends_at=datetime.utcnow() + timedelta(days=14),
    )
    db.add(org)
    db.flush()

    # Create user
    user = User(
        organization_id=org.id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=UserRole.owner,
        is_active=True,
        is_verified=True,
        last_login_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_org_event(db, org.id, OrgEventType.signup)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        organization_id=str(org.id),
        organization_name=org.name,
        full_name=user.full_name,
        email=user.email,
        plan=org.plan.value,
        language=org.language,
        theme=org.theme,
        timezone=org.timezone,
        currency=org.currency,
        notify_email_enabled=org.notify_email_enabled,
        notify_sms_enabled=org.notify_sms_enabled,
        is_master=user.is_master,
        role=user.role.value,
    )


@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    if user.mfa_enabled:
        from routes.mfa import issue_mfa_challenge
        return issue_mfa_challenge(user)

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    org = user.organization
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        organization_id=str(org.id) if org else None,
        organization_name=org.name if org else None,
        full_name=user.full_name,
        email=user.email,
        plan=org.plan.value if org else "starter",
        language=org.language if org else "en",
        theme=org.theme if org else "dark",
        timezone=org.timezone if org else "America/New_York",
        currency=org.currency if org else "USD",
        notify_email_enabled=org.notify_email_enabled if org else True,
        notify_sms_enabled=org.notify_sms_enabled if org else True,
        is_master=user.is_master,
        role=user.role.value,
    )


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    org = current_user.organization
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "is_master": current_user.is_master,
        "organization_id": str(current_user.organization_id) if current_user.organization_id else None,
        "organization_name": org.name if org else None,
        "plan": org.plan.value if org else "starter",
        "language": org.language if org else "en",
        "theme": org.theme if org else "dark",
        "timezone": org.timezone if org else "America/New_York",
        "currency": org.currency if org else "USD",
        "notify_email_enabled": org.notify_email_enabled if org else True,
        "notify_sms_enabled": org.notify_sms_enabled if org else True,
    }


@router.patch("/organization/language")
async def update_organization_language(
    payload: LanguageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.language = payload.language
    db.commit()
    return {"language": org.language}


@router.patch("/organization/theme")
async def update_organization_theme(
    payload: ThemeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.theme not in ("dark", "light"):
        raise HTTPException(status_code=422, detail="Theme must be 'dark' or 'light'")
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.theme = payload.theme
    db.commit()
    return {"theme": org.theme}


@router.patch("/organization")
async def update_organization(
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    data = payload.dict(exclude_unset=True)
    if "currency" in data and data["currency"] not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=422, detail=f"Unsupported currency: {data['currency']}")
    for field, value in data.items():
        setattr(org, field, value)
    db.commit()
    return {
        "name": org.name,
        "timezone": org.timezone,
        "currency": org.currency,
        "notify_email_enabled": org.notify_email_enabled,
        "notify_sms_enabled": org.notify_sms_enabled,
    }


@router.get("/organization/api-key")
async def get_organization_api_key(
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"api_key": org.api_key}


@router.post("/organization/api-key")
async def regenerate_organization_api_key(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    import secrets
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    org.api_key = f"pa_live_{secrets.token_urlsafe(32)}"
    db.commit()
    return {"api_key": org.api_key}


@router.post("/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password updated"}
