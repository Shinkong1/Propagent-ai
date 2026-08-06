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
    FROM_EMAIL: str = "propagentapp@gmail.com"

    ALLOWED_ORIGINS: list = ["http://localhost:3000", "https://app.propagent.ai"]

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

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
