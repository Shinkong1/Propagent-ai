"""First-party website traffic -- see models/site_visit.py for the privacy
shape and frontend/pages/api/track.ts for where rows come from.

record_visit: validate + trim untrusted input from the track endpoint and
store it. summary: the numbers behind the owner-only Marketing Hub
"Website traffic" panel.
"""
import logging
import random
import re
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, literal_column
from sqlalchemy.orm import Session

from models.site_visit import SiteVisit
from models.user import Organization
from models.owner_message import OwnerMessage, OwnerMessageSource

logger = logging.getLogger(__name__)

RETENTION_DAYS = 180
# One request in this many also deletes rows past retention, so the table
# can't grow without bound and there's no separate cron to forget to schedule.
_PRUNE_ONE_IN = 200
_DEVICES = {"mobile", "tablet", "desktop"}
_HASH_RE = re.compile(r"^[0-9a-f]{64}$")


def _clip(value, limit: int) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value[:limit] if value else None


def record_visit(db: Session, data: dict) -> None:
    path = _clip(data.get("path"), 300)
    if not path or not path.startswith("/"):
        return
    country = _clip(data.get("country"), 2)
    visitor_hash = _clip(data.get("visitor_hash"), 64)
    device = data.get("device")
    visit = SiteVisit(
        path=path,
        is_entry=bool(data.get("is_entry")),
        source=_clip(data.get("source"), 120),
        referrer_host=_clip(data.get("referrer_host"), 200),
        utm_medium=_clip(data.get("utm_medium"), 120),
        utm_campaign=_clip(data.get("utm_campaign"), 120),
        country=country.upper() if country else None,
        region=_clip(data.get("region"), 100),
        city=_clip(data.get("city"), 100),
        device=device if device in _DEVICES else None,
        visitor_hash=visitor_hash if visitor_hash and _HASH_RE.match(visitor_hash) else None,
    )
    db.add(visit)
    if random.randrange(_PRUNE_ONE_IN) == 0:
        db.query(SiteVisit).filter(
            SiteVisit.created_at < datetime.utcnow() - timedelta(days=RETENTION_DAYS)
        ).delete(synchronize_session=False)
    db.commit()


def _top(rows, key_names=("label", "count")):
    return [{key_names[0]: r[0], key_names[1]: r[1]} for r in rows]


def summary(db: Session, days: int) -> dict:
    days = max(1, min(int(days), RETENTION_DAYS))
    since = datetime.utcnow() - timedelta(days=days)
    base = db.query(SiteVisit).filter(SiteVisit.created_at >= since)

    views = base.count()
    visitors = db.query(func.count(func.distinct(SiteVisit.visitor_hash))).filter(
        SiteVisit.created_at >= since, SiteVisit.visitor_hash.isnot(None)).scalar() or 0
    sessions = base.filter(SiteVisit.is_entry == True).count()  # noqa: E712

    day_col = func.date(SiteVisit.created_at)
    daily_rows = db.query(day_col, func.count(SiteVisit.id), func.count(func.distinct(SiteVisit.visitor_hash))) \
        .filter(SiteVisit.created_at >= since).group_by(day_col).order_by(day_col).all()
    by_day = {str(d): (v, u) for d, v, u in daily_rows}
    daily = []
    for i in range(days - 1, -1, -1):
        d = (datetime.utcnow() - timedelta(days=i)).date().isoformat()
        v, u = by_day.get(d, (0, 0))
        daily.append({"date": d, "views": v, "visitors": u})

    def grouped(col, extra_filter=None, limit=10):
        q = db.query(col, func.count(SiteVisit.id)).filter(SiteVisit.created_at >= since, col.isnot(None))
        if extra_filter is not None:
            q = q.filter(extra_filter)
        return q.group_by(col).order_by(func.count(SiteVisit.id).desc()).limit(limit).all()

    # "direct" = an entry view with no source at all (typed URL, bookmark,
    # or a link from an app/email that strips the referrer).
    source_label = func.coalesce(SiteVisit.source, literal_column("'direct'"))
    sources = db.query(source_label, func.count(SiteVisit.id)).filter(
        SiteVisit.created_at >= since, SiteVisit.is_entry == True  # noqa: E712
    ).group_by(source_label).order_by(func.count(SiteVisit.id).desc()).limit(10).all()

    region_rows = db.query(SiteVisit.country, SiteVisit.region, func.count(SiteVisit.id)).filter(
        SiteVisit.created_at >= since, SiteVisit.country.isnot(None), SiteVisit.is_entry == True  # noqa: E712
    ).group_by(SiteVisit.country, SiteVisit.region).order_by(func.count(SiteVisit.id).desc()).limit(10).all()

    demo_requests = db.query(func.count(OwnerMessage.id)).filter(
        OwnerMessage.source == OwnerMessageSource.demo_request, OwnerMessage.created_at >= since).scalar() or 0
    signups = db.query(func.count(Organization.id)).filter(Organization.created_at >= since).scalar() or 0
    signup_sources = db.query(Organization.signup_source, func.count(Organization.id)).filter(
        Organization.created_at >= since, Organization.signup_source.isnot(None)
    ).group_by(Organization.signup_source).order_by(func.count(Organization.id).desc()).limit(10).all()

    return {
        "days": days,
        "views": views,
        "visitors": visitors,
        "sessions": sessions,
        "demo_requests": demo_requests,
        "signups": signups,
        "daily": daily,
        "top_pages": _top(grouped(SiteVisit.path)),
        "sources": _top(sources),
        "campaigns": _top(grouped(SiteVisit.utm_campaign, SiteVisit.is_entry == True)),  # noqa: E712
        "countries": _top(grouped(SiteVisit.country, SiteVisit.is_entry == True)),  # noqa: E712
        "regions": [{"label": f"{(r or 'Unknown region')}, {c}", "count": n} for c, r, n in region_rows],
        "devices": _top(grouped(SiteVisit.device)),
        "signup_sources": _top(signup_sources),
    }
