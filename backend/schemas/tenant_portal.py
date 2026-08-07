from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime

from schemas.password_policy import check_password_strength


class TenantLoginRequest(BaseModel):
    email: str
    password: str


class TenantActivateRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        error = check_password_strength(v)
        if error:
            raise ValueError(error)
        return v


class TenantForgotPasswordRequest(BaseModel):
    email: EmailStr


class TenantResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        error = check_password_strength(v)
        if error:
            raise ValueError(error)
        return v


class TenantAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_id: str
    full_name: str


class TenantMaintenanceCreate(BaseModel):
    title: str
    description: str
    category: str = "other"
    priority: str = "medium"


class TenantMaintenanceOut(BaseModel):
    id: UUID
    title: str
    description: str
    category: str
    priority: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class TenantPaymentOut(BaseModel):
    id: UUID
    amount: float
    due_date: date
    paid_date: Optional[date] = None
    status: str
    payment_method: Optional[str] = None
    property_name: Optional[str] = None
    unit_number: Optional[str] = None

    class Config:
        from_attributes = True


class TenantLeaseOut(BaseModel):
    id: UUID
    monthly_rent: float
    security_deposit: Optional[float] = None
    start_date: date
    end_date: date
    status: str
    property_name: Optional[str] = None
    property_address: Optional[str] = None
    unit_number: Optional[str] = None
    signed_at: Optional[datetime] = None
    signature_name: Optional[str] = None

    class Config:
        from_attributes = True


class LeaseSignRequest(BaseModel):
    full_name: str


class TenantMeOut(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    active_lease: Optional[TenantLeaseOut] = None
    portal_status: str
    organization_name: Optional[str] = None
    rent_payments_enabled: bool  # true only if the org has completed Stripe Connect onboarding


class TenantPaymentSessionOut(BaseModel):
    checkout_url: str
