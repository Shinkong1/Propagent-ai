"""Communication Agent routes"""
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.plan_gate import require_plan
from models.tenant import Tenant, Lease, LeaseStatus
from models.property import Property, Unit
from models.maintenance import MaintenanceTicket
from models.communication import CommunicationLog, CommunicationChannel, CommunicationTemplate, CommunicationStatus
from schemas.communication import SendCommunicationRequest, CommunicationLogResponse
from middleware.auth import get_current_user
from services.communication_agent import TEMPLATES, render_template, send_sms, send_email

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/communications", tags=["communications"], dependencies=[Depends(require_plan(PlanType.professional))])


@router.get("/templates")
async def list_templates():
    return TEMPLATES


@router.get("/", response_model=List[CommunicationLogResponse])
async def list_communications(
    tenant_id: Optional[UUID] = None,
    property_id: Optional[UUID] = None,
    channel: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(CommunicationLog).filter(CommunicationLog.organization_id == current_user.organization_id)
    if tenant_id:
        query = query.filter(CommunicationLog.tenant_id == tenant_id)
    if property_id:
        query = query.filter(CommunicationLog.property_id == property_id)
    if channel:
        query = query.filter(CommunicationLog.channel == channel)
    return query.order_by(CommunicationLog.created_at.desc()).limit(200).all()


def _build_context(tenant: Tenant, template: str, payload: SendCommunicationRequest, db: Session) -> dict:
    lease = tenant.active_lease
    context = {
        "tenant_name": tenant.full_name,
        "property_name": tenant.property_name or "your property",
        "unit_number": tenant.unit_number or "N/A",
    }
    if template == "lease_renewal" and lease:
        context["end_date"] = str(lease.end_date)
    if template == "rent_reminder" and lease:
        context["amount"] = f"{lease.monthly_rent:,.2f}"
    if template == "maintenance_update" and payload.ticket_id:
        # Org-scoped via the property join (MaintenanceTicket has no direct
        # organization_id column) -- unlike every sibling lookup in this
        # codebase, this one was missing org scoping entirely, letting any
        # staff user reference (and leak the title/status of) another org's
        # maintenance ticket by UUID. Found in a security audit.
        ticket = db.query(MaintenanceTicket).join(Property).filter(
            MaintenanceTicket.id == payload.ticket_id,
            Property.organization_id == tenant.organization_id,
        ).first()
        if ticket:
            context["ticket_title"] = ticket.title
            context["ticket_status"] = ticket.status.value.replace("_", " ")
    if template == "community_announcement":
        context["announcement_text"] = payload.custom_body or ""
    if template == "emergency_notification":
        context["emergency_text"] = payload.custom_body or ""
    return context


async def _send_and_log(db: Session, org, tenant: Optional[Tenant], property_obj: Optional[Property],
                         channel: str, template: str, subject: str, body: str) -> CommunicationLog:
    org_id = org.id if org else None
    recipient = ""
    status = CommunicationStatus.logged_only
    error = None

    if channel == "sms":
        recipient = (tenant.phone if tenant else None) or "unknown"
        if org and not org.notify_sms_enabled:
            error = "SMS notifications are disabled in Settings for this organization."
        elif tenant and tenant.phone:
            # send_sms/send_email are blocking network calls — run off the event
            # loop so a slow provider doesn't stall every other request.
            status_str, error = await run_in_threadpool(send_sms, tenant.phone, body)
            status = CommunicationStatus(status_str)
        else:
            error = "No phone number on file for this tenant."
    elif channel == "email":
        recipient = (tenant.email if tenant else None) or "unknown"
        if org and not org.notify_email_enabled:
            error = "Email notifications are disabled in Settings for this organization."
        elif tenant and tenant.email:
            status_str, error = await run_in_threadpool(send_email, tenant.email, subject, body)
            status = CommunicationStatus(status_str)
        else:
            error = "No email address on file for this tenant."
    else:  # in_app
        recipient = tenant.full_name if tenant else "all tenants"
        status = CommunicationStatus.sent

    log = CommunicationLog(
        organization_id=org_id,
        tenant_id=tenant.id if tenant else None,
        property_id=property_obj.id if property_obj else None,
        channel=CommunicationChannel(channel),
        template=CommunicationTemplate(template),
        recipient=recipient,
        subject=subject,
        body=body,
        status=status,
        error_message=error,
    )
    db.add(log)
    return log


@router.post("/send", response_model=List[CommunicationLogResponse], status_code=201)
async def send_communication(
    payload: SendCommunicationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        CommunicationChannel(payload.channel)
        CommunicationTemplate(payload.template)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not payload.tenant_id and not payload.property_id:
        raise HTTPException(status_code=422, detail="Either tenant_id or property_id is required.")

    logs = []

    if payload.tenant_id:
        tenant = db.query(Tenant).filter(
            Tenant.id == payload.tenant_id,
            Tenant.organization_id == current_user.organization_id,
        ).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        if payload.template == "custom":
            subject, body = payload.custom_subject or "", payload.custom_body or ""
        else:
            context = _build_context(tenant, payload.template, payload, db)
            subject, body = render_template(payload.template, context)

        tenant_property = db.query(Property).filter(Property.id == tenant.property_id).first() if tenant.property_id else None
        logs.append(await _send_and_log(db, current_user.organization, tenant, tenant_property,
                                         payload.channel, payload.template, subject, body))

    else:  # broadcast to all active tenants at the property
        prop = db.query(Property).filter(
            Property.id == payload.property_id,
            Property.organization_id == current_user.organization_id,
        ).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

        tenants = db.query(Tenant).join(Lease, Lease.tenant_id == Tenant.id).join(Unit).filter(
            Unit.property_id == prop.id,
            Lease.status == LeaseStatus.active,
            Tenant.is_active == True,
        ).all()
        if not tenants:
            raise HTTPException(status_code=404, detail="No active tenants found at this property.")

        for tenant in tenants:
            if payload.template == "custom":
                subject, body = payload.custom_subject or "", payload.custom_body or ""
            else:
                context = _build_context(tenant, payload.template, payload, db)
                subject, body = render_template(payload.template, context)
            logs.append(await _send_and_log(db, current_user.organization, tenant, prop, payload.channel, payload.template, subject, body))

    db.commit()
    for log in logs:
        db.refresh(log)
    return logs
