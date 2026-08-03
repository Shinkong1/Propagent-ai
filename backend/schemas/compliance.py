from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, date


class ComplianceItemCreate(BaseModel):
    property_id: UUID
    category: str = "other"
    title: str
    issuing_authority: Optional[str] = None
    reference_number: Optional[str] = None
    issued_date: Optional[date] = None
    expiration_date: date
    notes: Optional[str] = None


class ComplianceItemUpdate(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    issuing_authority: Optional[str] = None
    reference_number: Optional[str] = None
    issued_date: Optional[date] = None
    expiration_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ComplianceItemResponse(BaseModel):
    id: UUID
    property_id: UUID
    property_name: Optional[str] = None
    category: str
    title: str
    issuing_authority: Optional[str]
    reference_number: Optional[str]
    issued_date: Optional[date]
    expiration_date: date
    status: str
    notes: Optional[str]
    days_until_expiration: int
    urgency: str
    created_at: datetime

    class Config:
        from_attributes = True
