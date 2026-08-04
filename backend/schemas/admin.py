from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class PlatformMetrics(BaseModel):
    total_organizations: int
    active_organizations: int
    total_users: int
    active_users: int
    total_properties: int
    total_units: int
    new_organizations_this_month: int
    ai_calls_this_period: int
    orgs_by_plan: dict
    estimated_mrr: float


class OrganizationAdminResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    plan: str
    is_active: bool
    is_master_org: bool
    user_count: int
    property_count: int
    unit_count: int
    ai_calls_this_period: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationAdminUpdate(BaseModel):
    plan: Optional[str] = None
    is_active: Optional[bool] = None


class UserAdminResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_master: bool
    is_active: bool
    organization_id: Optional[UUID]
    organization_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserAdminUpdate(BaseModel):
    is_active: Optional[bool] = None


class OwnerMessageResponse(BaseModel):
    id: UUID
    source: str
    organization_id: Optional[UUID]
    organization_name: Optional[str] = None
    sender_name: Optional[str]
    sender_email: Optional[str]
    subject: str
    body: str
    email_status: str
    created_at: datetime
    reply_body: Optional[str] = None
    reply_status: Optional[str] = None
    replied_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OwnerMessageReplyRequest(BaseModel):
    reply: str
