"""Lead generation and outreach service"""
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models.lead import Lead, OutreachEmail

logger = logging.getLogger(__name__)


async def queue_outreach_email(lead: Lead, db: Session) -> None:
    """Generate personalized outreach email using AI and queue it"""
    try:
        subject = f"Automate {lead.company or 'Your Properties'} with AI — PropAgent"
        
        body = f"""Hi {lead.first_name or 'there'},

I noticed you manage {lead.num_properties or 'several'} properties in {lead.city or 'your area'}, 
and I wanted to reach out about PropAgent AI.

We help property managers like you automate:
• Tenant communications (24/7 AI responses)
• Maintenance requests (auto-ticketing + vendor dispatch)
• Leasing inquiries (AI books tours, qualifies leads)
• Screening workflows (automated recommendations)

Most of our clients save 15+ hours/week on tenant communication alone.

Would you be open to a 15-minute demo this week?

Best,
The PropAgent Team
https://propagent.ai
"""
        
        email = OutreachEmail(
            lead_id=lead.id,
            subject=subject,
            body=body,
            status="queued",
            sequence_step=1,
        )
        db.add(email)
        lead.last_contacted = datetime.utcnow()
        db.commit()
        logger.info(f"Queued outreach for lead {lead.id}")
    except Exception as e:
        logger.error(f"Failed to queue outreach: {e}")
