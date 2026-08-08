"""Authentication routes — signup, login, token refresh"""
import logging
import re
from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, Organization, UserRole
from schemas.auth import (
    SignupRequest, LoginRequest, TokenResponse, LanguageUpdate,
    ThemeUpdate, OrganizationUpdate, PasswordChangeRequest,
    ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest,
    ProfileUpdateRequest,
)
from middleware.auth import hash_password, verify_password, create_access_token, decode_token, get_current_user
from middleware.plan_gate import require_role
from middleware.rate_limit import limiter
from datetime import datetime, timedelta
from config import settings
from models.platform import OrgEventType
from services.platform_service import generate_referral_code, log_org_event
from services.communication_agent import send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

SUPPORTED_CURRENCIES = {"USD", "EUR", "GBP", "CAD", "AUD", "JPY", "MXN", "INR"}
PASSWORD_RESET_EXPIRY = timedelta(minutes=30)
EMAIL_VERIFY_EXPIRY = timedelta(hours=48)


def slugify(text: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return slug[:50]


def _send_verification_email(user_id: str, email: str, first_name: str):
    """Plain def, not async -- run via BackgroundTasks.add_task so Starlette
    auto-threadpools the blocking SMTP call rather than stalling the
    request (or, since these are only ever invoked from a background task,
    the response) on this single-worker server."""
    token = create_access_token({"sub": user_id, "purpose": "verify_email"}, expires_delta=EMAIL_VERIFY_EXPIRY)
    link = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"
    body = (
        f"Hi {first_name or 'there'},\n\n"
        f"Confirm your email address for PropAgent AI:\n\n{link}\n\n"
        f"This link expires in 48 hours. If you didn't create a PropAgent AI account, you can ignore this email."
    )
    send_email(email, "Confirm your email — PropAgent AI", body)


def _send_password_reset_email(user_id: str, email: str, first_name: str):
    token = create_access_token({"sub": user_id, "purpose": "password_reset"}, expires_delta=PASSWORD_RESET_EXPIRY)
    link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    body = (
        f"Hi {first_name or 'there'},\n\n"
        f"Reset your PropAgent AI password:\n\n{link}\n\n"
        f"This link expires in 30 minutes. If you didn't request this, you can ignore this email — your password hasn't changed."
    )
    send_email(email, "Reset your password — PropAgent AI", body)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, payload: SignupRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
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
        is_verified=False,
        last_login_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_org_event(db, org.id, OrgEventType.signup)
    # Don't block signup on an SMTP round trip -- send after the response.
    background_tasks.add_task(_send_verification_email, str(user.id), user.email, user.first_name)

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
        is_verified=user.is_verified,
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
        is_verified=user.is_verified,
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
        "is_verified": current_user.is_verified,
    }


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, payload: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user and user.is_active:
        background_tasks.add_task(_send_password_reset_email, str(user.id), user.email, user.first_name)
    # Same response either way -- confirming/denying a registered email to an
    # unauthenticated caller is an account-enumeration leak.
    return {"message": "If that email is registered, a reset link is on its way."}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.token)
        if claims.get("purpose") != "password_reset":
            raise ValueError("wrong purpose")
        user_id = claims["sub"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Request a new one.")

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Request a new one.")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated — you can now log in."}


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.token)
        if claims.get("purpose") != "verify_email":
            raise ValueError("wrong purpose")
        user_id = claims["sub"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired.")

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired.")

    user.is_verified = True
    db.commit()
    return {"message": "Email verified."}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    if current_user.is_verified:
        return {"message": "Already verified."}
    background_tasks.add_task(_send_verification_email, str(current_user.id), current_user.email, current_user.first_name)
    return {"message": "Verification email sent."}


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


@router.get("/organization/referral")
async def get_organization_referral(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """This org's own referral code/link plus how many referrals have
    converted to paid so far. Every org gets a referral_code at signup
    (routes/auth.py's signup() always sets one), so this should only ever
    be null for orgs created before the referral program existed --
    self-heal by generating one on first view rather than showing nothing."""
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not org.referral_code:
        org.referral_code = generate_referral_code()
        db.commit()
    return {
        "referral_code": org.referral_code,
        "referral_credits_earned": org.referral_credits_earned or 0,
    }


@router.post("/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"detail": "Password updated"}


@router.patch("/profile")
async def update_profile(
    payload: ProfileUpdateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update your own login email and/or name. Changing the email you log
    in with is exactly the kind of thing that should require re-proving
    you know the current password, same as changing the password itself."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    email_changed = False
    if payload.email and payload.email != current_user.email:
        if db.query(User).filter(User.email == payload.email, User.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="That email is already in use.")
        current_user.email = payload.email
        current_user.is_verified = False
        email_changed = True
    if payload.first_name:
        current_user.first_name = payload.first_name
    if payload.last_name:
        current_user.last_name = payload.last_name

    db.commit()
    db.refresh(current_user)

    if email_changed:
        background_tasks.add_task(_send_verification_email, str(current_user.id), current_user.email, current_user.first_name)

    return {
        "detail": "Profile updated" + (" — check your new email to verify it" if email_changed else ""),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "is_verified": current_user.is_verified,
    }
