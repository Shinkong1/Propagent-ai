from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime


# ── Public (no auth) ──

class PublicUnitOut(BaseModel):
    id: UUID
    unit_number: str
    bedrooms: int
    bathrooms: float
    square_feet: Optional[int] = None
    monthly_rent: float
    description: Optional[str] = None

    class Config:
        from_attributes = True


class PublicListingOut(BaseModel):
    id: UUID
    name: str
    address: str
    city: str
    state: str
    zip_code: str
    property_type: str
    description: Optional[str] = None
    units: List[PublicUnitOut]


class InquiryCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None
    desired_move_in: Optional[date] = None
    unit_id: Optional[UUID] = None


# ── Staff-facing ──

class InquiryOut(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None
    desired_move_in: Optional[date] = None
    status: str
    notes: Optional[str] = None
    property_id: UUID
    property_name: Optional[str] = None
    unit_id: Optional[UUID] = None
    unit_number: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InquiryUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
