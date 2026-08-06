"""Email campaign Celery tasks"""
import logging
from datetime import datetime
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="workers.tasks.email_campaigns.send_followups")
def send_followups():
    """Send scheduled follow-up emails"""
    from database.base import SessionLocal
    from models.lead import OutreachEmail
    # Reuse the one real send_email implementation (backend/services/
    # communication_agent.py) instead of a second, separately-maintained
    # copy — that copy had no connection timeout and no IPv4-forcing fix,
    # meaning it would hit the exact same "Network is unreachable" issue
    # that took most of a debugging session to track down elsewhere.
    from services.communication_agent import send_email

    db = SessionLocal()
    try:
        pending = db.query(OutreachEmail).filter(
            OutreachEmail.status == "queued"
        ).limit(50).all()

        sent = 0
        for email in pending:
            try:
                status, error = send_email(email.lead.email, email.subject, email.body)
                email.status = status
                if status == "sent":
                    email.sent_at = datetime.utcnow()
                    sent += 1
                else:
                    logger.warning(f"Outreach email {email.id} not sent (status={status}): {error}")
            except Exception as e:
                logger.error(f"Failed to send email {email.id}: {e}")

        db.commit()
        logger.info(f"Sent {sent} outreach emails")
        return {"sent": sent}
    finally:
        db.close()
