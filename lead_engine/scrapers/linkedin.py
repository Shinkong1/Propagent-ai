"""
LinkedIn scraper stub — requires LinkedIn API or Sales Navigator
In production: use LinkedIn API with OAuth or a compliant data provider
"""
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)


async def scrape_property_managers_linkedin(location: str) -> List[Dict]:
    """
    Search LinkedIn for property managers and real estate investors.
    NOTE: Direct scraping violates LinkedIn ToS. Use official API or 
    compliant data providers (Apollo.io, Hunter.io, ZoomInfo).
    """
    logger.info(f"LinkedIn lead search for {location} — using demo data (configure API for live)")
    return [
        {"first_name": "Jennifer", "last_name": "Brooks", "company": "Brooks Investment Group",
         "linkedin_url": "https://linkedin.com/in/jennifer-brooks-pm",
         "city": location, "num_properties": 20, "source": "linkedin"},
        {"first_name": "Carlos", "last_name": "Reyes", "company": "Reyes Property Holdings",
         "linkedin_url": "https://linkedin.com/in/carlos-reyes-properties",
         "city": location, "num_properties": 14, "source": "linkedin"},
    ]
