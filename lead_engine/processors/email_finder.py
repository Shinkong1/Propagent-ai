"""Email finder — discovers business email addresses"""
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


async def find_email(first_name: str, last_name: str, domain: str) -> Optional[str]:
    """
    Find business email for a contact.
    Production: use Hunter.io API, Snov.io, or Apollo.io
    """
    if not domain:
        return None

    # Common patterns to try
    patterns = [
        f"{first_name.lower()}@{domain}",
        f"{first_name.lower()}.{last_name.lower()}@{domain}",
        f"{first_name[0].lower()}{last_name.lower()}@{domain}",
    ]

    logger.info(f"Email finder: would check {len(patterns)} patterns for {first_name} {last_name} @ {domain}")
    return patterns[0]  # Return first pattern as estimate


def extract_domain(website: str) -> Optional[str]:
    if not website:
        return None
    match = re.search(r'(?:https?://)?(?:www\.)?([^/]+)', website)
    return match.group(1) if match else None
