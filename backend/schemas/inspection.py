from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date


class InspectionCreate(BaseModel):
    property_id: UUID
    unit_id: Optional[UUID] = None
    inspection_type: str = "other"
    inspection_date: date
    inspector_name: Optional[str] = None
    notes: Optional[str] = None


class InspectionUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class InspectionPhotoResponse(BaseModel):
    id: UUID
    room_area: str
    analyzed: bool
    overall_condition: Optional[str]
    issues: List[dict] = []
    analysis_confidence: Optional[float]
    estimated_cost: float
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionResponse(BaseModel):
    id: UUID
    property_id: UUID
    property_name: Optional[str] = None
    unit_id: Optional[UUID]
    unit_number: Optional[str] = None
    inspection_type: str
    inspection_date: date
    inspector_name: Optional[str]
    status: str
    notes: Optional[str]
    total_issues: int
    estimated_repair_cost: float
    photos: List[InspectionPhotoResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionListItem(BaseModel):
    id: UUID
    property_id: UUID
    property_name: Optional[str] = None
    unit_id: Optional[UUID]
    unit_number: Optional[str] = None
    inspection_type: str
    inspection_date: date
    status: str
    total_issues: int
    estimated_repair_cost: float
    created_at: datetime

    class Config:
        from_attributes = True
