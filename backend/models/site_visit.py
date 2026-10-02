"""First-party website traffic: one row per public-page view, written by the
Next.js /api/track route (frontend/pages/api/track.ts) and read only by the
owner-gated GET /admin/site-traffic summary in routes/admin.py.

Privacy shape, on purpose: no raw IP address, no user agent string, no
cookies and no user id is ever stored. The only thing that ties a row to a
person's device is `visitor_hash`, a SHA-256 of (IP + user agent + a salt
that rotates daily) computed on the frontend host before the request ever
reaches this backend -- it can count "unique visitors today" but can't be
reversed to an IP, and it can't follow anyone across days. Location is just
the coarse country/region/city the hosting edge reports for the request.

Not organization-scoped (this is traffic to the public marketing site, not
customer data), so services/org_wipe_service.py has nothing to cascade here.
Old rows are pruned by services/site_analytics_service.record_visit.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from database.base import Base


class SiteVisit(Base):
    __tablename__ = "site_visits"
    __table_args__ = (Index("ix_site_visits_created_at", "created_at"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    path = Column(String(300), nullable=False)
    # True for the first page view of a browsing session -- only these rows
    # carry a referrer/UTM, and only these are counted as "sessions" when
    # attributing traffic to a source.
    is_entry = Column(Boolean, default=False, nullable=False)
    source = Column(String(120), nullable=True)         # utm_source, else the referrer's host; null = direct
    referrer_host = Column(String(200), nullable=True)
    utm_medium = Column(String(120), nullable=True)
    utm_campaign = Column(String(120), nullable=True)
    country = Column(String(2), nullable=True)
    region = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    device = Column(String(10), nullable=True)          # mobile | tablet | desktop
    visitor_hash = Column(String(64), nullable=True)
