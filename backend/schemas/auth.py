from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from uuid import UUID

from schemas.password_policy import check_password_strength


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str
    last_name: str
    organization_name: str
    referral_code: Optional[str] = None

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        error = check_password_strength(v)
        if error:
            raise ValueError(error)
        return v


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
    is_verified: bool = True


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
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        error = check_password_strength(v)
        if error:
            raise ValueError(error)
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        error = check_password_strength(v)
        if error:
            raise ValueError(error)
        return v


class VerifyEmailRequest(BaseModel):
    token: str


class ProfileUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    current_password: str  # required whenever email changes -- this is your login credential


class UserResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    organization_id: Optional[UUID]
    
    class Config:
        from_attributes = True
