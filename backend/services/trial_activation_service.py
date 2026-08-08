"""Trial-activation email sequence -- distinct from services/lead_service.py,
which pitches PROSPECTS who haven't signed up yet. This is for orgs that
ALREADY signed up and are sitting inside their 14-day free trial
(Organization.trial_ends_at, see routes/auth.py's signup endpoint and
middleware/auth.py's _org_has_access), with nobody following up if they
never engage.

Sequence (day count is calendar days since Organization.created_at):
  - Day 1: not handled here -- routes/auth.py's signup endpoint already
    sends a "confirm your email" welcome email. This sequence deliberately
    starts after that so the two never overlap.
  - Day 3+: if the org still has zero properties, nudge them to add their
    first one. This mirrors frontend/components/OnboardingChecklist.tsx's
    definition of the first (and most important) activation step exactly:
    `(stats.total_properties || 0) > 0`.
  - Day 7+: mid-trial check-in. Looks at what the org HAS used (properties,
    tenants, maintenance tickets, AI calls) and highlights the next thing
    they likely haven't tried, in the same priority order as the
    onboarding checklist, then AI workforce usage.
  - Day 13+: trial-ending-soon reminder with a direct link to /pricing.
    Branches on whether the org actually has a real Stripe subscription in
    trial (will auto-bill at day 14 unless canceled, standard Stripe trial
    behavior) vs. no subscription at all (the common case -- no card was
    ever collected, so the org simply loses access at day 14, no charge).
    See middleware/auth.py's _org_has_access for the exact access-loss
    behavior this describes.

Idempotency: each milestone is recorded exactly once per org in the
org_trial_emails table (models/user.py's OrgTrialEmail) the moment it's
sent, via a unique (organization_id, milestone) constraint. Orgs that have
already converted to paid (subscription_status == "active") are skipped
entirely -- no point activating someone who already activated themselves.
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models.user import Organization, User, UserRole, OrgTrialEmail, TrialEmailMilestone
from models.property import Property
from models.tenant import Tenant
from models.maintenance import MaintenanceTicket
from services.communication_agent import send_email
from config import settings

logger = logging.getLogger(__name__)

# Subscription statuses that mean the org is a real paying customer already --
# stop the trial-activation sequence the moment this is true. "trialing" is
# deliberately excluded: that just means they have a Stripe subscription
# scheduled to bill later, not that they've converted yet.
CONVERTED_STATUSES = {"active"}

MILESTONE_MIN_DAY = {
    TrialEmailMilestone.day3_add_property: 3,
    TrialEmailMilestone.day7_checkin: 7,
    TrialEmailMilestone.day13_trial_ending: 13,
}


def _days_since_signup(org: Organization, now: datetime) -> int:
    return (now - org.created_at).days


def _trial_end(org: Organization) -> datetime:
    return org.trial_ends_at or (org.created_at + timedelta(days=14))


def _already_sent(db: Session, org_id, milestone: TrialEmailMilestone) -> bool:
    return db.query(OrgTrialEmail).filter(
        OrgTrialEmail.organization_id == org_id,
        OrgTrialEmail.milestone == milestone,
    ).first() is not None


def _owner_user(db: Session, org: Organization):
    """The person who should receive activation nudges -- the org's owner
    (the account that signed up), same "find the owner" convention used for
    billing actions in routes/billing.py's require_role(UserRole.owner)."""
    return (
        db.query(User)
        .filter(User.organization_id == org.id, User.role == UserRole.owner, User.is_active == True)
        .order_by(User.created_at.asc())
        .first()
    )


def _property_count(db: Session, org_id) -> int:
    return db.query(Property).filter(Property.organization_id == org_id, Property.is_active == True).count()


def _tenant_count(db: Session, org_id) -> int:
    return db.query(Tenant).filter(Tenant.organization_id == org_id).count()


def _maintenance_count(db: Session, org_id) -> int:
    # MaintenanceTicket has no organization_id of its own -- it hangs off
    # Property (see models/maintenance.py), same join routes/properties.py's
    # /stats endpoint uses for open_tickets.
    return (
        db.query(MaintenanceTicket)
        .join(Property, MaintenanceTicket.property_id == Property.id)
        .filter(Property.organization_id == org_id)
        .count()
    )


def _dashboard_url(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _compose_day3_add_property(owner: User, org: Organization) -> tuple:
    subject = "Add your first property to PropAgent AI"
    link = _dashboard_url("/dashboard/properties")
    body = (
        f"Hi {owner.first_name or 'there'},\n\n"
        f"You signed up for PropAgent AI for {org.name} a few days ago, but your portfolio's still empty -- "
        f"nothing else in the app (AI leasing, maintenance ticketing, rent collection, screening) has real "
        f"data to work with until there's at least one property on file.\n\n"
        f"Adding your first property takes about a minute: {link}\n\n"
        f"Once it's in, add a unit and a tenant and the rest of the AI workforce starts doing real work "
        f"automatically. If anything's unclear or you'd rather just tell us about your portfolio and have "
        f"us help you get set up, just reply to this email.\n\n"
        f"-- The PropAgent AI Team"
    )
    return subject, body


def _compose_day7_checkin(db: Session, owner: User, org: Organization) -> tuple:
    """Mirrors OnboardingChecklist.tsx's step order (property -> unit/tenant),
    then looks one step further into maintenance and AI workforce usage --
    the two agent-driven features new orgs are least likely to have found
    on their own by day 7."""
    properties = _property_count(db, org.id)
    tenants = _tenant_count(db, org.id)
    maintenance = _maintenance_count(db, org.id)
    ai_used = (org.ai_calls_this_period or 0) > 0

    subject = "How's PropAgent AI working out so far?"
    intro = f"Hi {owner.first_name or 'there'},\n\nYou're about a week into your PropAgent AI trial for {org.name}. "

    if properties == 0:
        cta = (
            "Looks like you haven't added a property yet -- that's the one thing that unlocks everything else "
            f"(AI leasing, maintenance, rent collection). Add your first one here: {_dashboard_url('/dashboard/properties')}\n\n"
            "Happy to help if you get stuck -- just reply to this email."
        )
    elif tenants == 0:
        cta = (
            f"You've got {properties} propert{'y' if properties == 1 else 'ies'} in -- nice. Next, add a tenant "
            f"and their lease so rent tracking, communications, and collections have someone to work with: "
            f"{_dashboard_url('/dashboard/tenants')}"
        )
    elif maintenance == 0:
        cta = (
            f"You've got properties and tenants set up. Something most people don't try until a real repair "
            f"comes up: PropAgent AI's maintenance agent will auto-triage a ticket, draft a vendor message, "
            f"and keep the tenant updated on status changes -- worth a look even with a test ticket: "
            f"{_dashboard_url('/dashboard/maintenance')}"
        )
    elif not ai_used:
        cta = (
            f"Your portfolio's set up well. One thing you haven't tried yet is the AI Workforce itself -- ask it "
            f"a question about your portfolio (vacancy, collections, a specific tenant) and it'll pull real "
            f"answers from your data: {_dashboard_url('/dashboard/ai-workforce')}"
        )
    else:
        cta = (
            "You're genuinely using the product -- properties, tenants, maintenance, and the AI workforce are "
            "all active. If there's a workflow you wish it handled better, just reply and tell us -- we read "
            "every one of these."
        )

    body = intro + cta + "\n\n-- The PropAgent AI Team"
    return subject, body


def _compose_day13_trial_ending(owner: User, org: Organization, trial_end: datetime) -> tuple:
    end_date = trial_end.strftime("%B %d, %Y")
    link = _dashboard_url("/pricing")
    is_real_stripe_trial = bool(org.stripe_subscription_id) and org.subscription_status == "trialing"

    subject = f"Your PropAgent AI trial ends {end_date}"

    if is_real_stripe_trial:
        money_line = (
            f"You already picked a plan and have a card on file, so unless you cancel first, it will be "
            f"charged automatically when the trial ends on {end_date} -- normal behavior for a Stripe trial "
            f"subscription. Manage or cancel anytime from your billing portal."
        )
    else:
        money_line = (
            f"No card is on file, so nothing will be charged automatically. If you haven't chosen a plan by "
            f"{end_date}, you'll simply lose access to your PropAgent AI dashboard until you do -- your data "
            f"stays intact, it just won't be reachable."
        )

    body = (
        f"Hi {owner.first_name or 'there'},\n\n"
        f"Your PropAgent AI trial for {org.name} ends on {end_date} -- just a couple of days left.\n\n"
        f"{money_line}\n\n"
        f"Pick a plan (or see pricing) here: {link}\n\n"
        f"Questions about which plan fits, or anything that didn't work the way you expected during the "
        f"trial? Reply to this email -- a real person reads these.\n\n"
        f"-- The PropAgent AI Team"
    )
    return subject, body


def _send_and_record(db: Session, org: Organization, owner: User, milestone: TrialEmailMilestone,
                      subject: str, body: str, now: datetime, summary: dict) -> None:
    try:
        email_status, email_error = send_email(owner.email, subject, body)
        if email_error:
            logger.warning(f"trial_activation_service: {milestone.value} to org {org.id} status={email_status} error={email_error}")
    except Exception as e:
        # Even if send_email itself raises, still record -- an org whose email
        # keeps hard-failing shouldn't be retried forever every few hours;
        # this matches the "log it, don't loop on it" pattern used elsewhere
        # in this codebase (e.g. services/owner_notify.py).
        email_status = "failed"
        logger.error(f"trial_activation_service: exception sending {milestone.value} to org {org.id}: {e}")

    db.add(OrgTrialEmail(organization_id=org.id, milestone=milestone, sent_at=now))
    db.commit()

    summary["sent"].append({
        "org_id": str(org.id),
        "milestone": milestone.value,
        "email_status": email_status,
    })


def run_trial_activation_emails(db: Session) -> dict:
    """Entry point for the /internal/cron/trial-activation-emails endpoint.
    Meant to be safe to call repeatedly (every few hours) -- date-based, not
    time-critical, and fully idempotent per (org, milestone)."""
    now = datetime.utcnow()
    summary = {"checked": 0, "sent": [], "skipped_converted": 0, "skipped_trial_over": 0, "skipped_no_owner": 0}

    orgs = db.query(Organization).filter(Organization.is_active == True).all()

    for org in orgs:
        summary["checked"] += 1
        if not org.created_at:
            continue

        if org.subscription_status in CONVERTED_STATUSES:
            summary["skipped_converted"] += 1
            continue

        trial_end = _trial_end(org)
        if now >= trial_end:
            summary["skipped_trial_over"] += 1
            continue

        owner = _owner_user(db, org)
        if not owner or not owner.email:
            summary["skipped_no_owner"] += 1
            continue

        days = _days_since_signup(org, now)

        if days >= MILESTONE_MIN_DAY[TrialEmailMilestone.day3_add_property] \
                and not _already_sent(db, org.id, TrialEmailMilestone.day3_add_property):
            if _property_count(db, org.id) == 0:
                subject, body = _compose_day3_add_property(owner, org)
                _send_and_record(db, org, owner, TrialEmailMilestone.day3_add_property, subject, body, now, summary)

        if days >= MILESTONE_MIN_DAY[TrialEmailMilestone.day7_checkin] \
                and not _already_sent(db, org.id, TrialEmailMilestone.day7_checkin):
            subject, body = _compose_day7_checkin(db, owner, org)
            _send_and_record(db, org, owner, TrialEmailMilestone.day7_checkin, subject, body, now, summary)

        if days >= MILESTONE_MIN_DAY[TrialEmailMilestone.day13_trial_ending] \
                and not _already_sent(db, org.id, TrialEmailMilestone.day13_trial_ending):
            subject, body = _compose_day13_trial_ending(owner, org, trial_end)
            _send_and_record(db, org, owner, TrialEmailMilestone.day13_trial_ending, subject, body, now, summary)

    return summary
