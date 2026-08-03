"""Routes complaints, advice, and notes to the platform owner — from the AI
chat assistant and the Contact Us page — via real email (SMTP) when
configured, and always persists an OwnerMessage row so the owner can review
everything in the Owner Admin portal regardless of email delivery status.
"""
import logging
from typing import Optional
from sqlalchemy.orm import Session

from models.user import User, Organization
from models.owner_message import OwnerMessage, OwnerMessageSource
from services.communication_agent import send_email

logger = logging.getLogger(__name__)


def notify_owner(
    db: Session,
    source: OwnerMessageSource,
    subject: str,
    body: str,
    organization: Optional[Organization] = None,
    sender_name: Optional[str] = None,
    sender_email: Optional[str] = None,
) -> OwnerMessage:
    owner = db.query(User).filter(User.is_master == True, User.is_active == True).first()

    email_status = "logged_only"
    if owner and owner.email:
        org_line = f" (from {organization.name})" if organization else ""
        email_body = f"From: {sender_name or 'Unknown'} <{sender_email or 'no email on file'}>{org_line}\n\n{body}"
        email_status, _ = send_email(owner.email, f"[PropAgent AI] {subject}", email_body)
    else:
        logger.warning("No active master/owner account found — owner notification logged only.")

    message = OwnerMessage(
        source=source,
        organization_id=organization.id if organization else None,
        sender_name=sender_name,
        sender_email=sender_email,
        subject=subject,
        body=body,
        email_status=email_status,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
