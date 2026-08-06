"""Contact Us — sends a message directly to the platform owner."""
import logging
from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from models.owner_message import OwnerMessageSource
from middleware.auth import get_current_user
from middleware.rate_limit import limiter
from services.owner_notify import notify_owner

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/contact", tags=["contact"])


class ContactRequest(BaseModel):
    subject: str
    message: str


class SalesContactRequest(BaseModel):
    name: str
    email: EmailStr
    company: str = ""
    message: str


@router.post("/")
async def send_contact_message(
    payload: ContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # notify_owner does a blocking SMTP call under the hood — run it off the
    # event loop so a slow/hung mail server doesn't stall every other request
    # on this process (see services/communication_agent.py send_email).
    result = await run_in_threadpool(
        notify_owner,
        db=db,
        source=OwnerMessageSource.contact_form,
        subject=payload.subject,
        body=payload.message,
        organization=current_user.organization,
        sender_name=current_user.full_name,
        sender_email=current_user.email,
    )
    return {"status": result.email_status}


@router.post("/sales")
@limiter.limit("5/minute")
async def send_sales_inquiry(request: Request, payload: SalesContactRequest, db: Session = Depends(get_db)):
    """Public — no account required. This is the marketing site's 'talk to
    us before I sign up' path, distinct from the authenticated in-app
    support form above."""
    subject = f"Sales inquiry from {payload.name}" + (f" ({payload.company})" if payload.company else "")
    body = payload.message
    if payload.company:
        body = f"Company: {payload.company}\n\n{body}"
    result = await run_in_threadpool(
        notify_owner,
        db=db,
        source=OwnerMessageSource.sales_inquiry,
        subject=subject,
        body=body,
        organization=None,
        sender_name=payload.name,
        sender_email=payload.email,
    )
    return {"status": result.email_status}
