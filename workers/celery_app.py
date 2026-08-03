"""Celery worker configuration"""
from celery import Celery
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import settings

celery_app = Celery(
    "propagent",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "workers.tasks.lead_scraping",
        "workers.tasks.email_campaigns",
        "workers.tasks.maintenance_dispatch",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        "scrape-leads-daily": {
            "task": "workers.tasks.lead_scraping.daily_scrape",
            "schedule": 86400,  # 24 hours
        },
        "send-followups-hourly": {
            "task": "workers.tasks.email_campaigns.send_followups",
            "schedule": 3600,  # 1 hour
        },
    }
)
