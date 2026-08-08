import builtins
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Text, Boolean, Float, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class InquiryStatus(enum.Enum):
    new = "new"
    contacted = "contacted"
    tour_scheduled = "tour_scheduled"
    applied = "applied"
    converted = "converted"  # became a tenant
    closed = "closed"


class RentalInquiry(Base):
    """A prospective renter's inquiry submitted from a property's public
    listing page — this is the subscriber-facing equivalent of the (owner-
    only) Lead CRM: finding *tenants* for a subscriber's vacant units,
    rather than finding *subscribers* for PropAgent AI itself. Fed by
    inbound capture (a public listing page + form), not scraping — there's
    no legitimate way to scrape the internet for "people who want to rent
    an apartment" the way there is for scraping business directories."""
    __tablename__ = "rental_inquiries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=True)

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    message = Column(Text, nullable=True)
    desired_move_in = Column(Date, nullable=True)

    status = Column(SAEnum(InquiryStatus), default=InquiryStatus.new, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Screening -- run before converting to a tenant, not after. Nullable
    # throughout: an un-screened inquiry (screened_at is None) is a normal,
    # expected state, not a missing/broken one.
    annual_income = Column(Float, nullable=True)
    credit_score = Column(Float, nullable=True)
    employment_status = Column(String(100), nullable=True)
    employer = Column(String(255), nullable=True)
    screening_approved = Column(Boolean, nullable=True)
    screening_score = Column(Float, nullable=True)
    screening_notes = Column(Text, nullable=True)
    screened_at = Column(DateTime, nullable=True)

    # Triage -- automatic, runs the moment the inquiry arrives (see
    # services/inquiry_triage_service.py), separate from screening above.
    # Screening needs the applicant to supply income/credit/employment
    # data by hand; triage needs nothing from them -- it's a quick read on
    # what they already wrote (message, move-in date, contact
    # completeness) to help a subscriber with a pile of inquiries know who
    # to call first, before anyone's filled out a screening form at all.
    priority_label = Column(String(10), nullable=True)  # 'hot' | 'warm' | 'cold'
    priority_score = Column(Integer, nullable=True)  # 0-100, informational only -- not a screening decision
    priority_reasoning = Column(Text, nullable=True)  # one short sentence, shown to the subscriber
    triaged_at = Column(DateTime, nullable=True)

    organization = relationship("Organization")
    property = relationship("Property")
    unit = relationship("Unit")

    @builtins.property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @builtins.property
    def property_name(self):
        return self.property.name if self.property else None

    @builtins.property
    def unit_number(self):
        return self.unit.unit_number if self.unit else None
