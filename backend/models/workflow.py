import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
import enum
from database.base import Base


class WorkflowTrigger(enum.Enum):
    maintenance_created = "maintenance_created"
    lead_created = "lead_created"
    tenant_created = "tenant_created"
    payment_overdue = "payment_overdue"


class WorkflowRule(Base):
    __tablename__ = "workflow_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    trigger = Column(SAEnum(WorkflowTrigger), nullable=False)
    # [{"field": "priority", "operator": "equals", "value": "emergency"}, ...] — ANDed together
    conditions = Column(JSON, default=list, nullable=False)
    # [{"type": "notify_owner", "params": {...}}, {"type": "send_email", "params": {...}}, ...]
    actions = Column(JSON, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    run_count = Column(Integer, default=0, nullable=False)
    last_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
