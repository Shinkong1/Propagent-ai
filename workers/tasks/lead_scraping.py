"""Lead scraping Celery tasks"""
import logging
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="workers.tasks.lead_scraping.daily_scrape")
def daily_scrape():
    """Daily automated lead scraping from all sources"""
    logger.info("Starting daily lead scrape")
    # Would call scraper implementations here
    return {"status": "completed"}


def scrape_leads_task(org_id: str, source: str, location: str):
    """Scrape leads for a specific org (called as background task)"""
    logger.info(f"Scraping {source} leads for org {org_id} in {location}")
    from database.base import SessionLocal
    from models.lead import Lead, LeadSource, LeadStatus
    
    # Demo data — in production would call real scraper APIs
    demo_leads = [
        {"first_name": "John", "last_name": "Smith", "company": "Smith Property Management",
         "email": "john@smithpm.com", "num_properties": 12, "city": location or "Austin", "state": "TX"},
        {"first_name": "Sarah", "last_name": "Johnson", "company": "Johnson Realty Group",
         "email": "sjohnson@jrg.com", "num_properties": 28, "city": location or "Austin", "state": "TX"},
    ]
    
    db = SessionLocal()
    try:
        for lead_data in demo_leads:
            if not db.query(Lead).filter(Lead.email == lead_data.get("email")).first():
                from uuid import UUID
                lead = Lead(
                    organization_id=UUID(org_id),
                    source=LeadSource[source] if source in [e.value for e in LeadSource] else LeadSource.google_maps,
                    status=LeadStatus.new,
                    score=65,
                    **lead_data
                )
                db.add(lead)
        db.commit()
        logger.info(f"Scraped {len(demo_leads)} leads")
    except Exception as e:
        logger.error(f"Lead scraping failed: {e}")
        db.rollback()
    finally:
        db.close()
