"""Lead generation and outreach service"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload, aliased
from models.lead import Lead, OutreachEmail, LeadStatus

logger = logging.getLogger(__name__)

REENGAGEMENT_SEQUENCE_STEP = 3


def queue_outreach_email(lead: Lead, db: Session) -> None:
    """Generate personalized outreach email using AI and queue it.

    Plain sync def (not async) even though FastAPI's BackgroundTasks accepts
    either -- this needs to be callable directly from
    workers/tasks/lead_scraping.py's scrape_leads_task, which is itself a
    plain sync function with no event loop to await onto. Has no real
    `await` in its body anyway, so dropping `async` changes nothing for the
    existing BackgroundTasks caller in routes/leads.py."""
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


def queue_lead_reengagement_emails(db: Session, limit: int = 30, stale_days: int = 10) -> dict:
    """Re-engagement step for stale leads -- prospects who were sent outreach
    (step 1, and sometimes step 2 if they replied once and went quiet again)
    but never replied and never moved past 'new'/'contacted'. Not visitor
    tracking (this app has none) -- this works off real OutreachEmail rows
    already created by queue_outreach_email/queue_followup_email above.

    A lead qualifies when ALL of:
      - its most recently created OutreachEmail has status == 'sent'
        (i.e. nothing is still queued/pending and it hasn't bounced)
      - that email's sent_at is more than `stale_days` days ago
      - none of its OutreachEmails has status == 'replied'
      - lead.status is still LeadStatus.new or LeadStatus.contacted
      - it doesn't already have a sequence_step == REENGAGEMENT_SEQUENCE_STEP
        (3) OutreachEmail

    That last check is the whole idempotency mechanism -- same pattern as
    sequence_step 1/2 above, no separate "reengaged" column needed. Queues
    ONE step-3 OutreachEmail with status='queued' per qualifying lead;
    sending is unchanged, still handled by process_outreach_queue() once
    the row lands in the same table.

    Bounded to `limit` leads queued per call, same reasoning as
    services/collections_agent.py's check_overdue_payment_workflows(limit=25)
    and process_outreach_queue(limit=50) -- keep each invocation fast so a
    scheduler-triggered call can't run long enough to hit a gateway/scheduler
    timeout; the scheduler's own repeat interval works through any backlog
    over several runs instead of one slow one. The candidate query itself is
    pre-filtered in SQL (early status, no reply, no existing step-3 email, has
    a stale 'sent' email) and additionally capped at `limit * 3` rows fetched,
    since only the "is the latest email actually the stale sent one" check
    needs to happen in Python.
    """
    cutoff = datetime.utcnow() - timedelta(days=stale_days)
    early_statuses = (LeadStatus.new, LeadStatus.contacted)

    # Separate aliases per correlated EXISTS subquery -- reusing OutreachEmail
    # directly (or joining it onto the outer query) makes SQLAlchemy's
    # auto-correlation ambiguous about which FROM belongs to which clause.
    OE_sent = aliased(OutreachEmail)
    OE_replied = aliased(OutreachEmail)
    OE_step3 = aliased(OutreachEmail)

    has_stale_sent = (
        db.query(OE_sent.id)
        .filter(
            OE_sent.lead_id == Lead.id,
            OE_sent.status == "sent",
            OE_sent.sent_at.isnot(None),
            OE_sent.sent_at < cutoff,
        )
        .exists()
    )
    has_reply = (
        db.query(OE_replied.id)
        .filter(OE_replied.lead_id == Lead.id, OE_replied.status == "replied")
        .exists()
    )
    has_reengagement = (
        db.query(OE_step3.id)
        .filter(
            OE_step3.lead_id == Lead.id,
            OE_step3.sequence_step == REENGAGEMENT_SEQUENCE_STEP,
        )
        .exists()
    )

    candidates = (
        db.query(Lead)
        .options(joinedload(Lead.outreach_emails))
        .filter(
            Lead.status.in_(early_statuses),
            has_stale_sent,
            ~has_reply,
            ~has_reengagement,
        )
        .limit(limit * 3)
        .all()
    )

    queued = 0
    for lead in candidates:
        if queued >= limit:
            break

        emails = lead.outreach_emails
        if not emails:
            continue
        # Re-check in Python: the SQL join only guarantees *a* stale sent
        # email exists, not that it's the most recent one for this lead.
        latest = max(emails, key=lambda e: e.created_at)
        if latest.status != "sent" or not latest.sent_at or latest.sent_at >= cutoff:
            continue
        if any(e.status == "replied" for e in emails):
            continue
        if any(e.sequence_step == REENGAGEMENT_SEQUENCE_STEP for e in emails):
            continue

        try:
            subject = f"Still worth a look, {lead.first_name or 'there'}?"
            body = f"""Hi {lead.first_name or 'there'},

I reached out a little while back about PropAgent AI for {lead.company or 'your properties'}
and never heard back, so I didn't want it to just sit forgotten in your inbox.

Different angle this time, no call required: here's a 2-minute self-playing demo of
PropAgent running on a real account -- real tenant inquiries, real maintenance tickets,
real AI screening decisions, start to finish.

https://propagent.app/demo

If it's not a fit right now, no worries -- just reply "not now" and I'll stop following up.
If it is, reply here and I'll get you a login of your own to try it firsthand.

Best,
The PropAgent Team
https://propagent.app
"""
            email = OutreachEmail(
                lead_id=lead.id,
                subject=subject,
                body=body,
                status="queued",
                sequence_step=REENGAGEMENT_SEQUENCE_STEP,
            )
            db.add(email)
            lead.last_contacted = datetime.utcnow()
            queued += 1
        except Exception as e:
            logger.error(f"Failed to queue re-engagement email for lead {lead.id}: {e}")

    if queued:
        db.commit()

    logger.info(
        f"Lead re-engagement: queued {queued} email(s) "
        f"(checked {len(candidates)} candidate(s), stale_days={stale_days}, limit={limit})"
    )
    return {"queued": queued, "checked": len(candidates)}


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
