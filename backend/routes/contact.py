"""Contact Us — sends a message directly to the platform owner."""
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from models.owner_message import OwnerMessageSource
from middleware.auth import get_current_user
from services.owner_notify import notify_owner

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/contact", tags=["contact"])


class ContactRequest(BaseModel):
    subject: str
    message: str


@router.post("/")
async def send_contact_message(
    payload: ContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = notify_owner(
        db=db,
        source=OwnerMessageSource.contact_form,
        subject=payload.subject,
        body=payload.message,
        organization=current_user.organization,
        sender_name=current_user.full_name,
        sender_email=current_user.email,
    )
    return {"status": result.email_status}
