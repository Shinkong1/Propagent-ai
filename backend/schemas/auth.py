from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    organization_name: str
    referral_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    organization_id: Optional[str]
    organization_name: Optional[str] = None
    full_name: str
    email: str
    plan: str
    language: str = "en"
    theme: str = "dark"
    timezone: str = "America/New_York"
    currency: str = "USD"
    notify_email_enabled: bool = True
    notify_sms_enabled: bool = True
    is_master: bool = False
    role: str = "owner"


class LanguageUpdate(BaseModel):
    language: str


class ThemeUpdate(BaseModel):
    theme: str


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    notify_email_enabled: Optional[bool] = None
    notify_sms_enabled: Optional[bool] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    organization_id: Optional[UUID]
    
    class Config:
        from_attributes = True
