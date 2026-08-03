import builtins
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class TicketPriority(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    emergency = "emergency"


class TicketStatus(enum.Enum):
    open = "open"
    in_progress = "in_progress"
    waiting_vendor = "waiting_vendor"
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"


class TicketCategory(enum.Enum):
    plumbing = "plumbing"
    electrical = "electrical"
    hvac = "hvac"
    appliance = "appliance"
    structural = "structural"
    pest_control = "pest_control"
    cleaning = "cleaning"
    landscaping = "landscaping"
    other = "other"


class MaintenanceTicket(Base):
    __tablename__ = "maintenance_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(SAEnum(TicketCategory), default=TicketCategory.other)
    priority = Column(SAEnum(TicketPriority), default=TicketPriority.medium)
    status = Column(SAEnum(TicketStatus), default=TicketStatus.open)
    ai_classification = Column(Text, nullable=True)  # AI analysis
    scheduled_date = Column(DateTime, nullable=True)
    completed_date = Column(DateTime, nullable=True)
    estimated_cost = Column(Float, nullable=True)
    actual_cost = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    images = Column(Text, nullable=True)  # JSON array of URLs
    tenant_notified = Column(Boolean, default=False)
    vendor_notified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = relationship("Property", back_populates="maintenance_tickets")
    unit = relationship("Unit", back_populates="maintenance_tickets")
    tenant = relationship("Tenant", back_populates="maintenance_tickets")
    vendor = relationship("Vendor", back_populates="tickets")

    @builtins.property
    def property_name(self) -> str:
        return self.property.name if self.property else None

    @builtins.property
    def unit_number(self) -> str:
        return self.unit.unit_number if self.unit else None

    @builtins.property
    def vendor_name(self) -> str:
        return self.vendor.name if self.vendor else None


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    company = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    specialties = Column(Text, nullable=True)  # JSON array: ["plumbing","electrical"]
    hourly_rate = Column(Float, nullable=True)
    rating = Column(Float, nullable=True)
    is_preferred = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tickets = relationship("MaintenanceTicket", back_populates="vendor")
    expenses = relationship("Expense", back_populates="vendor")
