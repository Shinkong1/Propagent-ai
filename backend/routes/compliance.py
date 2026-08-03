"""Compliance Agent routes — rental licenses, inspections, insurance, and regulatory deadlines"""
import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.plan_gate import require_plan
from models.property import Property
from models.compliance import ComplianceItem
from schemas.compliance import ComplianceItemCreate, ComplianceItemUpdate, ComplianceItemResponse
from middleware.auth import get_current_user
from services.compliance_agent import compliance_dashboard, URGENCY_RANK

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/compliance", tags=["compliance"], dependencies=[Depends(require_plan(PlanType.professional))])


@router.get("/", response_model=List[ComplianceItemResponse])
async def list_compliance_items(
    property_id: Optional[UUID] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ComplianceItem).join(Property).filter(
        Property.organization_id == current_user.organization_id,
        ComplianceItem.is_active == True,
    )
    if property_id:
        query = query.filter(ComplianceItem.property_id == property_id)
    if category:
        query = query.filter(ComplianceItem.category == category)

    items = query.all()
    items.sort(key=lambda i: (URGENCY_RANK.get(i.urgency, 9), i.expiration_date))
    return items


@router.get("/dashboard")
async def get_compliance_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compliance_dashboard(db, current_user.organization_id)


@router.post("/", response_model=ComplianceItemResponse, status_code=201)
async def create_compliance_item(
    payload: ComplianceItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(
        Property.id == payload.property_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    item = ComplianceItem(**payload.dict(), organization_id=current_user.organization_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ComplianceItemResponse)
async def update_compliance_item(
    item_id: UUID,
    payload: ComplianceItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ComplianceItem).join(Property).filter(
        ComplianceItem.id == item_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Compliance item not found")

    for field, value in payload.dict(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_compliance_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ComplianceItem).join(Property).filter(
        ComplianceItem.id == item_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Compliance item not found")

    item.is_active = False
    db.commit()
    return Response(status_code=204)
