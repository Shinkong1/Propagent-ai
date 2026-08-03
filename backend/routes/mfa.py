"""TOTP-based multi-factor authentication — setup, verify, disable, and the
second-factor login challenge."""
import base64
import io
import logging
from datetime import timedelta
from uuid import UUID

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from schemas.auth import TokenResponse
from schemas.mfa import (
    MFASetupResponse, MFACodeRequest, MFADisableRequest, MFAStatusResponse,
    MFAChallengeResponse, MFALoginVerifyRequest,
)
from middleware.auth import get_current_user, verify_password, create_access_token, decode_token
from middleware.rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/mfa", tags=["mfa"])

ISSUER = "PropAgent AI"
MFA_CHALLENGE_EXPIRY_MINUTES = 5


def _qr_data_uri(provisioning_uri: str) -> str:
    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def _build_token_response(user: User) -> TokenResponse:
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


@router.get("/status", response_model=MFAStatusResponse)
async def mfa_status(current_user: User = Depends(get_current_user)):
    return MFAStatusResponse(mfa_enabled=current_user.mfa_enabled)


@router.post("/setup", response_model=MFASetupResponse)
async def setup_mfa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled. Disable it first to re-enroll.")

    secret = pyotp.random_base32()
    current_user.mfa_secret = secret
    db.commit()

    provisioning_uri = pyotp.totp.TOTP(secret).provisioning_uri(name=current_user.email, issuer_name=ISSUER)
    return MFASetupResponse(secret=secret, provisioning_uri=provisioning_uri, qr_code_base64=_qr_data_uri(provisioning_uri))


@router.post("/verify")
@limiter.limit("10/minute")
async def verify_mfa(
    request: Request,
    payload: MFACodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Run MFA setup first.")
    if not pyotp.TOTP(current_user.mfa_secret).verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code. Check your authenticator app and try again.")

    current_user.mfa_enabled = True
    db.commit()
    return {"mfa_enabled": True}


@router.post("/disable")
@limiter.limit("10/minute")
async def disable_mfa(
    request: Request,
    payload: MFADisableRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    if not current_user.mfa_enabled or not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    if not pyotp.TOTP(current_user.mfa_secret).verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code")

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    db.commit()
    return {"mfa_enabled": False}


@router.post("/login-verify", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login_verify(request: Request, payload: MFALoginVerifyRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.mfa_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="MFA challenge expired or invalid. Please log in again.")

    if not claims.get("mfa_pending"):
        raise HTTPException(status_code=401, detail="Invalid MFA challenge token.")

    try:
        user_id = UUID(claims.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid MFA challenge token.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=401, detail="MFA challenge is no longer valid.")

    if not pyotp.TOTP(user.mfa_secret).verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code. Check your authenticator app and try again.")

    from datetime import datetime
    user.last_login_at = datetime.utcnow()
    db.commit()

    return _build_token_response(user)


def issue_mfa_challenge(user: User) -> MFAChallengeResponse:
    token = create_access_token(
        {"sub": str(user.id), "mfa_pending": True},
        expires_delta=timedelta(minutes=MFA_CHALLENGE_EXPIRY_MINUTES),
    )
    return MFAChallengeResponse(mfa_token=token)
