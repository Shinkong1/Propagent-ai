import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Float, Text, Enum as SAEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class PlanType(enum.Enum):
    starter = "starter"
    professional = "professional"
    enterprise = "enterprise"


class UserRole(enum.Enum):
    owner = "owner"       # created the org at signup; full control including billing and team management
    manager = "manager"   # day-to-day operations; can invite/manage staff but not other managers or billing
    staff = "staff"       # operational access only; no team management, billing, or destructive actions


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    plan = Column(SAEnum(PlanType), default=PlanType.starter, nullable=False)
    language = Column(String(5), default="en", nullable=False)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    # Stripe Connect (Express) account this org's tenants pay rent into directly —
    # separate from stripe_customer_id above, which is for *this org's own*
    # subscription to PropAgent AI. Rent money never passes through a PropAgent-
    # controlled account.
    stripe_connect_account_id = Column(String(255), nullable=True)
    stripe_connect_onboarded = Column(Boolean, default=False, nullable=False)
    # Dedicated Voice AI phone number addon ($19/mo, Professional+ only) --
    # see services/voice_number_service.py. Null until purchased: without
    # one, this org's Voice AI calls still work via the shared platform
    # number (voice/twilio_webhook.py's caller-ID matching fallback), just
    # without the isolation a dedicated number gives.
    voice_number = Column(String(20), nullable=True, unique=True)
    voice_number_sid = Column(String(64), nullable=True)
    voice_number_subscription_item_id = Column(String(255), nullable=True)
    # Real Stripe subscription status (trialing/active/past_due/canceled/unpaid), kept in
    # sync via billing webhook events — null when no Stripe subscription exists yet (e.g.
    # manually created orgs), never fabricated.
    subscription_status = Column(String(30), nullable=True)
    # Set the moment a checkout session with a trial is first created for this org, so
    # a cancel/resubscribe cycle can't be used to keep claiming new 14-day trials.
    trial_used = Column(Boolean, default=False, nullable=False)
    # 14 days from signup — the free window before an active Stripe subscription is
    # required to keep using the app at all. See middleware/auth.py's access check.
    trial_ends_at = Column(DateTime, nullable=True)
    referral_code = Column(String(20), unique=True, nullable=True)
    referred_by_org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    # Referral reward program. referral_credits_earned lives on the REFERRING org --
    # one free-month credit per referred org whose trial converts to a real paid
    # plan (the owner applies it manually via the billing portal / a support
    # request until/unless this is wired to a real Stripe coupon). See
    # services/platform_service.grant_referral_reward_if_eligible().
    referral_credits_earned = Column(Integer, default=0, nullable=False)
    # referral_reward_granted lives on the REFERRED org (this org) -- flips to
    # True the first time its conversion to paid grants its referrer a credit,
    # so a later plan change (upgrade/downgrade/webhook retry) can never
    # double-grant the same referral.
    referral_reward_granted = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Collections agent — configurable escalation thresholds (days overdue) per jurisdiction
    collections_day_reminder = Column(Integer, default=3, nullable=False)
    collections_day_late_fee = Column(Integer, default=5, nullable=False)
    collections_day_payment_plan = Column(Integer, default=10, nullable=False)
    collections_day_manager_notify = Column(Integer, default=15, nullable=False)
    collections_day_legal_prep = Column(Integer, default=30, nullable=False)
    collections_late_fee_percent = Column(Float, default=5.0, nullable=False)

    # Plan-tier usage tracking — AI call count resets on a rolling 30-day window
    ai_calls_this_period = Column(Integer, default=0, nullable=False)
    ai_calls_period_start = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Settings
    theme = Column(String(10), default="dark", nullable=False)  # dark | light
    timezone = Column(String(50), default="America/New_York", nullable=False)
    currency = Column(String(3), default="USD", nullable=False)  # ISO 4217 code
    notify_email_enabled = Column(Boolean, default=True, nullable=False)
    notify_sms_enabled = Column(Boolean, default=True, nullable=False)

    # Document generation — org-editable boilerplate clause appended to each generated
    # document type. Null/blank means the built-in default wording is used as-is.
    doc_template_lease_agreement = Column(Text, nullable=True)
    doc_template_lease_renewal_notice = Column(Text, nullable=True)
    doc_template_rent_increase_notice = Column(Text, nullable=True)
    doc_template_move_out_notice = Column(Text, nullable=True)

    # External API access (Zapier/Make/custom integrations) — a per-org secret
    # sent as the X-API-Key header, distinct from user JWTs. Null until the
    # owner first generates one from Settings > API.
    #
    # Stored as a SHA-256 hash, never plaintext — a DB-level leak used to
    # hand out live, directly usable keys instead of useless digests. SHA-256
    # (not bcrypt) is deliberate: the key itself is a 256-bit random token
    # (secrets.token_urlsafe(32)), not a human-chosen password, so it isn't
    # brute-forceable even via a fast deterministic hash, and a fast hash is
    # what makes an indexed exact-match lookup on every API request possible.
    # api_key_prefix is stored in the clear purely so the owner can recognize
    # which key is active in Settings — nowhere near enough of the key to
    # reconstruct or use it. Found and fixed in a security audit.
    api_key_hash = Column(String(64), unique=True, nullable=True, index=True)
    api_key_prefix = Column(String(20), nullable=True)
    api_key_created_at = Column(DateTime, nullable=True)

    users = relationship("User", back_populates="organization")
    properties = relationship("Property", back_populates="organization")
    leads = relationship("Lead", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.owner, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_master = Column(Boolean, default=False, nullable=False)  # bypasses all plan gating; full-app admin access
    mfa_secret = Column(String(64), nullable=True)  # TOTP secret; set at /mfa/setup, not active until mfa_enabled
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_backup_codes = Column(Text, nullable=True)  # JSON array of bcrypt-hashed single-use recovery codes,
                                                      # generated once when MFA is confirmed enabled; each is
                                                      # removed from the list the moment it's used. Recovery path
                                                      # for a lost/desynced authenticator app -- without this,
                                                      # a user whose TOTP goes out of sync has no way back in.
    # Single-use marker for the current outstanding password-reset JWT (see
    # routes/auth.py forgot_password/reset_password). The JWT itself is
    # stateless and stays "valid" to jose.decode for its whole 30-minute
    # window, so without a server-side value to burn on redemption, the same
    # emailed link could be replayed more than once inside that window.
    # Cleared (set back to None) the moment a reset actually succeeds, and
    # overwritten every time a new reset is requested, so only the most
    # recently issued link ever works. Found and fixed in a security audit.
    password_reset_jti = Column(String(32), nullable=True)
    # Per-account brute-force lockout, distinct from the existing per-IP rate
    # limit on /auth/login — a credential-stuffing attempt spread across many
    # source IPs isn't meaningfully slowed by an IP-based limit alone.
    # Incremented on a wrong password (routes/auth.py) or a wrong MFA/backup
    # code (routes/mfa.py) for this account; reset to 0 on any successful
    # login. Found and fixed in a security audit.
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="users")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class TrialEmailMilestone(enum.Enum):
    """Each value is one email in the trial-activation sequence (see
    services/trial_activation_service.py). Day 1 is deliberately absent --
    routes/auth.py's signup endpoint already sends a welcome/verification
    email, so this sequence picks up from day 3."""
    day3_add_property = "day3_add_property"     # nudge: still zero properties a few days in
    day7_checkin = "day7_checkin"                 # mid-trial check-in, points at an unused feature
    day13_trial_ending = "day13_trial_ending"     # trial ends day 14 -- last chance to convert


class OrgTrialEmail(Base):
    """Idempotency ledger for the trial-activation email sequence -- one row
    per (org, milestone) ever sent, so the cron job (which may run several
    times a day and re-evaluate every trialing org each time) never sends
    the same milestone email twice. A new table rather than flag columns on
    Organization since the set of milestones is expected to grow."""
    __tablename__ = "org_trial_emails"
    __table_args__ = (UniqueConstraint("organization_id", "milestone", name="uq_org_trial_email_org_milestone"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    milestone = Column(SAEnum(TrialEmailMilestone), nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    organization = relationship("Organization")
