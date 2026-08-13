"""Google OAuth2/OIDC login — config-gated (hidden, never faked, until a real
Google Cloud OAuth client is configured via GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)."""
import logging
import secrets
import re
from datetime import timedelta, datetime
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy.orm import Session

from database.session import get_db, SessionLocal
from models.user import User, Organization, UserRole
from config import settings
from middleware.auth import create_access_token, decode_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/oauth", tags=["oauth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
STATE_EXPIRY_MINUTES = 10


def _oauth_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI)


def slugify(text: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return slug[:50] or "workspace"


@router.get("/google/config")
async def google_oauth_config():
    return {"enabled": _oauth_configured()}


@router.get("/google/login")
async def google_login():
    if not _oauth_configured():
        raise HTTPException(status_code=404, detail="Google sign-in is not configured on this server.")

    state = create_access_token(
        {"purpose": "google_oauth", "nonce": secrets.token_urlsafe(16)},
        expires_delta=timedelta(minutes=STATE_EXPIRY_MINUTES),
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(code: str = Query(...), state: str = Query(...)):
    if not _oauth_configured():
        raise HTTPException(status_code=404, detail="Google sign-in is not configured on this server.")

    try:
        claims = decode_token(state)
        if claims.get("purpose") != "google_oauth":
            raise ValueError("wrong purpose")
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired OAuth state.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            })
            if token_resp.status_code != 200:
                logger.warning(f"Google token exchange failed: {token_resp.text}")
                raise HTTPException(status_code=401, detail="Google sign-in failed during token exchange.")
            access_token = token_resp.json().get("access_token")

            userinfo_resp = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
            if userinfo_resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Google sign-in failed while fetching profile.")
            profile = userinfo_resp.json()
    except httpx.HTTPError as e:
        # Real gap found in a launch-readiness audit: a connection-level
        # failure (timeout/DNS/network error) here used to propagate to a
        # bare 500 instead of the same clean 401 every other failure mode
        # in this function already returns.
        logger.warning(f"Google OAuth callback: network error talking to Google: {e}")
        raise HTTPException(status_code=401, detail="Google sign-in failed — couldn't reach Google. Please try again.")

    email = profile.get("email")
    if not email or not profile.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account has no verified email.")

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            if not user.is_active:
                raise HTTPException(status_code=403, detail="Account is deactivated")
        else:
            given_name = profile.get("given_name") or profile.get("name") or "New"
            family_name = profile.get("family_name") or "User"
            org_name = f"{given_name}'s Workspace"
            base_slug = slugify(org_name)
            slug = base_slug
            count = 1
            while db.query(Organization).filter(Organization.slug == slug).first():
                slug = f"{base_slug}-{count}"
                count += 1

            from services.platform_service import generate_referral_code, log_org_event
            from models.platform import OrgEventType
            org = Organization(name=org_name, slug=slug, referral_code=generate_referral_code())
            db.add(org)
            db.flush()

            user = User(
                organization_id=org.id,
                email=email,
                hashed_password=secrets.token_hex(32),  # unusable password — this account only signs in via Google
                first_name=given_name,
                last_name=family_name,
                role=UserRole.owner,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            log_org_event(db, org.id, OrgEventType.signup)

        user.last_login_at = datetime.utcnow()
        db.commit()

        jwt_token = create_access_token({"sub": str(user.id)})
    finally:
        db.close()

    return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/oauth/callback?token={jwt_token}")
