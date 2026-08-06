import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text, Date, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class LeaseStatus(enum.Enum):
    active = "active"
    expired = "expired"
    terminated = "terminated"
    pending = "pending"


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    ssn_last4 = Column(String(4), nullable=True)
    annual_income = Column(Float, nullable=True)
    credit_score = Column(Float, nullable=True)
    employment_status = Column(String(100), nullable=True)
    employer = Column(String(255), nullable=True)
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    screening_approved = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Tenant portal login — separate from the staff User/JWT system entirely.
    # A tenant only gets a password once invited and they activate it themselves.
    hashed_password = Column(String(255), nullable=True)
    portal_invite_token = Column(String(255), nullable=True, unique=True, index=True)
    portal_invite_expires_at = Column(DateTime, nullable=True)
    portal_invited_at = Column(DateTime, nullable=True)
    portal_activated_at = Column(DateTime, nullable=True)

    @property
    def portal_status(self) -> str:
        if self.portal_activated_at:
            return "active"
        if self.portal_invited_at:
            return "invited"
        return "not_invited"

    leases = relationship("Lease", back_populates="tenant")
    maintenance_tickets = relationship("MaintenanceTicket", back_populates="tenant")
    conversations = relationship("Conversation", back_populates="tenant")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def active_lease(self):
        for lease in self.leases:
            if lease.status == LeaseStatus.active:
                return lease
        return None

    @property
    def property_id(self):
        lease = self.active_lease
        return lease.unit.property_id if lease and lease.unit else None

    @property
    def property_name(self):
        lease = self.active_lease
        return lease.unit.property.name if lease and lease.unit and lease.unit.property else None

    @property
    def unit_number(self):
        lease = self.active_lease
        return lease.unit.unit_number if lease and lease.unit else None

    @property
    def active_lease_id(self):
        lease = self.active_lease
        return lease.id if lease else None


class Lease(Base):
    __tablename__ = "leases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=False)
    monthly_rent = Column(Float, nullable=False)
    security_deposit = Column(Float, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(SAEnum(LeaseStatus), default=LeaseStatus.pending)
    lease_document_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    # Lightweight e-signature: a typed full name + timestamp + IP, captured
    # by the tenant in their portal. Not a DocuSign-grade signature service,
    # but a real, timestamped acceptance record under the US ESIGN Act's
    # "intent to sign" standard -- enough for most residential leases.
    signed_at = Column(DateTime, nullable=True)
    signature_name = Column(String(200), nullable=True)
    signature_ip = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="leases")
    unit = relationship("Unit", back_populates="leases")
    rent_payments = relationship("RentPayment", back_populates="lease", cascade="all, delete-orphan")
