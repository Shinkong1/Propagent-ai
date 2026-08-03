"""Platform-level tracking — organization lifecycle events, error logs, and AI
call logs. This is the real, honest data backbone for the Owner Admin business
dashboard: churn/LTV/retention are computed FROM these logged events rather
than fabricated, so a fresh install correctly shows 'not enough history yet'
until events accumulate.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
import enum
from database.base import Base


class OrgEventType(enum.Enum):
    signup = "signup"
    plan_changed = "plan_changed"
    activated = "activated"
    deactivated = "deactivated"
    subscription_created = "subscription_created"
    subscription_updated = "subscription_updated"
    subscription_canceled = "subscription_canceled"
    payment_failed = "payment_failed"


class OrganizationEvent(Base):
    __tablename__ = "organization_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    event_type = Column(SAEnum(OrgEventType), nullable=False)
    from_plan = Column(String(20), nullable=True)
    to_plan = Column(String(20), nullable=True)
    subscription_status = Column(String(30), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    path = Column(String(500), nullable=True)
    method = Column(String(10), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AICallLog(Base):
    __tablename__ = "ai_call_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    feature = Column(String(50), nullable=False)  # e.g. "maintenance_chat", "executive_query"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
