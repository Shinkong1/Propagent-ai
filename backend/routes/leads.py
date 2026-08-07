"""Lead management and CRM routes — this is PropAgent AI's own sales pipeline
for finding and closing *new subscribers* to the platform (scraping
landlords/property managers off Google Maps, LinkedIn, Zillow and sending
AI outreach pitching PropAgent AI itself). It has nothing to do with any
subscriber's own tenants or rental leads, so it's restricted to the
platform owner only — a regular subscriber has no reason to be sending
sales outreach on PropAgent's behalf."""
import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from models.lead import Lead, OutreachEmail, LeadStatus, LeadSource
from middleware.auth import get_current_user
from middleware.plan_gate import require_master
from models.workflow import WorkflowTrigger
from services.workflow_engine import run_workflows

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["leads"], dependencies=[Depends(require_master)])


@router.get("/", response_model=List[dict])
async def list_leads(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Lead).filter(Lead.organization_id == current_user.organization_id)
    if status:
        query = query.filter(Lead.status == status)
    leads = query.order_by(Lead.score.desc(), Lead.created_at.desc()).all()

    def _outreach_info(lead: Lead) -> dict:
        if not lead.outreach_emails:
            return {"outreach_status": None, "outreach_sent_at": None}
        latest = max(lead.outreach_emails, key=lambda e: e.created_at)
        return {
            "outreach_status": latest.status,
            "outreach_sent_at": str(latest.sent_at) if latest.sent_at else None,
        }

    return [
        {
            "id": str(l.id), "first_name": l.first_name, "last_name": l.last_name,
            "company": l.company, "email": l.email, "phone": l.phone,
            "status": l.status.value, "source": l.source.value,
            "score": l.score, "num_properties": l.num_properties,
            "city": l.city, "state": l.state, "created_at": str(l.created_at),
            "last_contacted": str(l.last_contacted) if l.last_contacted else None,
            **_outreach_info(l),
        }
        for l in leads
    ]


@router.post("/", status_code=201)
async def create_lead(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = Lead(
        organization_id=current_user.organization_id,
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
        company=payload.get("company"),
        email=payload.get("email"),
        phone=payload.get("phone"),
        city=payload.get("city"),
        state=payload.get("state"),
        num_properties=payload.get("num_properties"),
        source=LeadSource.manual,
        status=LeadStatus.new,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    try:
        # A matching workflow rule can send email/SMS synchronously (blocking
        # SMTP/HTTP calls) -- this server runs a single worker/event loop, so
        # that would otherwise freeze every request for every user, not just
        # this one, until the send times out.
        await run_in_threadpool(run_workflows, db, current_user.organization, WorkflowTrigger.lead_created, {
            "name": f"{lead.first_name} {lead.last_name}".strip(),
            "source": lead.source.value if lead.source else None,
            "status": lead.status.value if lead.status else None,
            "email": lead.email,
            "phone": lead.phone,
        })
    except Exception as e:
        logger.warning(f"Workflow evaluation failed for lead {lead.id}: {e}")

    return {"id": str(lead.id), "message": "Lead created"}


@router.patch("/{lead_id}/status")
async def update_lead_status(
    lead_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lead = db.query(Lead).filter(
        Lead.id == lead_id, Lead.organization_id == current_user.organization_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.status = payload.get("status", lead.status)
    lead.notes = payload.get("notes", lead.notes)
    db.commit()
    return {"message": "Updated"}


@router.post("/{lead_id}/outreach")
async def send_outreach(
    lead_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Queue outreach email for a lead via AI-generated personalized copy."""
    lead = db.query(Lead).filter(
        Lead.id == lead_id, Lead.organization_id == current_user.organization_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    from services.lead_service import queue_outreach_email
    background_tasks.add_task(queue_outreach_email, lead, db)
    return {"message": "Outreach email queued"}


@router.post("/{lead_id}/mark-replied")
async def mark_replied(
    lead_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """There's no inbound-email parsing in this app -- replies land in a
    real inbox a human reads, not a webhook. This is that human telling
    the system "they wrote back," which marks the latest outreach email
    replied, moves the lead to interested, and queues the step-2
    follow-up (which points them at the automated demo)."""
    lead = db.query(Lead).filter(
        Lead.id == lead_id, Lead.organization_id == current_user.organization_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    latest = max(lead.outreach_emails, key=lambda e: e.created_at) if lead.outreach_emails else None
    if latest:
        latest.status = "replied"
        latest.replied_at = latest.replied_at or datetime.utcnow()

    if lead.status == LeadStatus.new:
        lead.status = LeadStatus.interested
    db.commit()

    from services.lead_service import queue_followup_email
    background_tasks.add_task(queue_followup_email, lead, db)
    return {"message": "Marked replied; follow-up with demo link queued"}


@router.post("/scrape")
async def trigger_scrape(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger lead scraping from various sources."""
    from workers.tasks.lead_scraping import scrape_leads_task
    background_tasks.add_task(
        scrape_leads_task,
        org_id=str(current_user.organization_id),
        source=payload.get("source", "google_maps"),
        location=payload.get("location", ""),
    )
    return {"message": "Lead scraping started", "source": payload.get("source")}
