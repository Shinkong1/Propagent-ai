import builtins
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class CommunicationChannel(enum.Enum):
    sms = "sms"
    email = "email"
    in_app = "in_app"


class CommunicationTemplate(enum.Enum):
    lease_renewal = "lease_renewal"
    maintenance_update = "maintenance_update"
    rent_reminder = "rent_reminder"
    community_announcement = "community_announcement"
    emergency_notification = "emergency_notification"
    custom = "custom"


class CommunicationStatus(enum.Enum):
    sent = "sent"
    failed = "failed"
    logged_only = "logged_only"  # channel not configured — recorded but not actually delivered


class CommunicationLog(Base):
    __tablename__ = "communication_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=True)
    channel = Column(SAEnum(CommunicationChannel), nullable=False)
    template = Column(SAEnum(CommunicationTemplate), default=CommunicationTemplate.custom, nullable=False)
    recipient = Column(String(255), nullable=False)  # phone or email actually targeted
    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    status = Column(SAEnum(CommunicationStatus), nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant")
    property = relationship("Property")

    @builtins.property
    def tenant_name(self):
        return self.tenant.full_name if self.tenant else None

    @builtins.property
    def property_name(self):
        return self.property.name if self.property else None
