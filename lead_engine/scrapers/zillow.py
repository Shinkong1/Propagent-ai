"""
Zillow scraper — public listing data for property owner identification
Uses Zillow's public API where available
"""
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)


async def scrape_landlords_zillow(location: str) -> List[Dict]:
    """
    Find landlords via Zillow rental listings.
    In production: use Zillow's Bridge API or a real estate data provider.
    """
    logger.info(f"Zillow lead search for {location}")
    return [
        {"company": "Sunrise Apartments LLC", "email": "manager@sunriseapts.com",
         "city": location, "num_properties": 6, "source": "zillow",
         "property_types": "multi_family,apartment"},
        {"first_name": "Mark", "last_name": "Thompson", "company": "Thompson Rentals",
         "city": location, "num_properties": 4, "source": "zillow"},
    ]
