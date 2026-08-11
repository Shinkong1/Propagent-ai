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
from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID

import requests

from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Places API (New) Text Search -- NOT the legacy Places API.
PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
# Places API (New) bills/limits by which field groups you request, so this is
# kept to only what scrape_leads_task actually uses.
PLACES_FIELD_MASK = "places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri"

# There's no single Places query that searches "the whole USA" -- Text
# Search returns at most ~20 results per call regardless of query scope, so
# a literal "property management company in USA" search would only ever
# surface ~20 businesses nationwide, then nothing new ever again. Real
# national coverage means one query per metro area. This is a real,
# genuinely national list (all major regions, not just a few states) that
# LEAD_SCRAPE_LOCATIONS="nationwide" rotates through -- see
# todays_scrape_locations() below for why it's a rotating subset, not all
# ~100 in one run.
US_TOP_METROS = [
    "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
    "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "Austin, TX",
    "Jacksonville, FL", "Fort Worth, TX", "San Jose, CA", "Columbus, OH", "Charlotte, NC",
    "Indianapolis, IN", "San Francisco, CA", "Seattle, WA", "Denver, CO", "Oklahoma City, OK",
    "Nashville, TN", "El Paso, TX", "Washington, DC", "Boston, MA", "Las Vegas, NV",
    "Portland, OR", "Detroit, MI", "Louisville, KY", "Memphis, TN", "Baltimore, MD",
    "Milwaukee, WI", "Albuquerque, NM", "Tucson, AZ", "Fresno, CA", "Sacramento, CA",
    "Mesa, AZ", "Kansas City, MO", "Atlanta, GA", "Omaha, NE", "Colorado Springs, CO",
    "Raleigh, NC", "Miami, FL", "Long Beach, CA", "Virginia Beach, VA", "Oakland, CA",
    "Minneapolis, MN", "Tulsa, OK", "Tampa, FL", "Arlington, TX", "New Orleans, LA",
    "Wichita, KS", "Cleveland, OH", "Bakersfield, CA", "Aurora, CO", "Anaheim, CA",
    "Honolulu, HI", "Santa Ana, CA", "Riverside, CA", "Corpus Christi, TX", "Lexington, KY",
    "Stockton, CA", "Henderson, NV", "St. Paul, MN", "St. Louis, MO", "Cincinnati, OH",
    "Pittsburgh, PA", "Greensboro, NC", "Anchorage, AK", "Plano, TX", "Lincoln, NE",
    "Orlando, FL", "Irvine, CA", "Newark, NJ", "Toledo, OH", "Durham, NC",
    "Chula Vista, CA", "Fort Wayne, IN", "Jersey City, NJ", "St. Petersburg, FL", "Laredo, TX",
    "Madison, WI", "Chandler, AZ", "Buffalo, NY", "Lubbock, TX", "Scottsdale, AZ",
    "Reno, NV", "Glendale, AZ", "Gilbert, AZ", "Winston-Salem, NC", "North Las Vegas, NV",
    "Norfolk, VA", "Chesapeake, VA", "Garland, TX", "Irving, TX", "Hialeah, FL",
    "Fremont, CA", "Boise, ID", "Richmond, VA", "Baton Rouge, LA", "Spokane, WA",
    "Des Moines, IA", "Tacoma, WA", "San Bernardino, CA", "Modesto, CA", "Fayetteville, NC",
]


def todays_scrape_locations(configured: str, daily_count: int = 10) -> List[str]:
    """Resolves LEAD_SCRAPE_LOCATIONS into the actual list of search
    locations for today's run.

    If it's the literal value "nationwide" (case-insensitive), rotates
    through US_TOP_METROS -- `daily_count` metros per day, cycling back to
    the start once the list is exhausted, so the full ~100-metro list gets
    covered roughly every `len(US_TOP_METROS) / daily_count` days rather
    than hitting the Places API for all ~100 in a single run (each Text
    Search call is billed -- querying the whole list daily is both wasteful
    and unnecessary, since most metros won't have new property managers
    show up day to day). Deterministic by day-of-year, so this needs no
    extra database state to remember where it left off.

    Otherwise, treated as the existing explicit comma-separated list
    (unchanged behavior) -- e.g. "Austin, TX,Dallas, TX".
    """
    if configured.strip().lower() == "nationwide":
        n = len(US_TOP_METROS)
        start = (date.today().timetuple().tm_yday * daily_count) % n
        if start + daily_count <= n:
            return US_TOP_METROS[start:start + daily_count]
        return US_TOP_METROS[start:] + US_TOP_METROS[:(start + daily_count) - n]
    return [loc.strip() for loc in configured.split(",") if loc.strip()]

# Best-effort email-discovery heuristic (see _discover_email below).
_MAILTO_RE = re.compile(r'mailto:([^"\'?<>\s]+)', re.IGNORECASE)
_EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
# Placeholder/example addresses real sites genuinely put in their HTML as
# sample text (contact-form examples, template boilerplate never swapped
# out) -- these regex-match as valid emails but were never meant to be
# reachable, and sending real outreach to them just bounces. Confirmed via
# a real scrape: "user@domain.com" came back as a "found" email for a real
# business's site, verbatim.
_PLACEHOLDER_EMAILS = {
    "user@domain.com", "your@email.com", "email@example.com", "example@example.com",
    "name@domain.com", "test@test.com", "you@example.com", "someone@example.com",
    "info@example.com", "email@domain.com",
}


def _clean_email(raw: Optional[str]) -> Optional[str]:
    """Strips punctuation a regex boundary can accidentally sweep in (a
    trailing ')' from '(email us at mailto:x@y.com)' was a real bug, caught
    live: 'info@texasbmg.com)'), then validates the result is actually a
    plausible email -- not just whatever text happened to follow 'mailto:'
    in the HTML (also a real bug caught live: a mailto link with no real
    address in it came back as the literal company name, 'Evernest') --
    and rejects known placeholder addresses. Returns None rather than a
    guess for anything that fails these checks."""
    if not raw:
        return None
    candidate = raw.strip().strip('.,;:()[]{}<>"\'')
    if not _EMAIL_RE.fullmatch(candidate):
        return None
    if candidate.lower() in _PLACEHOLDER_EMAILS:
        return None
    return candidate


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
            cleaned = _clean_email(m.group(1))
            if cleaned:
                return cleaned
        m = _EMAIL_RE.search(html)
        if m:
            cleaned = _clean_email(m.group(0))
            if cleaned:
                return cleaned
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
