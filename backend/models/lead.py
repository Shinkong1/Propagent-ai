import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class LeadStatus(enum.Enum):
    new = "new"
    contacted = "contacted"
    interested = "interested"
    demo_scheduled = "demo_scheduled"
    negotiating = "negotiating"
    closed_won = "closed_won"
    closed_lost = "closed_lost"


class LeadSource(enum.Enum):
    google_maps = "google_maps"
    linkedin = "linkedin"
    zillow = "zillow"
    referral = "referral"
    website = "website"
    cold_outreach = "cold_outreach"
    manual = "manual"


class ConversationChannel(enum.Enum):
    chat = "chat"
    voice = "voice"
    email = "email"
    sms = "sms"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    company = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(500), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    address = Column(String(500), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    num_properties = Column(Integer, nullable=True)
    property_types = Column(Text, nullable=True)  # JSON
    source = Column(SAEnum(LeadSource), default=LeadSource.manual)
    status = Column(SAEnum(LeadStatus), default=LeadStatus.new)
    score = Column(Integer, default=0)  # AI-generated lead score 0-100
    notes = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    last_contacted = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="leads")
    outreach_emails = relationship("OutreachEmail", back_populates="lead")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=True)
    channel = Column(SAEnum(ConversationChannel), default=ConversationChannel.chat)
    session_id = Column(String(255), nullable=True)  # For voice calls
    messages = Column(Text, nullable=False, default="[]")  # JSON array
    intent_detected = Column(String(100), nullable=True)
    ticket_created = Column(Boolean, default=False)
    ticket_id = Column(UUID(as_uuid=True), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="conversations")


class OutreachEmail(Base):
    __tablename__ = "outreach_emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    # Optional HTML version sent alongside `body` (multipart/alternative) --
    # nullable so existing queued rows (written before this column existed)
    # still send fine as plain-text-only, exactly as they did before.
    html_body = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # pending, sent, opened, replied, bounced
    sent_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    sequence_step = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="outreach_emails")
