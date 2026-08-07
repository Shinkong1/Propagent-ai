"""Real, persisted Voice AI call history — replaces what used to be only an
in-memory (Redis, 1-hour TTL) per-call session that was deleted the moment
the call ended. Nothing about a call survived past its own lifetime before
this; the Voice AI dashboard had no real data to show because none existed.
"""
import builtins
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database.base import Base


class VoiceCall(Base):
    __tablename__ = "voice_calls"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    call_sid = Column(String(64), unique=True, nullable=False, index=True)

    # All nullable: an unrecognized caller (not a known tenant) can't be
    # attributed to an organization under the current shared-Twilio-number
    # setup -- that call is still logged, just without these.
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=True)

    from_number = Column(String(30), nullable=True)
    to_number = Column(String(30), nullable=True)
    status = Column(String(20), nullable=False, default="in_progress")  # in_progress | completed | failed | busy | no-answer | canceled
    duration_seconds = Column(Integer, nullable=True)

    transcript = Column(Text, nullable=True)  # JSON-encoded [{"role", "content"}, ...]
    intent = Column(String(50), nullable=True)  # last-known agent: maintenance | leasing | screening | tenant_support | sales
    outcome_summary = Column(Text, nullable=True)  # the AI's final response, as a human-readable summary

    owner_notified = Column(Boolean, default=False, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    organization = relationship("Organization")
    tenant = relationship("Tenant")
    property = relationship("Property")

    @builtins.property
    def tenant_name(self):
        return self.tenant.full_name if self.tenant else None

    @builtins.property
    def property_name(self):
        return self.property.name if self.property else None
