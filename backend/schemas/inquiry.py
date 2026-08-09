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


class PublicListingSummary(BaseModel):
    """One card in the public /listings directory — deliberately lighter
    than PublicListingOut (no address, no per-unit breakdown) since this
    is shown to anonymous browsers before they've clicked into a listing."""
    id: UUID
    name: str
    city: str
    state: str
    property_type: str
    unit_count: int
    min_rent: float
    max_rent: float
    min_bedrooms: int
    max_bedrooms: int
    # When the listing was made public (Property.public_listed_at) -- None if
    # it predates this field or was never explicitly stamped. Powers the
    # "New" badge and the newest-first sort on the public directory.
    public_listed_at: Optional[datetime] = None


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
    annual_income: Optional[float] = None
    credit_score: Optional[float] = None
    employment_status: Optional[str] = None
    employer: Optional[str] = None
    screening_approved: Optional[bool] = None
    screening_score: Optional[float] = None
    screening_notes: Optional[str] = None
    screened_at: Optional[datetime] = None
    priority_label: Optional[str] = None
    priority_score: Optional[int] = None
    priority_reasoning: Optional[str] = None
    triaged_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InquiryUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class InquiryScreenRequest(BaseModel):
    annual_income: float
    monthly_rent: float
    credit_score: Optional[float] = None
    employment_status: str
    employer: Optional[str] = None
