from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, date


class RentPaymentCreate(BaseModel):
    lease_id: UUID
    amount: float
    due_date: date
    paid_date: Optional[date] = None
    status: str = "paid"
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class RentPaymentResponse(BaseModel):
    id: UUID
    lease_id: UUID
    tenant_name: Optional[str] = None
    property_name: Optional[str] = None
    unit_number: Optional[str] = None
    amount: float
    due_date: date
    paid_date: Optional[date]
    status: str
    payment_method: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    property_id: UUID
    vendor_id: Optional[UUID] = None
    category: str = "other"
    amount: float
    expense_date: date
    description: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: UUID
    property_id: UUID
    vendor_id: Optional[UUID]
    vendor_name: Optional[str] = None
    category: str
    amount: float
    expense_date: date
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
