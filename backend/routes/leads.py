"""Lead management and CRM routes"""
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from models.lead import Lead, OutreachEmail, LeadStatus, LeadSource
from middleware.auth import get_current_user
from middleware.plan_gate import require_plan
from models.workflow import WorkflowTrigger
from services.workflow_engine import run_workflows

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["leads"])


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
    return [
        {
            "id": str(l.id), "first_name": l.first_name, "last_name": l.last_name,
            "company": l.company, "email": l.email, "phone": l.phone,
            "status": l.status.value, "source": l.source.value,
            "score": l.score, "num_properties": l.num_properties,
            "city": l.city, "state": l.state, "created_at": str(l.created_at),
            "last_contacted": str(l.last_contacted) if l.last_contacted else None,
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
        run_workflows(db, current_user.organization, WorkflowTrigger.lead_created, {
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
    current_user: User = Depends(require_plan(PlanType.professional))
):
    """Queue outreach email for a lead via AI-generated personalized copy — Professional plan and up"""
    lead = db.query(Lead).filter(
        Lead.id == lead_id, Lead.organization_id == current_user.organization_id
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    from services.lead_service import queue_outreach_email
    background_tasks.add_task(queue_outreach_email, lead, db)
    return {"message": "Outreach email queued"}


@router.post("/scrape")
async def trigger_scrape(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_plan(PlanType.professional))
):
    """Trigger lead scraping from various sources — Professional plan and up"""
    from workers.tasks.lead_scraping import scrape_leads_task
    background_tasks.add_task(
        scrape_leads_task,
        org_id=str(current_user.organization_id),
        source=payload.get("source", "google_maps"),
        location=payload.get("location", ""),
    )
    return {"message": "Lead scraping started", "source": payload.get("source")}
