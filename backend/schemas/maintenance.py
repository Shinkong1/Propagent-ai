from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class MaintenanceCreate(BaseModel):
    property_id: UUID
    unit_id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None
    title: str
    description: str
    category: str = "other"
    priority: str = "medium"


class MaintenanceUpdate(BaseModel):
    status: Optional[str] = None
    vendor_id: Optional[UUID] = None
    scheduled_date: Optional[datetime] = None
    notes: Optional[str] = None
    actual_cost: Optional[float] = None


class MaintenanceResponse(BaseModel):
    id: UUID
    property_id: UUID
    property_name: Optional[str] = None
    unit_id: Optional[UUID] = None
    unit_number: Optional[str] = None
    vendor_id: Optional[UUID] = None
    vendor_name: Optional[str] = None
    title: str
    description: str
    category: str
    priority: str
    status: str
    notes: Optional[str] = None
    actual_cost: Optional[float] = None
    scheduled_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    ai_classification: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessage(BaseModel):
    message: str
    tenant_id: Optional[UUID] = None
    property_id: Optional[UUID] = None
    channel: str = "chat"
