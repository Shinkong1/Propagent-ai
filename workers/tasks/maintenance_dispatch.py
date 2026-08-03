"""Maintenance dispatch Celery tasks"""
import logging
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="workers.tasks.maintenance_dispatch.notify_vendor")
def notify_vendor(ticket_id: str, vendor_id: str):
    """Send notification to vendor about new ticket"""
    logger.info(f"Notifying vendor {vendor_id} about ticket {ticket_id}")
    # Would send SMS via Twilio or email
    return {"status": "notified", "ticket_id": ticket_id}


@celery_app.task(name="workers.tasks.maintenance_dispatch.notify_tenant")
def notify_tenant(ticket_id: str, tenant_id: str, message: str):
    """Send status update to tenant"""
    logger.info(f"Notifying tenant {tenant_id}: {message}")
    return {"status": "notified"}
