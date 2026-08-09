"""Real automated social-media posting.

Facebook Page + Instagram Business Account posts go through Meta's Graph
API (https://graph.facebook.com/{version}/...); LinkedIn Company Page posts
go through LinkedIn's Marketing API UGC Posts endpoint
(https://api.linkedin.com/v2/ugcPosts). Every function below makes a real
HTTP request and returns whatever the platform's API actually said -- a
post is only ever recorded as 'posted' when the platform returned a real
post ID, and any error response is surfaced verbatim, never swallowed into
a fake success.

X/Twitter is NOT implemented here -- see routes/social.py's module
docstring for why.
"""
import base64
import hashlib
import logging
from typing import Optional
from uuid import UUID

import requests
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from config import settings
from models.property import Property
from models.social_connection import SocialConnection, SocialPlatform, SocialPost

logger = logging.getLogger(__name__)

GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"
LINKEDIN_API_BASE = "https://api.linkedin.com/v2"
REQUEST_TIMEOUT = 15


def _fernet() -> Fernet:
    """Derives a stable 32-byte Fernet key from SECRET_KEY rather than
    provisioning/rotating a separate encryption key -- same tradeoff this
    app already makes for JWTs (signed under JWT_SECRET). If SECRET_KEY is
    ever rotated, previously-stored access tokens become undecryptable and
    those connections will need to be reconnected."""
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_token(raw_token: str) -> str:
    return _fernet().encrypt(raw_token.encode("utf-8")).decode("utf-8")


def decrypt_token(encrypted_token: str) -> str:
    return _fernet().decrypt(encrypted_token.encode("utf-8")).decode("utf-8")


def post_to_facebook(page_id: str, page_access_token: str, message: str,
                      link: Optional[str] = None, image_url: Optional[str] = None) -> tuple:
    """POST /{page-id}/feed (or /{page-id}/photos when an image URL is
    supplied). Returns (post_id, error) -- post_id is the real ID Facebook's
    API returned; error is Facebook's own error message text."""
    try:
        if image_url:
            resp = requests.post(
                f"{GRAPH_API_BASE}/{page_id}/photos",
                data={"url": image_url, "caption": message, "access_token": page_access_token},
                timeout=REQUEST_TIMEOUT,
            )
        else:
            data = {"message": message, "access_token": page_access_token}
            if link:
                data["link"] = link
            resp = requests.post(f"{GRAPH_API_BASE}/{page_id}/feed", data=data, timeout=REQUEST_TIMEOUT)

        try:
            body = resp.json()
        except ValueError:
            return None, resp.text

        if resp.status_code >= 400 or "error" in body:
            return None, (body.get("error") or {}).get("message") or resp.text
        post_id = body.get("post_id") or body.get("id")
        if not post_id:
            return None, "Facebook accepted the post but returned no post ID."
        return post_id, None
    except requests.RequestException as e:
        return None, str(e)


def post_to_instagram(ig_user_id: str, access_token: str, message: str, image_url: Optional[str]) -> tuple:
    """Two-step Instagram Graph API publish: create a media container, then
    publish it. Instagram's Graph API has no text-only feed post -- an
    image_url is required, so a missing one is a real, honest failure
    rather than a silent skip."""
    if not image_url:
        return None, "Instagram requires an image URL — the Graph API has no text-only feed post."
    try:
        create_resp = requests.post(
            f"{GRAPH_API_BASE}/{ig_user_id}/media",
            data={"image_url": image_url, "caption": message, "access_token": access_token},
            timeout=REQUEST_TIMEOUT,
        )
        try:
            create_body = create_resp.json()
        except ValueError:
            return None, create_resp.text
        if create_resp.status_code >= 400 or "error" in create_body:
            return None, (create_body.get("error") or {}).get("message") or create_resp.text
        creation_id = create_body.get("id")
        if not creation_id:
            return None, "Instagram media container creation returned no ID."

        publish_resp = requests.post(
            f"{GRAPH_API_BASE}/{ig_user_id}/media_publish",
            data={"creation_id": creation_id, "access_token": access_token},
            timeout=REQUEST_TIMEOUT,
        )
        try:
            publish_body = publish_resp.json()
        except ValueError:
            return None, publish_resp.text
        if publish_resp.status_code >= 400 or "error" in publish_body:
            return None, (publish_body.get("error") or {}).get("message") or publish_resp.text
        published_id = publish_body.get("id")
        if not published_id:
            return None, "Instagram accepted the publish request but returned no post ID."
        return published_id, None
    except requests.RequestException as e:
        return None, str(e)


def post_to_linkedin(org_urn: str, access_token: str, message: str, link: Optional[str] = None) -> tuple:
    """POST /ugcPosts, publishing as the connected Company Page (org_urn,
    e.g. 'urn:li:organization:12345'). Returns (post_id, error) -- post_id
    comes from the x-restli-id response header LinkedIn's API returns on a
    successful create."""
    try:
        share_content = {
            "shareCommentary": {"text": message},
            "shareMediaCategory": "ARTICLE" if link else "NONE",
        }
        if link:
            share_content["media"] = [{"status": "READY", "originalUrl": link}]

        payload = {
            "author": org_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {"com.linkedin.ugc.ShareContent": share_content},
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }
        resp = requests.post(f"{LINKEDIN_API_BASE}/ugcPosts", json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
        if resp.status_code >= 400:
            try:
                err = resp.json().get("message", resp.text)
            except ValueError:
                err = resp.text
            return None, err
        post_id = resp.headers.get("x-restli-id") or resp.headers.get("X-RestLi-Id")
        if not post_id:
            return None, "LinkedIn accepted the post but returned no post ID in the response headers."
        return post_id, None
    except requests.RequestException as e:
        return None, str(e)


def publish_post(db: Session, connection: SocialConnection, message: str, link: Optional[str] = None,
                  image_url: Optional[str] = None, property_id: Optional[UUID] = None,
                  created_by_user_id: Optional[UUID] = None, trigger: str = "manual") -> SocialPost:
    """Dispatches to the right platform's API and records a real SocialPost
    row either way -- 'posted' with the platform's real post ID, or 'failed'
    with the platform's real error message. Never records success unless
    the platform actually confirmed it."""
    try:
        access_token = decrypt_token(connection.access_token_encrypted)
    except InvalidToken:
        post_id, error = None, "Stored access token could not be decrypted — reconnect this account."
    else:
        if connection.platform == SocialPlatform.facebook:
            post_id, error = post_to_facebook(connection.page_id, access_token, message, link=link, image_url=image_url)
        elif connection.platform == SocialPlatform.instagram:
            post_id, error = post_to_instagram(connection.page_id, access_token, message, image_url=image_url)
        elif connection.platform == SocialPlatform.linkedin:
            post_id, error = post_to_linkedin(connection.page_id, access_token, message, link=link)
        else:
            post_id, error = None, f"Unsupported platform: {connection.platform}"

    record = SocialPost(
        organization_id=connection.organization_id,
        connection_id=connection.id,
        property_id=property_id,
        message=message,
        image_url=image_url,
        link=link,
        status="posted" if post_id else "failed",
        platform_post_id=post_id,
        error_message=error,
        trigger=trigger,
        created_by_user_id=created_by_user_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    if error:
        logger.warning(f"Social post to {connection.platform.value} (org {connection.organization_id}) failed: {error}")
    return record


def build_listing_post_text(prop: Property) -> tuple:
    """Returns (message, link) for the auto-post announcing a newly public
    listing -- built entirely from real Property/Unit data, no placeholders."""
    bedrooms = bathrooms = rent = None
    if prop.units:
        candidates = [u for u in prop.units if u.is_available] or list(prop.units)
        cheapest = min(candidates, key=lambda u: u.monthly_rent or 0)
        bedrooms, bathrooms, rent = cheapest.bedrooms, cheapest.bathrooms, cheapest.monthly_rent

    parts = [f"New listing: {prop.name} — {prop.city}, {prop.state}."]
    if bedrooms is not None and bathrooms is not None:
        bath_str = f"{bathrooms:g}"
        parts.append(f"{bedrooms} bd / {bath_str} ba")
    if rent:
        parts.append(f"Starting at ${rent:,.0f}/mo")
    message = " ".join(parts)
    link = f"{settings.FRONTEND_URL.rstrip('/')}/listings/{prop.id}"
    return message, link


def auto_post_new_listing(property_id: str):
    """Background task entrypoint -- fired from routes/properties.py the
    moment Property.is_public_listing flips False -> True. Opens its own DB
    session since the request's session is already closed by the time a
    background task runs. Never raises: any failure here (bad credentials,
    network error, no connected accounts) is logged and swallowed so it can
    never break the property update that triggered it."""
    from database.session import SessionLocal
    db = SessionLocal()
    try:
        prop = db.query(Property).filter(Property.id == property_id).first()
        if not prop or not prop.is_public_listing:
            return
        connections = db.query(SocialConnection).filter(
            SocialConnection.organization_id == prop.organization_id,
            SocialConnection.is_active == True,
        ).all()
        if not connections:
            return
        message, link = build_listing_post_text(prop)
        for conn in connections:
            try:
                publish_post(db, conn, message, link=link, property_id=prop.id, trigger="auto_listing")
            except Exception as e:
                logger.warning(f"Auto-post to {conn.platform.value} failed for property {property_id}: {e}")
    except Exception as e:
        logger.warning(f"Auto-post-on-listing-public failed for property {property_id}: {e}")
    finally:
        db.close()
