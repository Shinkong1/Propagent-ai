import builtins
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class OwnerMessageSource(enum.Enum):
    chat = "chat"  # tenant/staff AI assistant chat box
    contact_form = "contact_form"  # Contact Us page


class OwnerMessage(Base):
    """Complaints, advice, and notes routed to the platform owner — from the AI
    chat assistant or the Contact Us page. Persisted regardless of email delivery
    status so the owner can review them in the Owner Admin portal even if SMTP
    isn't configured."""
    __tablename__ = "owner_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(SAEnum(OwnerMessageSource), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    sender_name = Column(String(255), nullable=True)
    sender_email = Column(String(255), nullable=True)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    email_status = Column(String(20), nullable=False)  # sent | failed | logged_only
    email_error = Column(Text, nullable=True)  # raw exception text when email_status == 'failed'
    created_at = Column(DateTime, default=datetime.utcnow)
    reply_body = Column(Text, nullable=True)
    reply_status = Column(String(20), nullable=True)  # sent | failed | logged_only
    reply_error = Column(Text, nullable=True)
    replied_at = Column(DateTime, nullable=True)

    organization = relationship("Organization")

    @builtins.property
    def organization_name(self):
        return self.organization.name if self.organization else None
