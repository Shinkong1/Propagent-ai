import uuid
from datetime import datetime, date
from sqlalchemy import Column, Float, Date, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class CollectionsActionType(enum.Enum):
    reminder = "reminder"
    late_fee = "late_fee"
    payment_plan_offer = "payment_plan_offer"
    manager_notification = "manager_notification"
    legal_prep = "legal_prep"


# Order of escalation, used to determine the current/target stage for a payment
STAGE_ORDER = [
    CollectionsActionType.reminder,
    CollectionsActionType.late_fee,
    CollectionsActionType.payment_plan_offer,
    CollectionsActionType.manager_notification,
    CollectionsActionType.legal_prep,
]


class CollectionsAction(Base):
    __tablename__ = "collections_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rent_payment_id = Column(UUID(as_uuid=True), ForeignKey("rent_payments.id"), nullable=False)
    action_type = Column(SAEnum(CollectionsActionType), nullable=False)
    action_date = Column(Date, default=date.today, nullable=False)
    amount = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    rent_payment = relationship("RentPayment", back_populates="collections_actions")
