from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class PropertyCreate(BaseModel):
    name: str
    address: str
    city: str
    state: str
    zip_code: str
    property_type: str = "apartment"
    total_units: int = 1
    year_built: Optional[int] = None
    description: Optional[str] = None
    purchase_price: Optional[float] = None
    mortgage_payment: Optional[float] = None


class PropertyResponse(BaseModel):
    id: UUID
    name: str
    address: str
    city: str
    state: str
    zip_code: str
    property_type: str
    total_units: int
    year_built: Optional[int]
    description: Optional[str]
    purchase_price: Optional[float] = None
    mortgage_payment: Optional[float] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    property_type: Optional[str] = None
    year_built: Optional[int] = None
    description: Optional[str] = None
    purchase_price: Optional[float] = None
    mortgage_payment: Optional[float] = None


class UnitCreate(BaseModel):
    unit_number: str
    bedrooms: int = 1
    bathrooms: float = 1.0
    square_feet: Optional[int] = None
    monthly_rent: float
    floor: Optional[int] = None


class UnitUpdate(BaseModel):
    unit_number: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    square_feet: Optional[int] = None
    monthly_rent: Optional[float] = None
    floor: Optional[int] = None
    is_occupied: Optional[bool] = None
    is_available: Optional[bool] = None


class UnitResponse(BaseModel):
    id: UUID
    unit_number: str
    bedrooms: int
    bathrooms: float
    square_feet: Optional[int]
    monthly_rent: float
    is_occupied: bool
    is_available: bool
    tenant_name: Optional[str] = None

    class Config:
        from_attributes = True
