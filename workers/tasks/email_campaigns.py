"""Email campaign Celery tasks"""
import logging
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="workers.tasks.email_campaigns.send_followups")
def send_followups():
    """Send scheduled follow-up emails. Only relevant where a Celery worker
    + beat process is actually running (local dev via docker-compose) —
    production instead uses the /internal/cron/process-outreach-queue HTTP
    endpoint via an external scheduler, since no paid background worker is
    deployed on Render. Both paths call the same shared logic."""
    from database.base import SessionLocal
    from services.lead_service import process_outreach_queue

    db = SessionLocal()
    try:
        return process_outreach_queue(db)
    finally:
        db.close()
