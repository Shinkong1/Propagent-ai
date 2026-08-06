"""Tenant portal — a completely separate identity/auth surface from the
staff dashboard. Tenants log in with their own email/password (set only
after a property manager invites them), and can view their lease, pay
rent (real money, via the org's connected Stripe account — never a
PropAgent-controlled account), and submit maintenance requests.
"""
import logging
import secrets
from datetime import datetime, timedelta, date
from typing import List, Optional
from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.session import get_db
from config import settings
from models.tenant import Tenant, Lease, LeaseStatus
from models.property import Unit, Property
from models.accounting import RentPayment, PaymentStatus, PaymentMethod
from models.maintenance import MaintenanceTicket, TicketCategory, TicketPriority, TicketStatus
from middleware.auth import get_current_user, hash_password, verify_password
from middleware.tenant_auth import get_current_tenant, create_tenant_access_token
from middleware.rate_limit import limiter
from models.user import User
from services.communication_agent import send_email
from schemas.tenant_portal import (
    TenantLoginRequest, TenantActivateRequest, TenantAuthResponse,
    TenantMeOut, TenantLeaseOut, TenantPaymentOut, TenantPaymentSessionOut,
    TenantMaintenanceCreate, TenantMaintenanceOut,
    TenantForgotPasswordRequest, TenantResetPasswordRequest, LeaseSignRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tenant-portal", tags=["tenant-portal"])

stripe.api_key = settings.STRIPE_SECRET

INVITE_EXPIRY = timedelta(days=7)


def _lease_out(lease: Lease) -> Optional[TenantLeaseOut]:
    if not lease:
        return None
    unit = lease.unit
    prop = unit.property if unit else None
    return TenantLeaseOut(
        id=lease.id, monthly_rent=lease.monthly_rent, security_deposit=lease.security_deposit,
        start_date=lease.start_date, end_date=lease.end_date, status=lease.status.value,
        property_name=prop.name if prop else None,
        property_address=f"{prop.address}, {prop.city}, {prop.state}" if prop else None,
        unit_number=unit.unit_number if unit else None,
        signed_at=lease.signed_at, signature_name=lease.signature_name,
    )


def _tenant_org(tenant: Tenant):
    lease = tenant.active_lease
    if lease and lease.unit and lease.unit.property:
        return lease.unit.property.organization
    return None


# ── Staff-side: invite a tenant to the portal ──

@router.post("/invite/{tenant_id}")
async def invite_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id, Tenant.organization_id == current_user.organization_id
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not tenant.email:
        raise HTTPException(status_code=422, detail="This tenant has no email on file to invite.")

    tenant.portal_invite_token = secrets.token_urlsafe(32)
    tenant.portal_invite_expires_at = datetime.utcnow() + INVITE_EXPIRY
    tenant.portal_invited_at = datetime.utcnow()
    db.commit()

    org_name = current_user.organization.name if current_user.organization else "your property manager"
    activate_url = f"{settings.FRONTEND_URL}/portal/activate?token={tenant.portal_invite_token}"
    body = (
        f"Hi {tenant.first_name},\n\n"
        f"{org_name} has set you up with access to the tenant portal, where you can pay rent online, "
        f"see your payment history, and submit maintenance requests.\n\n"
        f"Set up your account here (link expires in 7 days):\n{activate_url}\n\n"
        f"If you weren't expecting this, you can ignore this email."
    )
    email_status, _ = await run_in_threadpool(send_email, tenant.email, f"You're invited to {org_name}'s tenant portal", body)
    return {"status": "invited", "email_status": email_status}


# ── Tenant-side: activate / login ──

@router.post("/activate", response_model=TenantAuthResponse)
@limiter.limit("10/minute")
async def activate_tenant(request: Request, payload: TenantActivateRequest, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.portal_invite_token == payload.token).first()
    if not tenant or not tenant.portal_invite_expires_at or tenant.portal_invite_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This invite link is invalid or has expired. Ask your property manager to resend it.")

    tenant.hashed_password = hash_password(payload.password)
    tenant.portal_invite_token = None
    tenant.portal_invite_expires_at = None
    tenant.portal_activated_at = datetime.utcnow()
    db.commit()

    return TenantAuthResponse(
        access_token=create_tenant_access_token(str(tenant.id)),
        tenant_id=str(tenant.id),
        full_name=tenant.full_name,
    )


@router.post("/login", response_model=TenantAuthResponse)
@limiter.limit("10/minute")
async def tenant_login(request: Request, payload: TenantLoginRequest, db: Session = Depends(get_db)):
    candidates = db.query(Tenant).filter(func.lower(Tenant.email) == payload.email.strip().lower()).all()
    tenant = next((t for t in candidates if t.hashed_password and verify_password(payload.password, t.hashed_password)), None)
    if not tenant:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not tenant.is_active:
        raise HTTPException(status_code=403, detail="This tenant account is deactivated — contact your property manager.")

    return TenantAuthResponse(
        access_token=create_tenant_access_token(str(tenant.id)),
        tenant_id=str(tenant.id),
        full_name=tenant.full_name,
    )


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def tenant_forgot_password(request: Request, payload: TenantForgotPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    # Only activated accounts (hashed_password set) -- an invite-not-yet-
    # activated tenant should use their activation link, not a reset one.
    tenants = db.query(Tenant).filter(func.lower(Tenant.email) == email, Tenant.hashed_password.isnot(None)).all()
    if tenants:
        # Reuses the same invite-token fields the activation flow uses --
        # it's the identical mechanism (prove account ownership via an
        # emailed token, then set a credential), just a shorter window.
        # The same email can legitimately belong to more than one Tenant
        # row (e.g. renting from two different organizations), so the same
        # token is set on all of them and reset-password below applies to
        # whichever rows it matches.
        token = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=1)
        for t in tenants:
            t.portal_invite_token = token
            t.portal_invite_expires_at = expires
        db.commit()

        reset_url = f"{settings.FRONTEND_URL}/portal/reset-password?token={token}"
        body = (
            f"Hi {tenants[0].first_name},\n\n"
            f"Reset your tenant portal password:\n\n{reset_url}\n\n"
            f"This link expires in 1 hour. If you didn't request this, you can ignore this email — your password hasn't changed."
        )
        await run_in_threadpool(send_email, tenants[0].email, "Reset your password — tenant portal", body)
    return {"message": "If that email has a tenant portal account, a reset link is on its way."}


@router.post("/reset-password", response_model=TenantAuthResponse)
@limiter.limit("10/minute")
async def tenant_reset_password(request: Request, payload: TenantResetPasswordRequest, db: Session = Depends(get_db)):
    candidates = db.query(Tenant).filter(Tenant.portal_invite_token == payload.token).all()
    valid = [t for t in candidates if t.portal_invite_expires_at and t.portal_invite_expires_at > datetime.utcnow()]
    if not valid:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Request a new one.")

    for t in valid:
        t.hashed_password = hash_password(payload.new_password)
        t.portal_invite_token = None
        t.portal_invite_expires_at = None
    db.commit()

    primary = valid[0]
    return TenantAuthResponse(
        access_token=create_tenant_access_token(str(primary.id)),
        tenant_id=str(primary.id),
        full_name=primary.full_name,
    )


# ── Tenant-side: portal data ──

@router.get("/me", response_model=TenantMeOut)
async def tenant_me(tenant: Tenant = Depends(get_current_tenant)):
    org = _tenant_org(tenant)
    return TenantMeOut(
        id=tenant.id, first_name=tenant.first_name, last_name=tenant.last_name,
        email=tenant.email, phone=tenant.phone,
        active_lease=_lease_out(tenant.active_lease),
        portal_status=tenant.portal_status,
        organization_name=org.name if org else None,
        rent_payments_enabled=bool(org and org.stripe_connect_onboarded),
    )


@router.post("/leases/{lease_id}/sign", response_model=TenantLeaseOut)
async def sign_lease(
    lease_id: UUID,
    payload: LeaseSignRequest,
    request: Request,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Lightweight e-signature -- typed full name + timestamp + IP, not a
    DocuSign-grade signature service. Doesn't block anything else in the
    portal if left unsigned; the frontend just prompts prominently."""
    lease = db.query(Lease).filter(Lease.id == lease_id, Lease.tenant_id == tenant.id).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    if lease.signed_at:
        raise HTTPException(status_code=400, detail="This lease has already been signed.")
    if not payload.full_name.strip():
        raise HTTPException(status_code=422, detail="Type your full name to sign.")

    lease.signed_at = datetime.utcnow()
    lease.signature_name = payload.full_name.strip()
    lease.signature_ip = request.client.host if request.client else None
    db.commit()
    db.refresh(lease)
    return _lease_out(lease)


@router.get("/payments", response_model=List[TenantPaymentOut])
async def tenant_payments(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    lease_ids = [l.id for l in tenant.leases]
    if not lease_ids:
        return []
    payments = (
        db.query(RentPayment)
        .filter(RentPayment.lease_id.in_(lease_ids))
        .order_by(RentPayment.due_date.desc())
        .all()
    )
    return [
        TenantPaymentOut(
            id=p.id, amount=p.amount, due_date=p.due_date, paid_date=p.paid_date,
            status=p.status.value, payment_method=p.payment_method.value if p.payment_method else None,
            property_name=p.property_name, unit_number=p.unit_number,
        )
        for p in payments
    ]


@router.post("/payments/{payment_id}/checkout", response_model=TenantPaymentSessionOut)
async def create_payment_checkout(payment_id: UUID, tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    lease_ids = [l.id for l in tenant.leases]
    payment = db.query(RentPayment).filter(RentPayment.id == payment_id, RentPayment.lease_id.in_(lease_ids)).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status == PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="This payment has already been made.")

    org = _tenant_org(tenant)
    if not org or not org.stripe_connect_onboarded or not org.stripe_connect_account_id:
        raise HTTPException(status_code=422, detail="Online rent payment isn't set up for this property yet — contact your property manager.")

    fee_percent = settings.RENT_PLATFORM_FEE_PERCENT
    amount_cents = int(round(payment.amount * 100))
    application_fee_cents = int(round(amount_cents * fee_percent / 100)) if fee_percent > 0 else None

    payment_intent_data = {
        "transfer_data": {"destination": org.stripe_connect_account_id},
        "metadata": {"rent_payment_id": str(payment.id)},
    }
    if application_fee_cents:
        payment_intent_data["application_fee_amount"] = application_fee_cents

    try:
        session = await run_in_threadpool(
            stripe.checkout.Session.create,
            mode="payment",
            payment_method_types=["card", "us_bank_account"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"Rent — {payment.property_name or 'your unit'}" + (f" #{payment.unit_number}" if payment.unit_number else "")},
                    "unit_amount": amount_cents,
                },
                "quantity": 1,
            }],
            payment_intent_data=payment_intent_data,
            metadata={"rent_payment_id": str(payment.id)},
            success_url=f"{settings.FRONTEND_URL}/portal/payments?paid=1",
            cancel_url=f"{settings.FRONTEND_URL}/portal/payments?canceled=1",
        )
    except Exception as e:
        logger.warning(f"Stripe checkout session creation failed for rent_payment {payment_id}: {e}")
        raise HTTPException(status_code=502, detail="Couldn't start the payment — please try again in a moment.")

    return TenantPaymentSessionOut(checkout_url=session.url)


@router.get("/maintenance", response_model=List[TenantMaintenanceOut])
async def tenant_maintenance_list(tenant: Tenant = Depends(get_current_tenant), db: Session = Depends(get_db)):
    tickets = db.query(MaintenanceTicket).filter(MaintenanceTicket.tenant_id == tenant.id).order_by(MaintenanceTicket.created_at.desc()).all()
    return [
        TenantMaintenanceOut(
            id=t.id, title=t.title, description=t.description, category=t.category.value,
            priority=t.priority.value, status=t.status.value, created_at=t.created_at,
        )
        for t in tickets
    ]


@router.post("/maintenance", response_model=TenantMaintenanceOut, status_code=201)
async def tenant_maintenance_create(
    payload: TenantMaintenanceCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    lease = tenant.active_lease
    if not lease or not lease.unit:
        raise HTTPException(status_code=422, detail="You don't have an active lease on file, so a request can't be filed automatically. Contact your property manager directly.")

    try:
        category = TicketCategory(payload.category)
    except ValueError:
        category = TicketCategory.other
    try:
        priority = TicketPriority(payload.priority)
    except ValueError:
        priority = TicketPriority.medium

    ticket = MaintenanceTicket(
        property_id=lease.unit.property_id, unit_id=lease.unit_id, tenant_id=tenant.id,
        title=payload.title, description=payload.description,
        category=category, priority=priority, status=TicketStatus.open,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return TenantMaintenanceOut(
        id=ticket.id, title=ticket.title, description=ticket.description, category=ticket.category.value,
        priority=ticket.priority.value, status=ticket.status.value, created_at=ticket.created_at,
    )
