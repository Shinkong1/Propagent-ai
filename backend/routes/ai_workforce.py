"""AI Workforce Command Center — real, org-scoped stats for each AI agent
already running in this platform (leasing, maintenance, accounting,
compliance, voice, executive chat, portfolio analysis), plus PropAgent's
own sales agent for the platform owner. Every number here is computed
from real tables at request time; nothing is hardcoded, matching the rest
of this codebase's zero-fake-data rule (see the Voice AI dashboard, which
used to show a hardcoded "247" before it was rebuilt on real data).
"""
import logging
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.session import get_db
from middleware.auth import get_current_user
from models.user import User
from models.inquiry import RentalInquiry, InquiryStatus
from models.maintenance import MaintenanceTicket, TicketStatus
from models.accounting import RentPayment, Expense, PaymentStatus
from models.compliance import ComplianceItem, ComplianceStatus
from models.property import Property, Unit
from models.tenant import Lease
from models.voice_call import VoiceCall
from models.platform import AICallLog
from models.lead import Lead, LeadStatus
from schemas.ai_workforce import AgentCard, AgentStat, AIWorkforceSummary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai-workforce", tags=["ai-workforce"])


def _pct(numerator: int, denominator: int) -> str:
    if not denominator:
        return "—"
    return f"{round(numerator / denominator * 100)}%"


def _duration(seconds) -> str:
    if seconds is None:
        return "—"
    seconds = int(seconds)
    return f"{seconds // 60}:{seconds % 60:02d}"


@router.get("/summary", response_model=AIWorkforceSummary)
async def workforce_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = current_user.organization_id
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today = date.today()
    agents = []

    # ── AI Leasing Agent ──
    inquiry_q = db.query(RentalInquiry).filter(RentalInquiry.organization_id == org_id)
    inquiries_total = inquiry_q.count()
    new_inquiries_30d = inquiry_q.filter(RentalInquiry.created_at >= now - timedelta(days=30)).count()
    converted_total = inquiry_q.filter(RentalInquiry.status == InquiryStatus.converted).count()
    agents.append(AgentCard(
        key="leasing", name="AI Leasing Agent",
        description="Qualifies prospects, screens applicants, and tracks every rental inquiry through to lease-up.",
        icon="leasing", link="/dashboard/inquiries",
        stats=[
            AgentStat(label="New inquiries (30d)", value=str(new_inquiries_30d)),
            AgentStat(label="Converted to tenant", value=str(converted_total)),
            AgentStat(label="Conversion rate", value=_pct(converted_total, inquiries_total)),
        ],
    ))

    # ── AI Maintenance Coordinator ──
    ticket_q = db.query(MaintenanceTicket).join(Property).filter(Property.organization_id == org_id)
    open_tickets = ticket_q.filter(MaintenanceTicket.status.in_([
        TicketStatus.open, TicketStatus.in_progress, TicketStatus.waiting_vendor, TicketStatus.scheduled,
    ])).count()
    completed_month = ticket_q.filter(
        MaintenanceTicket.status == TicketStatus.completed,
        MaintenanceTicket.completed_date >= month_start,
    ).count()
    ai_assisted_month = ticket_q.filter(
        MaintenanceTicket.ai_classification.isnot(None),
        MaintenanceTicket.created_at >= month_start,
    ).count()
    agents.append(AgentCard(
        key="maintenance", name="AI Maintenance Coordinator",
        description="Triages incoming requests, classifies urgency, and coordinates vendor dispatch.",
        icon="maintenance", link="/dashboard/maintenance",
        stats=[
            AgentStat(label="Open requests", value=str(open_tickets)),
            AgentStat(label="Completed this month", value=str(completed_month)),
            AgentStat(label="AI-assisted this month", value=str(ai_assisted_month)),
        ],
    ))

    # ── AI Accounting Assistant ──
    payments_month = (
        db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).join(Property)
        .filter(Property.organization_id == org_id, RentPayment.created_at >= month_start).count()
    )
    expenses_month = db.query(Expense).join(Property).filter(
        Property.organization_id == org_id, Expense.created_at >= month_start,
    ).count()
    overdue_rent = (
        db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).join(Property)
        .filter(
            Property.organization_id == org_id,
            RentPayment.status.in_([PaymentStatus.pending, PaymentStatus.late]),
            RentPayment.due_date < today,
        ).count()
    )
    agents.append(AgentCard(
        key="accounting", name="AI Accounting Assistant",
        description="Tracks rent collection, logs expenses, and flags overdue payments automatically.",
        icon="accounting", link="/dashboard/accounting",
        stats=[
            AgentStat(label="Transactions this month", value=str(payments_month + expenses_month)),
            AgentStat(label="Rent overdue", value=str(overdue_rent)),
        ],
    ))

    # ── AI Compliance Officer (professional+) ──
    compliance_q = db.query(ComplianceItem).filter(
        ComplianceItem.organization_id == org_id, ComplianceItem.status == ComplianceStatus.active,
    )
    expired = compliance_q.filter(ComplianceItem.expiration_date < today).count()
    due_14d = compliance_q.filter(
        ComplianceItem.expiration_date >= today, ComplianceItem.expiration_date <= today + timedelta(days=14),
    ).count()
    due_90d = compliance_q.filter(
        ComplianceItem.expiration_date >= today, ComplianceItem.expiration_date <= today + timedelta(days=90),
    ).count()
    agents.append(AgentCard(
        key="compliance", name="AI Compliance Officer",
        description="Watches lease, license, and inspection deadlines across your portfolio and warns before they lapse.",
        icon="compliance", link="/dashboard/compliance", min_tier="professional",
        stats=[
            AgentStat(label="Expired", value=str(expired)),
            AgentStat(label="Due within 14 days", value=str(due_14d)),
            AgentStat(label="Due within 90 days", value=str(due_90d)),
        ],
    ))

    # ── AI Receptionist (Voice, professional+) ──
    voice_q = db.query(VoiceCall).filter(VoiceCall.organization_id == org_id)
    calls_month = voice_q.filter(VoiceCall.started_at >= month_start).count()
    resolved_calls = voice_q.filter(VoiceCall.status == "completed").count()
    avg_duration = (
        db.query(func.avg(VoiceCall.duration_seconds))
        .filter(VoiceCall.organization_id == org_id, VoiceCall.duration_seconds.isnot(None)).scalar()
    )
    agents.append(AgentCard(
        key="voice", name="AI Receptionist",
        description="Answers inbound calls 24/7, understands the caller's request, and takes action or a message.",
        icon="voice", link="/dashboard/voice", min_tier="professional",
        stats=[
            AgentStat(label="Calls this month", value=str(calls_month)),
            AgentStat(label="Resolved", value=str(resolved_calls)),
            AgentStat(label="Avg. duration", value=_duration(avg_duration)),
        ],
    ))

    # ── AI Executive Assistant (professional+) ──
    exec_calls_month = db.query(AICallLog).filter(
        AICallLog.organization_id == org_id, AICallLog.feature == "executive_query",
        AICallLog.created_at >= month_start,
    ).count()
    agents.append(AgentCard(
        key="executive", name="AI Executive Assistant",
        description="Answers portfolio-wide questions in plain English, pulling live data across every property.",
        icon="executive", link="/dashboard/executive", min_tier="professional",
        stats=[AgentStat(label="Conversations this month", value=str(exec_calls_month))],
    ))

    # ── AI Portfolio Analyst (enterprise) ──
    property_count = db.query(Property).filter(Property.organization_id == org_id).count()
    unit_count = db.query(Unit).join(Property).filter(Property.organization_id == org_id).count()
    agents.append(AgentCard(
        key="portfolio", name="AI Portfolio Analyst",
        description="Surfaces underperforming properties, rent-growth opportunities, and portfolio-wide trends.",
        icon="portfolio", link="/dashboard/portfolio", min_tier="enterprise",
        stats=[
            AgentStat(label="Properties analyzed", value=str(property_count)),
            AgentStat(label="Units analyzed", value=str(unit_count)),
        ],
    ))

    # ── AI Sales Agent (PropAgent's own pipeline, platform owner only) ──
    if current_user.is_master:
        lead_q = db.query(Lead).filter(Lead.organization_id == org_id)
        leads_month = lead_q.filter(Lead.created_at >= month_start).count()
        leads_total = lead_q.count()
        closed_won = lead_q.filter(Lead.status == LeadStatus.closed_won).count()
        agents.append(AgentCard(
            key="sales", name="AI Sales Agent",
            description="Finds and pitches new PropAgent AI subscribers -- PropAgent's own growth engine, not a customer-facing agent.",
            icon="sales", link="/dashboard/leads", master_only=True,
            stats=[
                AgentStat(label="New leads this month", value=str(leads_month)),
                AgentStat(label="Closed won", value=str(closed_won)),
                AgentStat(label="Conversion rate", value=_pct(closed_won, leads_total)),
            ],
        ))

    return AIWorkforceSummary(agents=agents)
