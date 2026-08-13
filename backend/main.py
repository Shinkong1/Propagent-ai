"""
PropAgent AI — FastAPI Application Entry Point
"""
import logging
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

# Make sure backend dir and project root (for agents/, voice/, workers/, lead_engine/) are on path
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"🚀 Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    try:
        from alembic.config import Config
        from alembic import command as alembic_command
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
        alembic_cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "alembic"))
        alembic_command.upgrade(alembic_cfg, "head")
        logger.info("✅ Database migrated to head")
    except Exception as e:
        # Real gap found in a launch-readiness audit: this used to only log
        # and then `yield` anyway, serving requests against a possibly
        # stale/partially-migrated schema with no signal anywhere that
        # anything was wrong. /health (below) was ALSO a static 200 with no
        # DB check, so Render had no way to detect a broken instance and
        # would keep routing real traffic to it instead of restarting it.
        # Re-raising here means the container actually fails to start --
        # Render's own deploy health check (render.yaml's healthCheckPath)
        # then correctly refuses to cut traffic over to the broken deploy
        # and keeps serving the last known-good version instead, rather
        # than silently going live half-broken.
        logger.error(f"❌ Database migration failed: {e}")
        raise
    yield
    logger.info("🛑 Shutting down PropAgent AI")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered property management SaaS platform",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

from middleware.rate_limit import limiter
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    # slowapi's own default handler returns {"error": "..."} with no
    # "detail" key -- every error-display call site in the frontend reads
    # err.response.data.detail and silently falls back to a generic,
    # WRONG message when that key is missing ("Invalid code, check your
    # authenticator app" on a 429, when the code was never even checked).
    # Real, confirmed report: a legitimate MFA code got hidden behind this
    # exact mislabeling after a few retries during troubleshooting tripped
    # the limiter. Match the shape every other error in this API uses.
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many attempts. Please wait a minute and try again."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ──
from routes.auth import router as auth_router
from routes.properties import router as properties_router
from routes.tenants import router as tenants_router
from routes.maintenance import router as maintenance_router
from routes.leads import router as leads_router
from routes.voice import router as voice_router, staff_router as voice_staff_router
from routes.billing import router as billing_router
from routes.screening import router as screening_router
from routes.accounting import router as accounting_router
from routes.executive import router as executive_router
from routes.portfolio import router as portfolio_router
from routes.compliance import router as compliance_router
from routes.collections import router as collections_router
from routes.investment import router as investment_router
from routes.documents import router as documents_router
from routes.pricing import router as pricing_router
from routes.inspections import router as inspections_router
from routes.communications import router as communications_router
from routes.admin import router as admin_router
from routes.contact import router as contact_router
from routes.team import router as team_router
from routes.mfa import router as mfa_router
from routes.oauth import router as oauth_router
from routes.workflows import router as workflows_router
from routes.predictive import router as predictive_router
from routes.fraud import router as fraud_router
from routes.public_api import router as public_api_router
from routes.tenant_portal import router as tenant_portal_router
from routes.internal_cron import router as internal_cron_router
from routes.internal_email import router as internal_email_router
from routes.inquiries import router as inquiries_router
from routes.verification import router as verification_router
from routes.ai_workforce import router as ai_workforce_router
from routes.social import router as social_router
from routes.testimonials import router as testimonials_router, admin_router as testimonials_admin_router

for r in [auth_router, properties_router, tenants_router, maintenance_router,
          leads_router, voice_router, voice_staff_router, billing_router, screening_router, accounting_router,
          executive_router, portfolio_router, compliance_router, collections_router, investment_router,
          documents_router, pricing_router, inspections_router, communications_router, admin_router, contact_router,
          team_router, mfa_router, oauth_router, workflows_router, predictive_router, fraud_router, public_api_router,
          tenant_portal_router, internal_cron_router, internal_email_router, inquiries_router, verification_router, ai_workforce_router,
          social_router, testimonials_router, testimonials_admin_router]:
    app.include_router(r)


@app.get("/", tags=["health"])
async def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "status": "running", "docs": "/docs"}


@app.get("/health", tags=["health"])
async def health():
    # Used to be a static 200 regardless of whether the app could actually
    # serve any real request -- render.yaml points its deploy health check
    # here, so a DB outage/misconfiguration meant Render kept routing
    # traffic to an instance where nearly every route (i.e. almost the
    # entire API) would 500, with nothing anywhere signaling the instance
    # was unhealthy. A lightweight `SELECT 1` is enough to catch a dead/
    # misconfigured DATABASE_URL without adding meaningful latency.
    from fastapi.concurrency import run_in_threadpool
    from sqlalchemy import text
    from database.base import SessionLocal

    def _check_db():
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()

    try:
        await run_in_threadpool(_check_db)
    except Exception as e:
        logger.error(f"Health check: database unreachable: {e}")
        return JSONResponse(status_code=503, content={"status": "unhealthy", "detail": "database unreachable"})

    return {"status": "healthy", "version": settings.APP_VERSION}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
    try:
        from database.base import SessionLocal
        from models.platform import ErrorLog
        db = SessionLocal()
        try:
            db.add(ErrorLog(path=str(request.url.path), method=request.method, error_message=str(exc)[:2000]))
            db.commit()
        finally:
            db.close()
    except Exception:
        pass  # never let error logging itself crash the error handler
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
