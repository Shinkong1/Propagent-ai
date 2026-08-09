import builtins
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Float, Boolean, DateTime, Date, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class PaymentStatus(enum.Enum):
    pending = "pending"
    paid = "paid"
    late = "late"
    partial = "partial"
    missed = "missed"


class PaymentMethod(enum.Enum):
    card = "card"
    ach = "ach"
    check = "check"
    cash = "cash"
    other = "other"


class ExpenseCategory(enum.Enum):
    maintenance = "maintenance"
    utilities = "utilities"
    insurance = "insurance"
    property_tax = "property_tax"
    management_fee = "management_fee"
    mortgage = "mortgage"
    capital_improvement = "capital_improvement"
    other = "other"


class RentPayment(Base):
    __tablename__ = "rent_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id = Column(UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False)
    amount = Column(Float, nullable=False)
    due_date = Column(Date, nullable=False, default=date.today)
    paid_date = Column(Date, nullable=True)
    status = Column(SAEnum(PaymentStatus), default=PaymentStatus.pending)
    payment_method = Column(SAEnum(PaymentMethod), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # "Payment Overdue" was a selectable trigger in the no-code workflow
    # builder that silently never fired -- nothing anywhere ever called
    # run_workflows(..., WorkflowTrigger.payment_overdue, ...). Fixed via
    # a periodic cron check (services/collections_agent.py's
    # check_overdue_payment_workflows, routes/internal_cron.py); this flag
    # is what makes that idempotent -- fires once per payment the moment
    # it first goes overdue, never again on later cron runs.
    overdue_workflow_fired = Column(Boolean, default=False, nullable=False)

    lease = relationship("Lease", back_populates="rent_payments")
    collections_actions = relationship("CollectionsAction", back_populates="rent_payment", cascade="all, delete-orphan")

    @property
    def tenant_name(self):
        return self.lease.tenant.full_name if self.lease and self.lease.tenant else None

    @property
    def property_name(self):
        return self.lease.unit.property.name if self.lease and self.lease.unit and self.lease.unit.property else None

    @property
    def unit_number(self):
        return self.lease.unit.unit_number if self.lease and self.lease.unit else None


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True)
    category = Column(SAEnum(ExpenseCategory), default=ExpenseCategory.other)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False, default=date.today)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property", back_populates="expenses")
    vendor = relationship("Vendor", back_populates="expenses")

    @builtins.property
    def vendor_name(self):
        return self.vendor.name if self.vendor else None
