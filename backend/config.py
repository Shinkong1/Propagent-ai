"""
PropAgent AI — Application Configuration
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "PropAgent AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"

    DATABASE_URL: str = "postgresql://propagent:propagent@localhost:5432/propagent"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "jwt-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    STRIPE_SECRET: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_STARTER_PRICE_ID: str = "price_starter"
    STRIPE_PRO_PRICE_ID: str = "price_pro"
    STRIPE_ENTERPRISE_PRICE_ID: str = "price_enterprise"
    # $19/mo addon: a dedicated Voice AI phone number for one org, instead of
    # sharing the platform's single Twilio number with every other org (see
    # services/voice_number_service.py). Create this Price in the Stripe
    # Dashboard yourself (recurring, $19/mo) and set its price_xxx id here --
    # empty by default, which /billing/voice-number/checkout treats as "not
    # configured yet" and refuses to sell an addon with no real price behind it.
    STRIPE_VOICE_NUMBER_PRICE_ID: str = ""
    # Stripe Connect — separate webhook endpoint/secret from the platform
    # subscription webhook above, since these events describe *tenants'* rent
    # payments into a connected org's own account, not PropAgent's own billing.
    # Stripe creates one destination per payload style (snapshot vs thin) even
    # when they share a URL, and each gets its own signing secret — so this
    # endpoint has to be able to verify against either one.
    STRIPE_CONNECT_WEBHOOK_SECRET: str = ""
    STRIPE_CONNECT_WEBHOOK_SECRET_V2: str = ""
    # Optional platform fee taken out of each rent payment, as a percent
    # (e.g. 1.0 = 1%). 0 by default — never silently take a cut.
    RENT_PLATFORM_FEE_PERCENT: float = 0.0

    # Shared secret for /internal/cron/* endpoints — an external free
    # scheduler (e.g. cron-job.org) hits these on a timer in production,
    # since no paid background worker is deployed. Empty by default, which
    # the route treats as "not configured" and refuses all requests rather
    # than silently running unauthenticated.
    CRON_SECRET: str = ""

    # Separate shared secret for the Cloudflare Email Worker that detects
    # inbound replies to Lead CRM outreach emails (infra/cloudflare/
    # email-reply-worker.js -> POST /internal/email/inbound-reply). Kept
    # distinct from CRON_SECRET so a leak of one doesn't also expose the
    # other -- different trust boundary (a Worker's environment vs a
    # scheduler service's).
    EMAIL_WORKER_SECRET: str = ""

    TWILIO_SID: str = ""
    TWILIO_TOKEN: str = ""
    TWILIO_PHONE: str = ""
    # The public HTTPS origin Twilio actually calls (e.g. a cloudflared/ngrok tunnel
    # or your production domain) — needed to reconstruct the exact URL Twilio signed,
    # since the request as seen inside the container only shows the internal host.
    PUBLIC_BASE_URL: str = ""

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@propagent.app"

    # HTTP-based email (port 443, never blocked by network-level SMTP port
    # restrictions) -- used instead of SMTP whenever configured. See
    # services/communication_agent.py send_email().
    RESEND_API_KEY: str = ""

    # "app.propagent.ai" here was never the real production domain -- the
    # actual frontend has always been at propagent.app (confirmed via DNS/MX
    # records, the live API docs page, and everywhere else this session
    # referenced the real domain). Production presumably already overrides
    # this via Render's env vars (the site works, so CORS isn't actually
    # blocking it) -- fixing the fallback here so it's not silently wrong
    # for any new environment that relies on the default.
    #
    # Deliberately a plain str, not list[str] -- pydantic-settings decodes
    # complex-typed (list/dict) env vars as JSON at the settings-SOURCE
    # level, before any field validator gets a chance to intercept it. If
    # this were typed as a list and someone ever edits this env var in
    # Render's dashboard as the intuitive plain comma-separated text (rather
    # than a JSON array with quotes/brackets), `Settings()` -- which runs at
    # IMPORT time (see get_settings() below, called at module scope) --
    # would raise and crash the entire process before the app even starts.
    # Kept as a string and parsed permissively in allowed_origins below, so
    # either format works and a typo here can never take the whole app down.
    ALLOWED_ORIGINS: str = "http://localhost:3000,https://propagent.app,https://www.propagent.app"

    # Google OAuth2/OIDC login — feature is simply hidden (never faked) until both
    # are configured with a real Google Cloud OAuth client.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    # Exact redirect URI registered in Google Cloud Console for this OAuth client,
    # e.g. https://your-tunnel.trycloudflare.com/auth/oauth/google/callback
    GOOGLE_REDIRECT_URI: str = ""
    # Where the frontend lives, so the OAuth callback can redirect the browser back
    # with a real session token after Google's redirect lands on the backend.
    FRONTEND_URL: str = "http://localhost:3000"

    # Google Places API (New) key used by workers/tasks/lead_scraping.py to find
    # real property management companies for PropAgent's own B2B sales pipeline
    # (see routes/leads.py POST /scrape). Separate Google Cloud credential from
    # GOOGLE_CLIENT_ID/SECRET above -- those are for user-facing OAuth login,
    # this is a server-side API key for Places Text Search. Empty by default,
    # which the scraper treats as "not configured" and refuses to run (it will
    # NOT fall back to fake/demo leads).
    GOOGLE_PLACES_API_KEY: str = ""

    # Target markets for automated daily lead scraping -- read by the
    # /internal/cron/lead-scrape endpoint (routes/internal_cron.py). Either:
    #   - "Austin, TX,Dallas, TX,Phoenix, AZ" -- an explicit comma-separated
    #     list, searched in full every run, or
    #   - "nationwide" -- rotates through workers/tasks/lead_scraping.py's
    #     US_TOP_METROS (~100 major US metros across every region), a
    #     handful per day, so real nationwide coverage builds up over
    #     roughly 10 days without hitting the (billed) Places API for the
    #     whole country in one run.
    # Empty by default: workers/tasks/lead_scraping.py deliberately refuses
    # to invent a default search location rather than fabricate one, so
    # this must be set explicitly before automated scraping does anything.
    LEAD_SCRAPE_LOCATIONS: str = ""

    # Meta Graph API (Facebook Login for Business) -- powers automated
    # Facebook Page + Instagram Business Account posting in routes/social.py
    # and services/social_posting_service.py. Create an app at
    # https://developers.facebook.com, add the "Facebook Login for Business"
    # product, and (beyond your own admin/tester accounts) submit for App
    # Review + Business Verification to request pages_manage_posts and
    # instagram_content_publish. Empty by default -- the feature is simply
    # hidden (never faked) until all three are set.
    FACEBOOK_APP_ID: str = ""
    FACEBOOK_APP_SECRET: str = ""
    # Exact redirect URI registered in the Facebook app's OAuth settings,
    # e.g. https://api.propagent.ai/social/facebook/callback
    FACEBOOK_REDIRECT_URI: str = ""

    # LinkedIn Marketing API -- powers automated Company Page posting in
    # routes/social.py and services/social_posting_service.py. Create an app
    # at https://www.linkedin.com/developers/apps, then request the
    # "Marketing Developer Platform" product (approval required) to unlock
    # the w_organization_social / r_organization_admin scopes used here.
    # Empty by default -- hidden (never faked) until all three are set.
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    # Exact redirect URI registered in the LinkedIn app's OAuth settings,
    # e.g. https://api.propagent.ai/social/linkedin/callback
    LINKEDIN_REDIRECT_URI: str = ""

    # X/Twitter is intentionally NOT integrated -- posting requires a paid
    # API tier (no free-tier write access as of this app's build) that
    # hasn't been purchased. TODO: add FACEBOOK/LINKEDIN-style settings here
    # once a paid X API plan is decided on; don't stub/fake it before then.

    # Cloudflare R2 (S3-compatible object storage) for uploaded documents and
    # inspection photos -- see services/storage_service.py. Render's local
    # disk is ephemeral (wiped on every deploy/restart), which was silently
    # losing every uploaded file while the database row describing it (and
    # a now-dead file_path) survived. Empty by default: storage_service
    # falls back to local disk (same as before) until all four are set, so
    # this stays a no-op change until R2 is actually configured.
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""

    @property
    def allowed_origins(self) -> list:
        """Parses ALLOWED_ORIGINS permissively -- accepts either a JSON
        array (["https://a.com","https://b.com"]) or plain comma-separated
        text (https://a.com,https://b.com), so however an operator actually
        types it into Render's dashboard, it works rather than crashing the
        app at startup."""
        raw = self.ALLOWED_ORIGINS.strip()
        if raw.startswith("["):
            import json
            try:
                return json.loads(raw)
            except ValueError:
                pass  # fall through to comma-split below
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
