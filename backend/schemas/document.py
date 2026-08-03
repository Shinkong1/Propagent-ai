from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, date


class DocumentResponse(BaseModel):
    id: UUID
    property_id: Optional[UUID]
    property_name: Optional[str] = None
    category: str
    title: str
    filename: str
    file_size: Optional[int]
    mime_type: Optional[str]
    extraction_status: str
    extracted_fields: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentSearchResult(BaseModel):
    id: UUID
    title: str
    category: str
    property_name: Optional[str] = None
    snippet: str
    created_at: datetime


class DocumentGenerateRequest(BaseModel):
    document_type: str  # lease_agreement | lease_renewal_notice | rent_increase_notice | move_out_notice
    tenant_id: UUID
    new_end_date: Optional[date] = None    # lease_renewal_notice
    new_rent: Optional[float] = None       # rent_increase_notice
    effective_date: Optional[date] = None  # rent_increase_notice
    move_out_date: Optional[date] = None   # move_out_notice
