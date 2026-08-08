"""Lead scraping — PropAgent AI's own B2B sales pipeline.

Finds real property management companies to pitch PropAgent AI to, via the
Google Places API (New) Text Search endpoint. Requires GOOGLE_PLACES_API_KEY
to be configured (see backend/config.py) -- when it isn't, this intentionally
inserts NOTHING rather than falling back to fake/demo leads. That fake
fallback ("John Smith / Smith Property Management", etc, inserted on every
call regardless of the requested location) was the bug this file replaces.
"""
import logging
import re
from typing import Optional, Tuple
from uuid import UUID

import requests

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Places API (New) Text Search -- NOT the legacy Places API.
PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
# Places API (New) bills/limits by which field groups you request, so this is
# kept to only what scrape_leads_task actually uses.
PLACES_FIELD_MASK = "places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri"

# Best-effort email-discovery heuristic (see _discover_email below).
_MAILTO_RE = re.compile(r'mailto:([^"\'?<>\s]+)', re.IGNORECASE)
_EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')


@celery_app.task(name="workers.tasks.lead_scraping.daily_scrape")
def daily_scrape():
    """Daily automated lead scrape, scheduled via Celery beat (see
    workers/celery_app.py beat_schedule).

    Leads are PropAgent's own B2B sales pipeline, not a per-tenant feature --
    routes/leads.py restricts POST /scrape to accounts with User.is_master.
    So rather than looping over every Organization row in the database (most
    of which are paying *subscribers*, not PropAgent's own sales org), this
    loops over organizations that actually have an active is_master user --
    same lookup services/owner_notify.py uses to find "the platform owner".

    What this does NOT do: invent a default search location. There is no
    city/target-market field anywhere on the Organization model today, and
    hardcoding one here (e.g. "Austin, TX") would just be a different flavor
    of the fabricated-data bug this whole file was rewritten to fix -- a
    silent, arbitrary stand-in for real configuration that nobody asked for.
    Until a real "target location(s)" setting exists somewhere, this task
    logs which org(s) it would otherwise scrape for and skips them. Use
    POST /leads/scrape with an explicit `location` in the meantime (that
    path is unaffected by this limitation).
    """
    logger.info("Starting daily lead scrape")
    from database.base import SessionLocal
    from models.user import User

    db = SessionLocal()
    try:
        owners = db.query(User).filter(User.is_master == True, User.is_active == True).all()
        if not owners:
            logger.warning("daily_scrape: no active is_master user found -- nothing to do")
            return {"status": "skipped", "reason": "no_master_org"}

        org_ids = sorted({str(o.organization_id) for o in owners})
        logger.warning(
            f"daily_scrape: skipping {len(org_ids)} org(s) {org_ids} -- no target "
            "location is configured for automated scraping (see docstring). "
            "Trigger POST /leads/scrape manually with an explicit `location` for now."
        )
        return {"status": "skipped", "reason": "no_location_configured", "orgs": org_ids}
    finally:
        db.close()


def _score_lead(has_phone: bool, has_website: bool, has_email: bool) -> int:
    """Simple, explainable lead score (0-90), so it's never a black box:
      - 50 base -- every scraped result is at least a real Places match for
        "property management company in {location}".
      - +15 if a phone number was returned (means we can actually call them).
      - +15 if a website was returned (some signal the business is active).
      - +10 if the email-discovery heuristic below found an email.
    Deliberately caps at 90, not 100 -- none of these signals reflect actual
    buying intent, which only shows up once a human replies.
    """
    score = 50
    if has_phone:
        score += 15
    if has_website:
        score += 15
    if has_email:
        score += 10
    return score


def _discover_email(website_url: str) -> Optional[str]:
    """Best-effort only. The Places API never returns email addresses, so
    this makes a single GET to the business's homepage and regex-searches
    the raw HTML for a mailto: link or a plausible visible email address.

    This will often find nothing -- most business sites don't expose an
    email address in the raw HTML of their homepage (it's on a separate
    /contact page, hidden behind a contact form, or obfuscated against
    scrapers) -- and that's expected, not a bug to "fix" by getting
    cleverer. We deliberately never guess an address (e.g. info@{domain}):
    a wrong guessed email is worse than no email at all for a cold outreach
    pipeline, since it just bounces and burns sender reputation.
    """
    try:
        resp = requests.get(
            website_url,
            timeout=8,
            allow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; PropAgentLeadBot/1.0)"},
        )
        if not resp.ok:
            return None
        html = resp.text
        m = _MAILTO_RE.search(html)
        if m:
            return m.group(1).strip()
        m = _EMAIL_RE.search(html)
        if m:
            return m.group(0).strip()
    except Exception as e:
        # A single unreachable/slow/broken site must never crash the scrape.
        logger.info(f"Email discovery skipped for {website_url}: {e}")
    return None


def _parse_city_state(formatted_address: Optional[str], fallback_location: str) -> Tuple[Optional[str], Optional[str]]:
    """Best-effort city/state parse from a Places "formattedAddress" string,
    e.g. "123 Main St, Austin, TX 78701, USA".

    Text Search only returns one flat formatted-address string, not
    structured address components (that needs a separate Place Details
    call per result, which we're not making here to keep this to one API
    call per search) -- so this is a naive comma-split that assumes the
    common US "street, city, ST zip, country" shape. It WILL get this
    wrong for addresses that don't follow that shape (non-US addresses,
    addresses without a unit before the street, etc). When it can't
    confidently pull out a city, we fall back to the raw search `location`
    string rather than guessing further.
    """
    city, state = None, None
    if formatted_address:
        parts = [p.strip() for p in formatted_address.split(",") if p.strip()]
        if len(parts) >= 3:
            city = parts[-3] or None
            state_zip = parts[-2].split()
            if state_zip:
                state = state_zip[0]
    if not city:
        city = fallback_location or None
    return city, state


def scrape_leads_task(org_id: str, source: str, location: str):
    """Scrape real leads for a specific org via the Google Places API (New)
    Text Search endpoint.

    Called as a FastAPI BackgroundTask (see routes/leads.py POST /scrape) --
    NOT awaited, so this must stay a plain synchronous function using
    `requests`, not an async HTTP client.
    """
    logger.info(f"Scraping {source} leads for org {org_id} in {location!r}")
    from config import settings
    from database.base import SessionLocal
    from models.lead import Lead, LeadSource, LeadStatus

    if not settings.GOOGLE_PLACES_API_KEY:
        logger.warning(
            "GOOGLE_PLACES_API_KEY not configured -- real lead scraping is disabled. "
            "Set it in Render's environment variables to enable this."
        )
        return

    if not location:
        logger.warning("scrape_leads_task called with no location -- nothing to search for, skipping.")
        return

    query = f"property management company in {location}"
    try:
        resp = requests.post(
            PLACES_SEARCH_URL,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": settings.GOOGLE_PLACES_API_KEY,
                "X-Goog-FieldMask": PLACES_FIELD_MASK,
            },
            json={"textQuery": query},
            timeout=15,
        )
    except Exception as e:
        # Network failure, DNS, timeout, etc -- never let this crash the
        # background task worker.
        logger.error(f"Google Places API request failed: {e}")
        return

    if not resp.ok:
        # Covers bad/expired key, API not enabled, quota exceeded, billing
        # not set up, malformed request, etc -- Places (New) puts details in
        # the JSON body but the status code + raw text is enough to log and
        # move on from here.
        logger.error(f"Google Places API returned {resp.status_code}: {resp.text[:500]}")
        return

    try:
        places = resp.json().get("places", [])
    except Exception as e:
        logger.error(f"Google Places API returned unparseable JSON: {e}")
        return

    if not places:
        logger.info(f"Google Places API returned zero results for '{query}'")
        return

    db = SessionLocal()
    inserted = 0
    try:
        org_uuid = UUID(org_id)
        lead_source = LeadSource[source] if source in [e.value for e in LeadSource] else LeadSource.google_maps

        for place in places:
            try:
                company = (place.get("displayName") or {}).get("text")
                if not company:
                    continue
                formatted_address = place.get("formattedAddress")
                phone = place.get("internationalPhoneNumber")
                website = place.get("websiteUri")
                city, state = _parse_city_state(formatted_address, location)

                # De-duplicate against existing leads for this org. Places
                # results essentially never include an email (unlike the old
                # demo data), so the previous email-based dedupe doesn't
                # apply -- prefer website (a genuinely unique key when
                # present) and fall back to company+city otherwise.
                existing = db.query(Lead).filter(Lead.organization_id == org_uuid)
                if website:
                    dup = existing.filter(Lead.website == website).first()
                else:
                    dup = existing.filter(Lead.company == company, Lead.city == city).first()
                if dup:
                    continue

                email = _discover_email(website) if website else None
                score = _score_lead(has_phone=bool(phone), has_website=bool(website), has_email=bool(email))

                lead = Lead(
                    organization_id=org_uuid,
                    # No real "contact person" name is available from the
                    # Places API -- leave these null rather than inventing one.
                    first_name=None,
                    last_name=None,
                    company=company,
                    email=email,
                    phone=phone,
                    website=website,
                    address=formatted_address,
                    city=city,
                    state=state,
                    source=lead_source,
                    status=LeadStatus.new,
                    score=score,
                )
                db.add(lead)
                inserted += 1
            except Exception as e:
                # One malformed Places result should never sink the batch.
                logger.warning(f"Skipping one Places result due to error: {e}")
                continue

        db.commit()
        logger.info(f"Scraped {inserted} new lead(s) out of {len(places)} result(s) for '{query}'")
    except Exception as e:
        logger.error(f"Lead scraping failed: {e}")
        db.rollback()
    finally:
        db.close()
