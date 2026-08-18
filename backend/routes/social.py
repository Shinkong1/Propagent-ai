"""Social media posting -- OAuth connect flows for Facebook Page + Instagram
Business Account (connected together via Meta's Graph API / Facebook Login
for Business) and LinkedIn Company Page (LinkedIn's Marketing API), plus
manual "compose and post now", a draft queue for a regular posting cadence
(see the "Draft queue" section below and services/social_posting_service.py
generate_cadence_drafts -- always requires an explicit human "approve"
click, never posts on its own), and real post history.

Each flow is config-gated the same way Google sign-in is in routes/oauth.py:
hidden (never faked) until real app credentials are set. See config.py for
FACEBOOK_APP_ID/SECRET/REDIRECT_URI and LINKEDIN_CLIENT_ID/SECRET/REDIRECT_URI.

X/Twitter is intentionally NOT integrated. Posting to X requires a paid API
tier (the free tier has no write access as of this app's build) that hasn't
been purchased. TODO: add an X/Twitter connection once a paid X API plan is
decided on -- do not stub/fake this in the meantime.
"""
import logging
import secrets
from datetime import timedelta, datetime
from typing import List
from urllib.parse import urlencode
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from models.social_connection import SocialConnection, SocialPlatform, SocialPost, SocialPostDraft
from schemas.social import (
    SocialConnectionResponse, ComposePostRequest, SocialPostResponse, SocialConfigResponse,
    CreateDraftRequest, ApproveDraftRequest, SocialPostDraftResponse,
)
from config import settings
from middleware.auth import get_current_user, create_access_token, decode_token
from services.social_posting_service import encrypt_token, publish_post

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/social", tags=["social"])

STATE_EXPIRY_MINUTES = 10

FACEBOOK_OAUTH_DIALOG_URL = "https://www.facebook.com/v21.0/dialog/oauth"
FACEBOOK_GRAPH_BASE = "https://graph.facebook.com/v21.0"
FACEBOOK_SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management"

LINKEDIN_OAUTH_DIALOG_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_API_BASE = "https://api.linkedin.com/v2"
LINKEDIN_SCOPES = "w_organization_social r_organization_admin rw_organization_admin"


def _facebook_configured() -> bool:
    return bool(settings.FACEBOOK_APP_ID and settings.FACEBOOK_APP_SECRET and settings.FACEBOOK_REDIRECT_URI)


def _linkedin_configured() -> bool:
    return bool(settings.LINKEDIN_CLIENT_ID and settings.LINKEDIN_CLIENT_SECRET and settings.LINKEDIN_REDIRECT_URI)


def _user_from_query_token(token: str, db: Session) -> User:
    """The OAuth connect endpoints are reached via a full browser navigation
    (window.location redirect to Meta/LinkedIn's own login page), which
    can't carry an Authorization header -- so the frontend passes the
    already-issued JWT as a query param instead, same tradeoff Stripe
    Connect's onboarding-return flow makes elsewhere in this app."""
    try:
        claims = decode_token(token)
        user_id = claims.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user or not user.organization_id:
        raise HTTPException(status_code=401, detail="Invalid session.")
    return user


def _upsert_connection(db: Session, org_id, platform: SocialPlatform, page_id: str,
                        page_name: str, access_token: str, user_id) -> SocialConnection:
    conn = db.query(SocialConnection).filter(
        SocialConnection.organization_id == org_id,
        SocialConnection.platform == platform,
        SocialConnection.page_id == page_id,
    ).first()
    encrypted = encrypt_token(access_token)
    if conn:
        conn.access_token_encrypted = encrypted
        conn.page_name = page_name
        conn.is_active = True
        conn.disconnected_at = None
    else:
        conn = SocialConnection(
            organization_id=org_id,
            platform=platform,
            page_id=page_id,
            page_name=page_name,
            access_token_encrypted=encrypted,
            connected_by_user_id=user_id,
        )
        db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def _frontend_social_url(**params) -> str:
    base = f"{settings.FRONTEND_URL.rstrip('/')}/dashboard/social"
    if params:
        return f"{base}?{urlencode(params)}"
    return base


@router.get("/config", response_model=SocialConfigResponse)
async def social_config():
    return {"facebook_enabled": _facebook_configured(), "linkedin_enabled": _linkedin_configured()}


@router.get("/connections", response_model=List[SocialConnectionResponse])
async def list_connections(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(SocialConnection).filter(
        SocialConnection.organization_id == current_user.organization_id,
        SocialConnection.is_active == True,
    ).order_by(SocialConnection.connected_at.desc()).all()


@router.delete("/connections/{connection_id}")
async def disconnect(connection_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = db.query(SocialConnection).filter(
        SocialConnection.id == connection_id,
        SocialConnection.organization_id == current_user.organization_id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    conn.is_active = False
    conn.disconnected_at = datetime.utcnow()
    db.commit()
    return {"detail": "Disconnected"}


@router.get("/posts", response_model=List[SocialPostResponse])
async def list_posts(limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(SocialPost).filter(
        SocialPost.organization_id == current_user.organization_id
    ).order_by(SocialPost.created_at.desc()).limit(min(limit, 200)).all()


@router.post("/compose", response_model=List[SocialPostResponse])
async def compose_post(payload: ComposePostRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not payload.connection_ids:
        raise HTTPException(status_code=422, detail="Select at least one connected account.")
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=422, detail="Post message can't be empty.")

    connections = db.query(SocialConnection).filter(
        SocialConnection.id.in_(payload.connection_ids),
        SocialConnection.organization_id == current_user.organization_id,
        SocialConnection.is_active == True,
    ).all()
    if len(connections) != len(set(payload.connection_ids)):
        raise HTTPException(status_code=404, detail="One or more selected accounts are not connected.")

    results = []
    for conn in connections:
        # publish_post makes real, blocking HTTP calls -- offload to the
        # threadpool so it doesn't stall the event loop, same pattern as
        # run_workflows in routes/maintenance.py.
        result = await run_in_threadpool(
            publish_post, db, conn, payload.message, payload.link, payload.image_url,
            None, current_user.id, "manual",
        )
        results.append(result)
    return results


# ── Draft queue -- a regular posting cadence with a required human approval
# step, since a real public post is irreversible. Drafts are queued either
# manually here or by the /internal/cron/social-draft-cadence job (see
# services/social_posting_service.py generate_cadence_drafts); either way,
# nothing is ever actually published until POST .../approve is called by an
# authenticated user clicking "Approve & Post" in the dashboard. ──

@router.get("/drafts", response_model=List[SocialPostDraftResponse])
async def list_drafts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(SocialPostDraft).filter(
        SocialPostDraft.organization_id == current_user.organization_id,
        SocialPostDraft.status == "pending",
    ).order_by(SocialPostDraft.created_at.desc()).all()


@router.post("/drafts", response_model=SocialPostDraftResponse)
async def create_draft(payload: CreateDraftRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=422, detail="Draft message can't be empty.")
    if payload.property_id:
        from models.property import Property
        owns_property = db.query(Property.id).filter(
            Property.id == payload.property_id, Property.organization_id == current_user.organization_id,
        ).first()
        if not owns_property:
            raise HTTPException(status_code=404, detail="Property not found.")
    draft = SocialPostDraft(
        organization_id=current_user.organization_id,
        property_id=payload.property_id,
        message=payload.message.strip(),
        image_url=payload.image_url,
        link=payload.link,
        source="manual",
        created_by_user_id=current_user.id,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.delete("/drafts/{draft_id}")
async def discard_draft(draft_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    draft = db.query(SocialPostDraft).filter(
        SocialPostDraft.id == draft_id,
        SocialPostDraft.organization_id == current_user.organization_id,
        SocialPostDraft.status == "pending",
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft.status = "discarded"
    db.commit()
    return {"detail": "Discarded"}


@router.post("/drafts/{draft_id}/approve", response_model=List[SocialPostResponse])
async def approve_draft(draft_id: UUID, payload: ApproveDraftRequest, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    """The ONLY code path that turns a queued draft into a real, live post.
    Requires an authenticated human to explicitly hit this endpoint (the
    dashboard's 'Approve & Post' button) and choose which connected
    accounts to publish to. No scheduler or cron job ever calls this --
    /internal/cron/social-draft-cadence only ever creates 'pending' drafts
    via generate_cadence_drafts, it never approves them."""
    draft = db.query(SocialPostDraft).filter(
        SocialPostDraft.id == draft_id,
        SocialPostDraft.organization_id == current_user.organization_id,
        SocialPostDraft.status == "pending",
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found or already handled.")
    if not payload.connection_ids:
        raise HTTPException(status_code=422, detail="Select at least one connected account.")

    connections = db.query(SocialConnection).filter(
        SocialConnection.id.in_(payload.connection_ids),
        SocialConnection.organization_id == current_user.organization_id,
        SocialConnection.is_active == True,
    ).all()
    if len(connections) != len(set(payload.connection_ids)):
        raise HTTPException(status_code=404, detail="One or more selected accounts are not connected.")

    results = []
    for conn in connections:
        result = await run_in_threadpool(
            publish_post, db, conn, draft.message, draft.link, draft.image_url,
            draft.property_id, current_user.id, "draft_approved",
        )
        results.append(result)

    draft.status = "approved"
    draft.approved_at = datetime.utcnow()
    draft.approved_by_user_id = current_user.id
    db.commit()
    return results


# ── Facebook + Instagram (Meta Graph API / Facebook Login for Business) ──

@router.get("/facebook/connect")
async def facebook_connect(token: str = Query(...), db: Session = Depends(get_db)):
    if not _facebook_configured():
        raise HTTPException(status_code=404, detail="Facebook/Instagram posting is not configured on this server.")
    user = _user_from_query_token(token, db)

    state = create_access_token(
        {"purpose": "facebook_oauth", "org_id": str(user.organization_id), "user_id": str(user.id), "nonce": secrets.token_urlsafe(16)},
        expires_delta=timedelta(minutes=STATE_EXPIRY_MINUTES),
    )
    params = {
        "client_id": settings.FACEBOOK_APP_ID,
        "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
        "state": state,
        "scope": FACEBOOK_SCOPES,
        "response_type": "code",
    }
    return RedirectResponse(f"{FACEBOOK_OAUTH_DIALOG_URL}?{urlencode(params)}")


@router.get("/facebook/callback")
async def facebook_callback(code: str = Query(None), state: str = Query(None), error: str = Query(None),
                             db: Session = Depends(get_db)):
    if error:
        logger.warning(f"Facebook OAuth returned an error: {error}")
        return RedirectResponse(_frontend_social_url(error="facebook_denied"))
    if not _facebook_configured():
        raise HTTPException(status_code=404, detail="Facebook/Instagram posting is not configured on this server.")
    if not code or not state:
        return RedirectResponse(_frontend_social_url(error="facebook_missing_code"))

    try:
        claims = decode_token(state)
        if claims.get("purpose") != "facebook_oauth":
            raise ValueError("wrong purpose")
        org_id = claims["org_id"]
        user_id = claims["user_id"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired OAuth state.")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.get(f"{FACEBOOK_GRAPH_BASE}/oauth/access_token", params={
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
                "code": code,
            })
            if token_resp.status_code != 200:
                logger.warning(f"Facebook token exchange failed: {token_resp.text}")
                return RedirectResponse(_frontend_social_url(error="facebook_token_exchange_failed"))
            short_token = token_resp.json().get("access_token")

            # Exchange for a long-lived user token (~60 days) -- best effort;
            # fall back to the short-lived token if this step fails so the
            # connection still succeeds.
            long_resp = await client.get(f"{FACEBOOK_GRAPH_BASE}/oauth/access_token", params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "fb_exchange_token": short_token,
            })
            user_token = long_resp.json().get("access_token", short_token) if long_resp.status_code == 200 else short_token

            pages_resp = await client.get(f"{FACEBOOK_GRAPH_BASE}/me/accounts", params={"access_token": user_token})
            if pages_resp.status_code != 200:
                logger.warning(f"Facebook /me/accounts failed: {pages_resp.text}")
                return RedirectResponse(_frontend_social_url(error="facebook_pages_fetch_failed"))
            pages = pages_resp.json().get("data", [])
            if not pages:
                return RedirectResponse(_frontend_social_url(error="no_facebook_pages"))

            for page in pages:
                page_id = page.get("id")
                page_name = page.get("name")
                page_token = page.get("access_token")
                if not (page_id and page_token):
                    continue
                _upsert_connection(db, org_id, SocialPlatform.facebook, page_id, page_name, page_token, user_id)

                # Instagram Business Account linked to this Page, if any -- IG
                # posting uses the same Page access token, not a separate one.
                ig_resp = await client.get(f"{FACEBOOK_GRAPH_BASE}/{page_id}",
                                            params={"fields": "instagram_business_account", "access_token": page_token})
                if ig_resp.status_code == 200:
                    ig_account = ig_resp.json().get("instagram_business_account")
                    if ig_account and ig_account.get("id"):
                        ig_id = ig_account["id"]
                        ig_name = None
                        ig_name_resp = await client.get(f"{FACEBOOK_GRAPH_BASE}/{ig_id}",
                                                         params={"fields": "username", "access_token": page_token})
                        if ig_name_resp.status_code == 200:
                            ig_name = ig_name_resp.json().get("username")
                        _upsert_connection(db, org_id, SocialPlatform.instagram, ig_id, ig_name, page_token, user_id)
    except httpx.HTTPError as e:
        # Real gap found in a launch-readiness audit: none of the calls
        # above were guarded against a connection-level failure (timeout,
        # DNS, network error) -- as opposed to an HTTP error status, which
        # every branch above already handles gracefully. An unguarded
        # exception here used to propagate to a bare 500 on a top-level
        # browser navigation (this is what the user's browser lands on
        # after Facebook's own redirect, not an XHR call), instead of the
        # same friendly error redirect every other failure path here uses.
        logger.warning(f"Facebook OAuth callback: network error talking to Facebook: {e}")
        return RedirectResponse(_frontend_social_url(error="facebook_connection_failed"))

    return RedirectResponse(_frontend_social_url(connected="facebook"))


# ── LinkedIn (LinkedIn Marketing API) ──

@router.get("/linkedin/connect")
async def linkedin_connect(token: str = Query(...), db: Session = Depends(get_db)):
    if not _linkedin_configured():
        raise HTTPException(status_code=404, detail="LinkedIn posting is not configured on this server.")
    user = _user_from_query_token(token, db)

    state = create_access_token(
        {"purpose": "linkedin_oauth", "org_id": str(user.organization_id), "user_id": str(user.id), "nonce": secrets.token_urlsafe(16)},
        expires_delta=timedelta(minutes=STATE_EXPIRY_MINUTES),
    )
    params = {
        "response_type": "code",
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
        "state": state,
        "scope": LINKEDIN_SCOPES,
    }
    return RedirectResponse(f"{LINKEDIN_OAUTH_DIALOG_URL}?{urlencode(params)}")


@router.get("/linkedin/callback")
async def linkedin_callback(code: str = Query(None), state: str = Query(None), error: str = Query(None),
                             db: Session = Depends(get_db)):
    if error:
        logger.warning(f"LinkedIn OAuth returned an error: {error}")
        return RedirectResponse(_frontend_social_url(error="linkedin_denied"))
    if not _linkedin_configured():
        raise HTTPException(status_code=404, detail="LinkedIn posting is not configured on this server.")
    if not code or not state:
        return RedirectResponse(_frontend_social_url(error="linkedin_missing_code"))

    try:
        claims = decode_token(state)
        if claims.get("purpose") != "linkedin_oauth":
            raise ValueError("wrong purpose")
        org_id = claims["org_id"]
        user_id = claims["user_id"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid or expired OAuth state.")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(LINKEDIN_TOKEN_URL, data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
            }, headers={"Content-Type": "application/x-www-form-urlencoded"})
            if token_resp.status_code != 200:
                logger.warning(f"LinkedIn token exchange failed: {token_resp.text}")
                return RedirectResponse(_frontend_social_url(error="linkedin_token_exchange_failed"))
            access_token = token_resp.json().get("access_token")

            # Company Pages this member administers -- requires the
            # r_organization_admin scope granted only once LinkedIn approves
            # the app for the Marketing Developer Platform.
            orgs_resp = await client.get(
                f"{LINKEDIN_API_BASE}/organizationAcls",
                params={
                    "q": "roleAssignee",
                    "role": "ADMINISTRATOR",
                    "state": "APPROVED",
                    "projection": "(elements*(organization~(localizedName),organization))",
                },
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if orgs_resp.status_code != 200:
                logger.warning(f"LinkedIn organizationAcls fetch failed: {orgs_resp.text}")
                return RedirectResponse(_frontend_social_url(error="linkedin_orgs_fetch_failed"))
            elements = orgs_resp.json().get("elements", [])
            if not elements:
                return RedirectResponse(_frontend_social_url(error="no_linkedin_pages"))

            for el in elements:
                org_urn = el.get("organization")
                if not org_urn:
                    continue
                org_detail = el.get("organization~") or {}
                org_name = org_detail.get("localizedName")
                _upsert_connection(db, org_id, SocialPlatform.linkedin, org_urn, org_name, access_token, user_id)
    except httpx.HTTPError as e:
        # Same gap and fix as facebook_callback above -- a connection-level
        # failure (timeout/DNS/network error) used to propagate to a bare
        # 500 on a top-level browser navigation instead of the friendly
        # error redirect every other failure path here already uses.
        logger.warning(f"LinkedIn OAuth callback: network error talking to LinkedIn: {e}")
        return RedirectResponse(_frontend_social_url(error="linkedin_connection_failed"))

    return RedirectResponse(_frontend_social_url(connected="linkedin"))
