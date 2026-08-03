import builtins
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Date, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class ComplianceCategory(enum.Enum):
    rental_license = "rental_license"
    fire_inspection = "fire_inspection"
    insurance = "insurance"
    smoke_detector = "smoke_detector"
    lead_paint = "lead_paint"
    housing_regulation = "housing_regulation"
    osha = "osha"
    accessibility = "accessibility"
    other = "other"


class ComplianceStatus(enum.Enum):
    active = "active"
    resolved = "resolved"
    waived = "waived"


class ComplianceItem(Base):
    __tablename__ = "compliance_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    category = Column(SAEnum(ComplianceCategory), default=ComplianceCategory.other, nullable=False)
    title = Column(String(255), nullable=False)
    issuing_authority = Column(String(255), nullable=True)
    reference_number = Column(String(100), nullable=True)
    issued_date = Column(Date, nullable=True)
    expiration_date = Column(Date, nullable=False)
    status = Column(SAEnum(ComplianceStatus), default=ComplianceStatus.active, nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = relationship("Property", back_populates="compliance_items")

    @builtins.property
    def property_name(self) -> str:
        return self.property.name if self.property else None

    @builtins.property
    def days_until_expiration(self) -> int:
        return (self.expiration_date - date.today()).days

    @builtins.property
    def urgency(self) -> str:
        if self.status != ComplianceStatus.active:
            return self.status.value
        days = self.days_until_expiration
        if days < 0:
            return "expired"
        if days <= 14:
            return "critical"
        if days <= 45:
            return "warning"
        if days <= 90:
            return "upcoming"
        return "ok"
