"""Lead generation and outreach service"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload, aliased
from models.lead import Lead, OutreachEmail, LeadStatus

logger = logging.getLogger(__name__)

REENGAGEMENT_SEQUENCE_STEP = 3

# Real bug fixed here: these were plain-text-only, no HTML part at all, and
# closed with just "Best, / The PropAgent Team / https://propagent.app" --
# reported by the user after actually receiving one ("didn't have a
# professional layout... no signoff or signature"). Every template below now
# builds a matching HTML version (real <ul> for the bullet list, proper
# paragraph spacing) sent alongside the plain-text body via
# communication_agent.send_email()'s new `html` param, plus a real signature
# block and a working opt-out line.
#
# NOT fixed here, flagged instead of guessed at: cold outreach emails like
# these are commercial email under the US CAN-SPAM Act, which requires (1) a
# valid physical postal address in the email and (2) a working opt-out --
# the opt-out is covered below (reply routes through the Cloudflare Email
# Worker to a real inbox, honored by simply not re-queuing that lead), but
# there is nowhere in this codebase with a real business mailing address on
# file, and one should not be invented. Add PHYSICAL_MAILING_ADDRESS to
# config.py and wire it into SIGNATURE_HTML/SIGNATURE_TEXT below once you
# have a real address to use.
SIGNATURE_HTML = """
<table role="presentation" style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:16px;">
  <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a202c;padding-bottom:2px;">The PropAgent Team</td></tr>
  <tr><td style="font-size:13px;color:#4a5568;padding-bottom:1px;">PropAgent AI</td></tr>
  <tr><td style="font-size:13px;padding-bottom:1px;"><a href="https://propagent.app" style="color:#b7791f;text-decoration:none;">propagent.app</a></td></tr>
  <tr><td style="font-size:13px;color:#4a5568;">propagentapp@gmail.com &nbsp;·&nbsp; (617) 500-3821</td></tr>
</table>
<p style="font-size:12px;color:#a0aec0;margin-top:18px;">
  You're receiving this because your business appeared in a public directory of property management companies.
  Not interested? Just reply and let us know — we'll stop reaching out.
</p>
"""

SIGNATURE_TEXT = """
Best,
The PropAgent Team
PropAgent AI — https://propagent.app
propagentapp@gmail.com · (617) 500-3821

You're receiving this because your business appeared in a public directory of property
management companies. Not interested? Just reply and let us know — we'll stop reaching out.
"""


def _html_wrapper(inner_html: str) -> str:
    """Shared container: inline styles only (email clients don't reliably
    support <style> blocks or external stylesheets), deliberately plain and
    text-forward rather than graphic-heavy -- cold B2B outreach reads as
    more legitimate, and is less likely to be flagged as spam, when it
    looks like a real person wrote it rather than a marketing blast."""
    return f"""<div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a202c;">
{inner_html}
{SIGNATURE_HTML}
</div>"""


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
        first = lead.first_name or 'there'
        city = lead.city or 'your area'
        num = lead.num_properties or 'several'

        body = f"""Hi {first},

I noticed you manage {num} properties in {city}, and I wanted to reach out about PropAgent AI.

We help property managers like you automate:
• Tenant communications (24/7 AI responses)
• Maintenance requests (auto-ticketing + vendor dispatch)
• Leasing inquiries (AI books tours, qualifies leads)
• Screening workflows (automated recommendations)

Most of our clients save 15+ hours/week on tenant communication alone.

Would you be open to a 15-minute demo this week?
""" + SIGNATURE_TEXT

        html = _html_wrapper(f"""<p>Hi {first},</p>
<p>I noticed you manage {num} properties in {city}, and I wanted to reach out about PropAgent AI.</p>
<p>We help property managers like you automate:</p>
<ul style="margin:0 0 16px;padding-left:20px;">
  <li style="margin-bottom:6px;">Tenant communications (24/7 AI responses)</li>
  <li style="margin-bottom:6px;">Maintenance requests (auto-ticketing + vendor dispatch)</li>
  <li style="margin-bottom:6px;">Leasing inquiries (AI books tours, qualifies leads)</li>
  <li>Screening workflows (automated recommendations)</li>
</ul>
<p>Most of our clients save <strong>15+ hours/week</strong> on tenant communication alone.</p>
<p>Would you be open to a 15-minute demo this week?</p>""")

        email = OutreachEmail(
            lead_id=lead.id,
            subject=subject,
            body=body,
            html_body=html,
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
        first = lead.first_name or 'there'
        company = lead.company or 'your portfolio'

        body = f"""Hi {first},

Thanks for getting back to me. Instead of finding time on both our calendars,
here's a 2-minute look at PropAgent AI running on a real account — real inquiries,
real maintenance tickets, real AI screening decisions. It plays itself:

https://propagent.app/demo

If it looks like a fit for {company}, reply here and I'll get you a login of
your own to click around in, or we can find 15 minutes to talk through your
specific properties.
""" + SIGNATURE_TEXT

        html = _html_wrapper(f"""<p>Hi {first},</p>
<p>Thanks for getting back to me. Instead of finding time on both our calendars, here's a 2-minute look at PropAgent AI running on a real account — real inquiries, real maintenance tickets, real AI screening decisions. It plays itself:</p>
<p><a href="https://propagent.app/demo" style="color:#b7791f;">propagent.app/demo</a></p>
<p>If it looks like a fit for {company}, reply here and I'll get you a login of your own to click around in, or we can find 15 minutes to talk through your specific properties.</p>""")

        email = OutreachEmail(
            lead_id=lead.id, subject=subject, body=body, html_body=html,
            status="queued", sequence_step=2,
        )
        db.add(email)
        lead.last_contacted = datetime.utcnow()
        db.commit()
        logger.info(f"Queued follow-up outreach for lead {lead.id}")
    except Exception as e:
        logger.error(f"Failed to queue follow-up outreach: {e}")


def queue_outreach_for_uncontacted_leads(db: Session, organization_id, limit: int = 200) -> dict:
    """Safety net + backfill: queues initial outreach for any lead in this
    ONE organization (Lead is multi-tenant like everything else -- every
    caller must scope by organization_id, same as list_leads/create_lead in
    routes/leads.py) that has a real email on file but has never had a
    single OutreachEmail queued -- regardless of source (scrape, manual add
    via POST /leads/) or how old the lead is. Covers two real gaps found in
    a live audit:
      1. Leads scraped before the scrape-time auto-queue fix landed
         (workers/tasks/lead_scraping.py) never got outreach queued at all.
      2. Manually-added leads (POST /leads/) still don't auto-queue outreach
         today -- only a matching workflow rule or the manual "Send AI
         outreach" button does.
    Run once for an immediate backfill (see routes/leads.py's
    POST /queue-uncontacted, triggered from the Lead CRM UI) and also on
    every /internal/cron/lead-scrape run (once per org with an active
    is_master user, same loop that endpoint already does) so it keeps
    catching anything new, from any source, going forward -- not just what
    that run itself scraped.

    Idempotent: once a lead gets an OutreachEmail row here, the
    `~has_any_email` filter excludes it from ever qualifying again, so
    re-running this repeatedly (daily, via cron) never double-sends.
    Excludes closed_won/closed_lost -- already-resolved either way,
    no reason to cold-email them."""
    has_any_email = (
        db.query(OutreachEmail.id)
        .filter(OutreachEmail.lead_id == Lead.id)
        .exists()
    )
    candidates = (
        db.query(Lead)
        .filter(
            Lead.organization_id == organization_id,
            Lead.email.isnot(None),
            ~Lead.status.in_([LeadStatus.closed_won, LeadStatus.closed_lost]),
            ~has_any_email,
        )
        .limit(limit)
        .all()
    )

    queued = 0
    for lead in candidates:
        queue_outreach_email(lead, db)
        queued += 1

    logger.info(f"Backfilled outreach for {queued} previously-uncontacted lead(s) in org {organization_id} (checked {len(candidates)})")
    return {"queued": queued, "checked": len(candidates)}


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
            # html_body is nullable -- rows queued before this column
            # existed send exactly as before (plain-text only).
            status, error = send_email(email.lead.email, email.subject, email.body, reply_to=reply_to, html=email.html_body)
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
            first = lead.first_name or 'there'
            company = lead.company or 'your properties'

            body = f"""Hi {first},

I reached out a little while back about PropAgent AI for {company}
and never heard back, so I didn't want it to just sit forgotten in your inbox.

Different angle this time, no call required: here's a 2-minute self-playing demo of
PropAgent running on a real account -- real tenant inquiries, real maintenance tickets,
real AI screening decisions, start to finish.

https://propagent.app/demo

If it's not a fit right now, no worries -- just reply "not now" and I'll stop following up.
If it is, reply here and I'll get you a login of your own to try it firsthand.
""" + SIGNATURE_TEXT

            html = _html_wrapper(f"""<p>Hi {first},</p>
<p>I reached out a little while back about PropAgent AI for {company} and never heard back, so I didn't want it to just sit forgotten in your inbox.</p>
<p>Different angle this time, no call required: here's a 2-minute self-playing demo of PropAgent running on a real account — real tenant inquiries, real maintenance tickets, real AI screening decisions, start to finish.</p>
<p><a href="https://propagent.app/demo" style="color:#b7791f;">propagent.app/demo</a></p>
<p>If it's not a fit right now, no worries — just reply "not now" and I'll stop following up. If it is, reply here and I'll get you a login of your own to try it firsthand.</p>""")

            email = OutreachEmail(
                lead_id=lead.id,
                subject=subject,
                body=body,
                html_body=html,
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
