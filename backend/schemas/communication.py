from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class SendCommunicationRequest(BaseModel):
    channel: str
    template: str = "custom"
    tenant_id: Optional[UUID] = None
    property_id: Optional[UUID] = None  # broadcast to all tenants at this property (community_announcement)
    ticket_id: Optional[UUID] = None  # for maintenance_update template
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None  # also doubles as announcement/emergency text for those templates


class CommunicationLogResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID]
    tenant_name: Optional[str] = None
    property_id: Optional[UUID]
    property_name: Optional[str] = None
    channel: str
    template: str
    recipient: str
    subject: Optional[str]
    body: str
    status: str
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
