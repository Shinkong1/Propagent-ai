from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, date


class CollectionsActionCreate(BaseModel):
    action_type: str
    amount: Optional[float] = None
    notes: Optional[str] = None


class CollectionsActionResponse(BaseModel):
    id: UUID
    rent_payment_id: UUID
    action_type: str
    action_date: date
    amount: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CollectionsSettingsUpdate(BaseModel):
    collections_day_reminder: Optional[int] = None
    collections_day_late_fee: Optional[int] = None
    collections_day_payment_plan: Optional[int] = None
    collections_day_manager_notify: Optional[int] = None
    collections_day_legal_prep: Optional[int] = None
    collections_late_fee_percent: Optional[float] = None
