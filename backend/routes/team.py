"""Team management — invite/list/role-change/deactivate users within an org.
Signup always creates exactly one owner + org together; this is the only way
for a second user to ever join that org, so it's the prerequisite for RBAC to
mean anything in practice."""
import logging
import secrets
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, UserRole
from schemas.team import TeamMemberResponse, TeamMemberInvite, TeamMemberRoleUpdate, TeamInviteResponse
from middleware.auth import get_current_user, hash_password
from middleware.plan_gate import require_role
from services.communication_agent import send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/team", tags=["team"])

INVITABLE_ROLES = {"manager", "staff"}


@router.get("/members", response_model=List[TeamMemberResponse])
async def list_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    members = db.query(User).filter(User.organization_id == current_user.organization_id).all()
    return [
        TeamMemberResponse(
            id=str(m.id), email=m.email, first_name=m.first_name, last_name=m.last_name,
            role=m.role.value, is_active=m.is_active,
        )
        for m in members
    ]


@router.post("/members", response_model=TeamInviteResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(
    payload: TeamMemberInvite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.manager)),
):
    if payload.role not in INVITABLE_ROLES:
        raise HTTPException(status_code=422, detail="Role must be 'manager' or 'staff'")
    if payload.role == "manager" and current_user.role != UserRole.owner and not current_user.is_master:
        raise HTTPException(status_code=403, detail="Only an owner can invite a manager.")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    temp_password = secrets.token_urlsafe(9)
    member = User(
        organization_id=current_user.organization_id,
        email=payload.email,
        hashed_password=hash_password(temp_password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=UserRole(payload.role),
        is_active=True,
        is_verified=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    org_name = current_user.organization.name if current_user.organization else "your team"
    email_body = (
        f"You've been added to {org_name} on PropAgent AI as a {payload.role}.\n\n"
        f"Login email: {payload.email}\n"
        f"Temporary password: {temp_password}\n\n"
        f"Sign in and change your password from Settings > Security."
    )
    email_status, _ = send_email(payload.email, f"You've been added to {org_name} on PropAgent AI", email_body)

    return TeamInviteResponse(
        member=TeamMemberResponse(
            id=str(member.id), email=member.email, first_name=member.first_name,
            last_name=member.last_name, role=member.role.value, is_active=member.is_active,
        ),
        email_status=email_status,
        temporary_password=None if email_status == "sent" else temp_password,
    )


@router.patch("/members/{user_id}/role", response_model=TeamMemberResponse)
async def change_role(
    user_id: UUID,
    payload: TeamMemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.owner)),
):
    if payload.role not in INVITABLE_ROLES:
        raise HTTPException(status_code=422, detail="Role must be 'manager' or 'staff'")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    member = db.query(User).filter(
        User.id == user_id, User.organization_id == current_user.organization_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if member.role == UserRole.owner:
        raise HTTPException(status_code=400, detail="Cannot change the owner's role")

    member.role = UserRole(payload.role)
    db.commit()
    db.refresh(member)
    return TeamMemberResponse(
        id=str(member.id), email=member.email, first_name=member.first_name,
        last_name=member.last_name, role=member.role.value, is_active=member.is_active,
    )


@router.patch("/members/{user_id}/deactivate", response_model=TeamMemberResponse)
async def toggle_active(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _=Depends(require_role(UserRole.manager)),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    member = db.query(User).filter(
        User.id == user_id, User.organization_id == current_user.organization_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    if member.role == UserRole.owner and not current_user.is_master:
        raise HTTPException(status_code=403, detail="Cannot deactivate the account owner")

    member.is_active = not member.is_active
    db.commit()
    db.refresh(member)
    return TeamMemberResponse(
        id=str(member.id), email=member.email, first_name=member.first_name,
        last_name=member.last_name, role=member.role.value, is_active=member.is_active,
    )
