"""
Lead Generation Pipeline — orchestrates scraping, enrichment, and CRM insertion
"""
import logging
import asyncio
from typing import List, Dict
from uuid import UUID

logger = logging.getLogger(__name__)


async def run_pipeline(org_id: str, source: str, location: str) -> List[Dict]:
    """Full lead generation pipeline: scrape → enrich → deduplicate → insert"""
    from lead_engine.scrapers.google_maps import scrape_property_managers
    from lead_engine.scrapers.linkedin import scrape_property_managers_linkedin
    from lead_engine.scrapers.zillow import scrape_landlords_zillow
    from lead_engine.processors.enrichment import enrich_lead

    # 1. Scrape
    raw_leads = []
    if source == "google_maps":
        raw_leads = await scrape_property_managers(location)
    elif source == "linkedin":
        raw_leads = await scrape_property_managers_linkedin(location)
    elif source == "zillow":
        raw_leads = await scrape_landlords_zillow(location)
    else:
        # Run all sources
        results = await asyncio.gather(
            scrape_property_managers(location),
            scrape_property_managers_linkedin(location),
            scrape_landlords_zillow(location),
        )
        for r in results:
            raw_leads.extend(r)

    logger.info(f"Scraped {len(raw_leads)} raw leads from {source}")

    # 2. Enrich
    enriched = []
    for lead in raw_leads:
        enriched_lead = await enrich_lead(lead)
        enriched.append(enriched_lead)

    # 3. Insert into DB (deduplicate by email)
    inserted = await _insert_leads(org_id, enriched)
    logger.info(f"Inserted {inserted} new leads for org {org_id}")

    return enriched


async def _insert_leads(org_id: str, leads: List[Dict]) -> int:
    from database.base import SessionLocal
    from models.lead import Lead, LeadSource, LeadStatus

    db = SessionLocal()
    inserted = 0
    try:
        for lead_data in leads:
            email = lead_data.get("email")
            if email and db.query(Lead).filter(Lead.email == email).first():
                continue  # Skip duplicate

            source_str = lead_data.get("source", "manual")
            try:
                source = LeadSource(source_str)
            except ValueError:
                source = LeadSource.manual

            lead = Lead(
                organization_id=UUID(org_id),
                first_name=lead_data.get("first_name"),
                last_name=lead_data.get("last_name"),
                company=lead_data.get("company"),
                email=email,
                phone=lead_data.get("phone"),
                website=lead_data.get("website"),
                city=lead_data.get("city"),
                state=lead_data.get("state"),
                num_properties=lead_data.get("num_properties"),
                source=source,
                status=LeadStatus.new,
                score=lead_data.get("score", 50),
            )
            db.add(lead)
            inserted += 1

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Lead insertion failed: {e}")
    finally:
        db.close()

    return inserted
