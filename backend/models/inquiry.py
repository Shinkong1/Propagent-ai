import builtins
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Text, Enum as SAEnum
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
