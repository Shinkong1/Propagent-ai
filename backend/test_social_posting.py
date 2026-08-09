"""Standalone verification script for the social posting engine (no pytest
in this environment). Mocks every outbound HTTP call (requests.post) so it
never touches real Facebook/Instagram/LinkedIn APIs -- there are no real app
credentials to test against here. Creates and then deletes its own
throwaway Organization/User/Property/SocialConnection rows in the real dev
database.

Run inside the backend container:
    docker compose exec -T backend python test_social_posting.py
"""
import sys
import uuid
from unittest.mock import patch, MagicMock

from database.session import SessionLocal
from models.user import User, Organization, UserRole
from models.property import Property, Unit, PropertyType
from models.social_connection import SocialConnection, SocialPlatform, SocialPost
from services.social_posting_service import publish_post, encrypt_token, decrypt_token, auto_post_new_listing
from middleware.auth import create_access_token, hash_password
from fastapi.testclient import TestClient
from main import app

PASS, FAIL = [], []


def check(name: str, condition: bool, detail: str = ""):
    if condition:
        PASS.append(name)
        print(f"PASS  {name}")
    else:
        FAIL.append(name)
        print(f"FAIL  {name}  {detail}")


def main():
    db = SessionLocal()
    org = user = prop = None
    try:
        # ── Set up a throwaway org/user/property ──
        org = Organization(name="Social Test Org", slug=f"social-test-{uuid.uuid4().hex[:8]}")
        db.add(org); db.flush()
        user = User(
            organization_id=org.id, email=f"social-test-{uuid.uuid4().hex[:8]}@example.com",
            hashed_password=hash_password("x"), first_name="Test", last_name="User",
            role=UserRole.owner, is_active=True, is_verified=True,
        )
        db.add(user); db.flush()
        prop = Property(
            organization_id=org.id, name="Riverside Commons", address="1 Main St", city="Austin",
            state="TX", zip_code="78701", property_type=PropertyType.apartment,
            total_units=1, is_public_listing=False,
        )
        db.add(prop); db.flush()
        unit = Unit(property_id=prop.id, unit_number="1", bedrooms=2, bathrooms=1.5, monthly_rent=1500, is_available=True)
        db.add(unit); db.commit()

        # ── 1. Token encryption round-trip, never storing the raw token ──
        raw_token = "test-access-token-123"
        enc = encrypt_token(raw_token)
        check("encrypt_token does not store the token in plaintext", enc != raw_token)
        check("decrypt_token recovers the original token", decrypt_token(enc) == raw_token)

        # ── 2. Mocked SUCCESS: Facebook ──
        conn_fb = SocialConnection(
            organization_id=org.id, platform=SocialPlatform.facebook, page_id="123456",
            page_name="Test FB Page", access_token_encrypted=encrypt_token("fb-token"),
            connected_by_user_id=user.id,
        )
        db.add(conn_fb); db.commit()

        fb_success = MagicMock(status_code=200)
        fb_success.json.return_value = {"id": "123456_987654"}
        with patch("services.social_posting_service.requests.post", return_value=fb_success) as mock_post:
            result = publish_post(db, conn_fb, "Hello world", link="https://propagent.app/listings/x")
            called_url = mock_post.call_args.args[0]
            check("mocked FB call hits the real Graph API /feed endpoint",
                  called_url == "https://graph.facebook.com/v21.0/123456/feed", called_url)
            check("mocked FB success is recorded as status='posted'", result.status == "posted", result.status)
            check("mocked FB success stores the real returned post ID", result.platform_post_id == "123456_987654")
            check("mocked FB success has no error_message", result.error_message is None)

        # ── 3. Mocked FAILURE: Facebook (bad token) is surfaced, not swallowed ──
        fb_fail = MagicMock(status_code=400)
        fb_fail.json.return_value = {"error": {"message": "Invalid OAuth access token."}}
        with patch("services.social_posting_service.requests.post", return_value=fb_fail):
            result = publish_post(db, conn_fb, "Hello again")
            check("mocked FB failure is recorded as status='failed', never a fake 'posted'", result.status == "failed", result.status)
            check("mocked FB failure has no platform_post_id", result.platform_post_id is None)
            check("mocked FB failure surfaces the platform's real error message",
                  result.error_message == "Invalid OAuth access token.", result.error_message)

        # ── 4. Mocked SUCCESS: LinkedIn ──
        conn_li = SocialConnection(
            organization_id=org.id, platform=SocialPlatform.linkedin, page_id="urn:li:organization:999",
            page_name="Test Co", access_token_encrypted=encrypt_token("li-token"), connected_by_user_id=user.id,
        )
        db.add(conn_li); db.commit()

        li_success = MagicMock(status_code=201, headers={"x-restli-id": "urn:li:share:111"})
        with patch("services.social_posting_service.requests.post", return_value=li_success) as mock_post:
            result = publish_post(db, conn_li, "New listing!", link="https://propagent.app/listings/x")
            called_url = mock_post.call_args.args[0]
            check("mocked LinkedIn call hits the real /ugcPosts endpoint",
                  called_url == "https://api.linkedin.com/v2/ugcPosts", called_url)
            check("mocked LinkedIn success is recorded as status='posted'", result.status == "posted")
            check("mocked LinkedIn success stores the real x-restli-id as the post ID",
                  result.platform_post_id == "urn:li:share:111")

        # ── 5. Mocked FAILURE: LinkedIn is surfaced, not swallowed ──
        li_fail = MagicMock(status_code=401)
        li_fail.json.return_value = {"message": "Expired access token"}
        with patch("services.social_posting_service.requests.post", return_value=li_fail):
            result = publish_post(db, conn_li, "New listing again!")
            check("mocked LinkedIn failure is recorded as status='failed'", result.status == "failed")
            check("mocked LinkedIn failure surfaces the platform's real error message",
                  result.error_message == "Expired access token", result.error_message)

        # ── 6. Instagram text-only post is a real, honest failure (no fake post) ──
        conn_ig = SocialConnection(
            organization_id=org.id, platform=SocialPlatform.instagram, page_id="ig-1",
            page_name="Test IG", access_token_encrypted=encrypt_token("ig-token"), connected_by_user_id=user.id,
        )
        db.add(conn_ig); db.commit()
        with patch("services.social_posting_service.requests.post") as mock_post:
            result = publish_post(db, conn_ig, "No image here")
            check("Instagram post with no image URL is never faked as posted", result.status == "failed", result.status)
            check("Graph API is never called for a text-only Instagram post (nothing to fake)", mock_post.call_count == 0)

        # ── 7. Auto-post trigger fires ONLY on the False -> True flip ──
        client = TestClient(app)
        jwt = create_access_token({"sub": str(user.id)})
        headers = {"Authorization": f"Bearer {jwt}"}

        with patch("services.social_posting_service.auto_post_new_listing") as mock_auto:
            r1 = client.patch(f"/properties/{prop.id}", json={"description": "updated description"}, headers=headers)
            check("unrelated property update returns 200", r1.status_code == 200, r1.text)
            check("auto-post does NOT fire on an unrelated update", mock_auto.call_count == 0, mock_auto.call_count)

            r2 = client.patch(f"/properties/{prop.id}", json={"is_public_listing": True}, headers=headers)
            check("is_public_listing False->True update returns 200", r2.status_code == 200, r2.text)
            check("auto-post fires exactly once on the False->True flip", mock_auto.call_count == 1, mock_auto.call_count)

            r3 = client.patch(f"/properties/{prop.id}", json={"description": "still public"}, headers=headers)
            check("re-saving an already-public listing returns 200", r3.status_code == 200, r3.text)
            check("auto-post does NOT fire again once already public", mock_auto.call_count == 1, mock_auto.call_count)

        # ── 8. auto_post_new_listing end-to-end (mocked HTTP) with real connected accounts ──
        # The org has facebook, linkedin, and instagram connections at this point --
        # auto_post_new_listing loops over all of them, so the mock must return a
        # response shaped correctly for whichever platform is calling (a generic
        # MagicMock's auto-created .headers would otherwise leak a MagicMock into
        # LinkedIn's post_id and crash the DB insert -- caught below in step 8b).
        def fake_post(url, **kwargs):
            resp = MagicMock(status_code=200, headers={})
            if "linkedin.com" in url:
                resp.headers = {"x-restli-id": "urn:li:share:222"}
            else:
                resp.json.return_value = {"id": "graph-api-post-id-999"}
            return resp

        db.refresh(prop)
        check("property is now public ahead of the end-to-end auto-post check", prop.is_public_listing is True)
        with patch("services.social_posting_service.requests.post", side_effect=fake_post):
            auto_post_new_listing(str(prop.id))
        auto_posts = db.query(SocialPost).filter(SocialPost.property_id == prop.id, SocialPost.trigger == "auto_listing").all()
        check("auto_post_new_listing records one real SocialPost row per connected account",
              len(auto_posts) == 3, len(auto_posts))
        by_platform = {p.platform: p for p in auto_posts}
        check("auto-post to Facebook succeeds", by_platform.get("facebook") and by_platform["facebook"].status == "posted")
        check("auto-post to LinkedIn succeeds", by_platform.get("linkedin") and by_platform["linkedin"].status == "posted")
        check("auto-post to Instagram honestly fails (no property photo to source an image URL from)",
              by_platform.get("instagram") and by_platform["instagram"].status == "failed" and by_platform["instagram"].error_message)
        check("auto-posted message includes the real property name", any(prop.name in p.message for p in auto_posts))
        check("auto-posted message includes the real bed/bath from the unit", any("2 bd" in p.message for p in auto_posts))
        check("auto-posted link points at the real /listings/{id} page",
              any(p.link and f"/listings/{prop.id}" in p.link for p in auto_posts))

        # ── 8b. A real platform-side crash mid-loop must not corrupt/abort the other accounts' posts ──
        conn_ig2 = SocialConnection(
            organization_id=org.id, platform=SocialPlatform.instagram, page_id="ig-2",
            page_name="Second IG", access_token_encrypted=encrypt_token("ig-token-2"), connected_by_user_id=user.id,
        )
        db.add(conn_ig2); db.commit()
        # A LinkedIn response with no x-restli-id header used to leak a MagicMock into
        # the DB and abort the session for every connection processed afterwards --
        # verify that's fixed and every connection still gets its own real, honest record.
        malformed_resp = MagicMock(status_code=200, headers={})
        malformed_resp.json.return_value = {}
        with patch("services.social_posting_service.requests.post", return_value=malformed_resp):
            auto_post_new_listing(str(prop.id))
        second_round = db.query(SocialPost).filter(
            SocialPost.property_id == prop.id, SocialPost.trigger == "auto_listing"
        ).order_by(SocialPost.created_at.desc()).limit(4).all()
        check("a malformed-but-200 platform response never crashes the auto-post loop for other accounts",
              len(second_round) == 4, len(second_round))
        check("LinkedIn with no post ID in the response is recorded as failed, not a fake success",
              any(p.platform == "linkedin" and p.status == "failed" and p.error_message for p in second_round),
              [(p.platform, p.status, p.error_message) for p in second_round])

    finally:
        db.rollback()
        if org:
            db.query(SocialPost).filter(SocialPost.organization_id == org.id).delete()
            db.query(SocialConnection).filter(SocialConnection.organization_id == org.id).delete()
        if prop:
            db.query(Unit).filter(Unit.property_id == prop.id).delete()
            db.query(Property).filter(Property.id == prop.id).delete()
        if user:
            db.query(User).filter(User.id == user.id).delete()
        if org:
            db.query(Organization).filter(Organization.id == org.id).delete()
        db.commit()
        db.close()

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        sys.exit(1)


if __name__ == "__main__":
    main()
