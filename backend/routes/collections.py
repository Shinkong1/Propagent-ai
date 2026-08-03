"""Collections Agent routes — automated delinquency escalation"""
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.plan_gate import require_plan
from models.accounting import RentPayment
from models.tenant import Lease
from models.property import Unit, Property
from models.collections import CollectionsAction, CollectionsActionType
from schemas.collections import CollectionsActionCreate, CollectionsActionResponse, CollectionsSettingsUpdate
from middleware.auth import get_current_user
from services.collections_agent import compute_collections_queue, collections_summary

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/collections", tags=["collections"], dependencies=[Depends(require_plan(PlanType.professional))])


@router.get("/queue")
async def get_collections_queue(
    property_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    queue = compute_collections_queue(db, org, property_id)
    return {"summary": collections_summary(queue), "queue": queue}


@router.get("/settings")
async def get_collections_settings(current_user: User = Depends(get_current_user)):
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "collections_day_reminder": org.collections_day_reminder,
        "collections_day_late_fee": org.collections_day_late_fee,
        "collections_day_payment_plan": org.collections_day_payment_plan,
        "collections_day_manager_notify": org.collections_day_manager_notify,
        "collections_day_legal_prep": org.collections_day_legal_prep,
        "collections_late_fee_percent": org.collections_late_fee_percent,
    }


@router.patch("/settings")
async def update_collections_settings(
    payload: CollectionsSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for field, value in payload.dict(exclude_none=True).items():
        setattr(org, field, value)
    db.commit()
    return await get_collections_settings(current_user)


@router.post("/{payment_id}/actions", response_model=CollectionsActionResponse, status_code=201)
async def record_collections_action(
    payment_id: UUID,
    payload: CollectionsActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).join(Property).filter(
        RentPayment.id == payment_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    try:
        action_type = CollectionsActionType(payload.action_type)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid action_type: {payload.action_type}")

    action = CollectionsAction(
        rent_payment_id=payment_id,
        action_type=action_type,
        amount=payload.amount,
        notes=payload.notes,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


@router.get("/{payment_id}/history", response_model=List[CollectionsActionResponse])
async def get_collections_history(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).join(Property).filter(
        RentPayment.id == payment_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return db.query(CollectionsAction).filter(
        CollectionsAction.rent_payment_id == payment_id
    ).order_by(CollectionsAction.action_date.desc()).all()
