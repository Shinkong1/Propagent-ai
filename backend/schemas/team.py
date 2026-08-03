from typing import Optional
from pydantic import BaseModel, EmailStr


class TeamMemberResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class TeamMemberInvite(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: str  # "manager" or "staff" — only owner/manager can invite, and never as "owner"


class TeamMemberRoleUpdate(BaseModel):
    role: str


class TeamInviteResponse(BaseModel):
    member: TeamMemberResponse
    email_status: str
    temporary_password: Optional[str] = None  # only returned when email delivery wasn't possible
