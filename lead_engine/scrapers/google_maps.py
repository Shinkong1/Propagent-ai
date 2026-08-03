"""
Google Maps Places API scraper for property managers
Uses the Places API to find property management companies
"""
import logging
import httpx
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


async def scrape_property_managers(
    location: str,
    radius_meters: int = 50000,
    api_key: Optional[str] = None,
) -> List[Dict]:
    """
    Search Google Maps for property management companies.
    Returns list of lead dicts ready for DB insertion.
    """
    if not api_key:
        logger.warning("No Google Maps API key — returning demo data")
        return _demo_data(location)

    results = []
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    queries = [
        f"property management company {location}",
        f"landlord real estate investor {location}",
        f"apartment rental management {location}",
    ]

    async with httpx.AsyncClient(timeout=15) as client:
        for query in queries:
            try:
                resp = await client.get(url, params={
                    "query": query, "key": api_key, "type": "real_estate_agency"
                })
                data = resp.json()

                for place in data.get("results", [])[:10]:
                    results.append({
                        "company": place.get("name"),
                        "address": place.get("formatted_address"),
                        "phone": place.get("formatted_phone_number"),
                        "website": place.get("website"),
                        "rating": place.get("rating"),
                        "city": _extract_city(place.get("formatted_address", "")),
                        "source": "google_maps",
                    })
            except Exception as e:
                logger.error(f"Google Maps scrape error: {e}")

    return results


def _extract_city(address: str) -> str:
    parts = address.split(",")
    return parts[1].strip() if len(parts) >= 2 else ""


def _demo_data(location: str) -> List[Dict]:
    """Demo leads when API key not configured"""
    return [
        {"company": "Premier Property Solutions", "email": "contact@premierprop.com",
         "city": location, "phone": "(512) 555-3001", "num_properties": 15, "source": "google_maps"},
        {"company": "Capital City Property Mgmt", "email": "info@capitalcitypm.com",
         "city": location, "phone": "(512) 555-3002", "num_properties": 28, "source": "google_maps"},
        {"company": "Austin Realty Partners", "email": "hello@austinrp.com",
         "city": location, "phone": "(512) 555-3003", "num_properties": 9, "source": "google_maps"},
    ]
