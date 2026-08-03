"""Lead enrichment — fills in missing data using various APIs"""
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


async def enrich_lead(lead_data: Dict) -> Dict:
    """
    Enrich lead with additional data.
    Production: integrate with Clearbit, Apollo, Hunter, etc.
    """
    enriched = lead_data.copy()

    # Score the lead based on available signals
    score = 50
    if lead_data.get("num_properties", 0) >= 20:
        score += 20
    elif lead_data.get("num_properties", 0) >= 10:
        score += 12
    elif lead_data.get("num_properties", 0) >= 5:
        score += 6

    if lead_data.get("email"):
        score += 10
    if lead_data.get("phone"):
        score += 8
    if lead_data.get("website"):
        score += 5
    if lead_data.get("linkedin_url"):
        score += 7

    enriched["score"] = min(score, 100)
    return enriched
