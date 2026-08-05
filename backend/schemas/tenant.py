from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime, date


class TenantCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    annual_income: Optional[float] = None
    employment_status: Optional[str] = None
    employer: Optional[str] = None


class TenantUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    annual_income: Optional[float] = None
    employment_status: Optional[str] = None
    employer: Optional[str] = None


class TenantResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    is_active: bool
    screening_approved: Optional[bool]
    property_id: Optional[UUID] = None
    property_name: Optional[str] = None
    unit_number: Optional[str] = None
    active_lease_id: Optional[UUID] = None
    portal_status: str = "not_invited"
    created_at: datetime

    class Config:
        from_attributes = True


class LeaseCreate(BaseModel):
    tenant_id: UUID
    unit_id: UUID
    monthly_rent: float
    security_deposit: Optional[float] = None
    start_date: date
    end_date: date


class ScreeningRequest(BaseModel):
    tenant_id: UUID
    annual_income: float
    credit_score: Optional[float] = None
    employment_status: str
    employer: str
    references: Optional[list] = None
