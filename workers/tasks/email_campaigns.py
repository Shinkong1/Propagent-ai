"""Email campaign Celery tasks"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from workers.celery_app import celery_app
from config import settings

logger = logging.getLogger(__name__)


@celery_app.task(name="workers.tasks.email_campaigns.send_followups")
def send_followups():
    """Send scheduled follow-up emails"""
    from database.base import SessionLocal
    from models.lead import OutreachEmail
    
    db = SessionLocal()
    try:
        pending = db.query(OutreachEmail).filter(
            OutreachEmail.status == "queued"
        ).limit(50).all()
        
        sent = 0
        for email in pending:
            try:
                _send_email(email.lead.email, email.subject, email.body)
                email.status = "sent"
                email.sent_at = datetime.utcnow()
                sent += 1
            except Exception as e:
                logger.error(f"Failed to send email {email.id}: {e}")
        
        db.commit()
        logger.info(f"Sent {sent} outreach emails")
        return {"sent": sent}
    finally:
        db.close()


def _send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email via SMTP"""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info(f"SMTP not configured — would send to {to_email}: {subject}")
        return True
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain"))
    
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())
    return True
