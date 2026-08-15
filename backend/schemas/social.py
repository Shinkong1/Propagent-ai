from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class SocialConnectionResponse(BaseModel):
    id: UUID
    platform: str
    page_id: str
    page_name: Optional[str] = None
    connected_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ComposePostRequest(BaseModel):
    connection_ids: List[UUID]
    message: str
    image_url: Optional[str] = None
    link: Optional[str] = None


class SocialPostResponse(BaseModel):
    id: UUID
    connection_id: UUID
    platform: Optional[str] = None
    property_id: Optional[UUID] = None
    message: str
    image_url: Optional[str] = None
    link: Optional[str] = None
    status: str
    platform_post_id: Optional[str] = None
    error_message: Optional[str] = None
    trigger: str
    created_at: datetime

    class Config:
        from_attributes = True


class SocialConfigResponse(BaseModel):
    facebook_enabled: bool
    linkedin_enabled: bool


class CreateDraftRequest(BaseModel):
    message: str
    image_url: Optional[str] = None
    link: Optional[str] = None
    property_id: Optional[UUID] = None


class ApproveDraftRequest(BaseModel):
    connection_ids: List[UUID]


class SocialPostDraftResponse(BaseModel):
    id: UUID
    property_id: Optional[UUID] = None
    message: str
    image_url: Optional[str] = None
    link: Optional[str] = None
    status: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True
