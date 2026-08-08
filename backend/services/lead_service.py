"""Lead generation and outreach service"""
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from models.lead import Lead, OutreachEmail, LeadStatus

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
https://propagent.app
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


async def queue_followup_email(lead: Lead, db: Session) -> None:
    """Step 2 of the sequence -- sent once a human confirms the lead
    replied to the first outreach email (see mark_replied in routes/leads.py;
    there's no inbound-email parsing here, so a reply is a human-confirmed
    signal, not an automatically detected one). Points them at the
    self-playing demo instead of asking them to book a call outright."""
    try:
        subject = f"Following up — see PropAgent AI in action, {lead.first_name or 'no call needed'}"

        body = f"""Hi {lead.first_name or 'there'},

Thanks for getting back to me. Instead of finding time on both our calendars,
here's a 2-minute look at PropAgent AI running on a real account — real inquiries,
real maintenance tickets, real AI screening decisions. It plays itself:

https://propagent.app/demo

If it looks like a fit for {lead.company or 'your portfolio'}, reply here and
I'll get you a login of your own to click around in, or we can find 15 minutes
to talk through your specific properties.

Best,
The PropAgent Team
https://propagent.app
"""

        email = OutreachEmail(
            lead_id=lead.id, subject=subject, body=body,
            status="queued", sequence_step=2,
        )
        db.add(email)
        lead.last_contacted = datetime.utcnow()
        db.commit()
        logger.info(f"Queued follow-up outreach for lead {lead.id}")
    except Exception as e:
        logger.error(f"Failed to queue follow-up outreach: {e}")


def process_outreach_queue(db: Session, limit: int = 50) -> dict:
    """Send whatever's sitting in the outreach queue. Shared by the Celery
    task (for local dev, where a worker/beat process actually runs) and the
    /internal/cron HTTP endpoint (for production, where no paid background
    worker is deployed — an external free scheduler hits that endpoint
    instead). Plain sync function either way; callers on the async side are
    responsible for running it in a threadpool."""
    from services.communication_agent import send_email

    pending = db.query(OutreachEmail).filter(OutreachEmail.status == "queued").limit(limit).all()

    sent = 0
    for email in pending:
        try:
            # Per-lead Reply-To so a reply routes back through the Cloudflare
            # Email Worker (infra/cloudflare/email-reply-worker.js), which
            # extracts the lead id from the address and calls
            # /internal/email/inbound-reply -- see mark_lead_replied() below.
            # Without this, "replied" only ever happened if a human noticed
            # the reply in a real inbox and clicked "mark replied" manually.
            reply_to = f"reply+{email.lead_id}@propagent.app"
            status, error = send_email(email.lead.email, email.subject, email.body, reply_to=reply_to)
            email.status = status
            if status == "sent":
                email.sent_at = datetime.utcnow()
                sent += 1
            else:
                logger.warning(f"Outreach email {email.id} not sent (status={status}): {error}")
        except Exception as e:
            logger.error(f"Failed to send email {email.id}: {e}")

    db.commit()
    logger.info(f"Processed outreach queue: {sent} sent of {len(pending)} pending")
    return {"sent": sent, "pending": len(pending)}


def mark_lead_replied(db: Session, lead_id) -> "Lead | None":
    """Marks the lead's latest outreach email replied and moves a brand-new
    lead to 'interested'. Shared by the manual 'mark replied' button
    (routes/leads.py) and the automated inbound-reply webhook
    (routes/internal_cron.py, fed by the Cloudflare Email Worker) -- same
    outcome regardless of whether a human or the worker noticed the reply.
    Deliberately synchronous and doesn't queue the step-2 follow-up itself
    (queue_followup_email is async) -- the caller queues it however fits
    its own context (BackgroundTasks in an async route, run_in_threadpool
    callers use asyncio.run). Returns the Lead on success, None if the id
    doesn't match anything (logged, not raised -- the caller here is often
    an unattended webhook)."""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        logger.warning(f"mark_lead_replied: no lead found for id {lead_id}")
        return None

    latest = max(lead.outreach_emails, key=lambda e: e.created_at) if lead.outreach_emails else None
    if latest:
        latest.status = "replied"
        latest.replied_at = latest.replied_at or datetime.utcnow()

    if lead.status == LeadStatus.new:
        lead.status = LeadStatus.interested
    db.commit()
    return lead
