"""Inspection AI Agent routes"""
import json
import logging
import os
import uuid
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.plan_gate import require_plan
from models.property import Property, Unit
from models.inspection import Inspection, InspectionPhoto, InspectionType, InspectionStatus
from schemas.inspection import InspectionCreate, InspectionUpdate, InspectionResponse, InspectionListItem
from middleware.auth import get_current_user
from services.inspection_agent import analyze_photo, generate_inspection_report_pdf

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inspections", tags=["inspections"], dependencies=[Depends(require_plan(PlanType.professional))])

UPLOAD_ROOT = "/app/uploads/inspections"
MAX_PHOTO_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("/", response_model=List[InspectionListItem])
async def list_inspections(
    property_id: Optional[UUID] = None,
    unit_id: Optional[UUID] = None,
    inspection_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Inspection).join(Property).filter(
        Property.organization_id == current_user.organization_id,
        Inspection.is_active == True,
    )
    if property_id:
        query = query.filter(Inspection.property_id == property_id)
    if unit_id:
        query = query.filter(Inspection.unit_id == unit_id)
    if inspection_type:
        query = query.filter(Inspection.inspection_type == inspection_type)
    return query.order_by(Inspection.inspection_date.desc()).all()


@router.post("/", response_model=InspectionResponse, status_code=201)
async def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prop = db.query(Property).filter(
        Property.id == payload.property_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    if payload.unit_id:
        unit = db.query(Unit).filter(Unit.id == payload.unit_id, Unit.property_id == payload.property_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found on this property")

    try:
        type_enum = InspectionType(payload.inspection_type)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid inspection_type: {payload.inspection_type}")

    inspection = Inspection(
        organization_id=current_user.organization_id,
        property_id=payload.property_id,
        unit_id=payload.unit_id,
        inspection_type=type_enum,
        inspection_date=payload.inspection_date,
        inspector_name=payload.inspector_name,
        notes=payload.notes,
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


@router.get("/{inspection_id}", response_model=InspectionResponse)
async def get_inspection(
    inspection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inspection = db.query(Inspection).join(Property).filter(
        Inspection.id == inspection_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection


@router.patch("/{inspection_id}", response_model=InspectionResponse)
async def update_inspection(
    inspection_id: UUID,
    payload: InspectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inspection = db.query(Inspection).join(Property).filter(
        Inspection.id == inspection_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    for field, value in payload.dict(exclude_none=True).items():
        setattr(inspection, field, value)
    db.commit()
    db.refresh(inspection)
    return inspection


@router.delete("/{inspection_id}", status_code=204)
async def delete_inspection(
    inspection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inspection = db.query(Inspection).join(Property).filter(
        Inspection.id == inspection_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    inspection.is_active = False
    db.commit()
    return Response(status_code=204)


@router.post("/{inspection_id}/photos", response_model=InspectionResponse, status_code=201)
async def upload_inspection_photo(
    inspection_id: UUID,
    room_area: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inspection = db.query(Inspection).join(Property).filter(
        Inspection.id == inspection_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=413, detail="Photo exceeds the 10MB upload limit.")

    org_dir = os.path.join(UPLOAD_ROOT, str(current_user.organization_id), str(inspection_id))
    os.makedirs(org_dir, exist_ok=True)
    safe_filename = os.path.basename(file.filename or "photo.jpg")
    stored_name = f"{uuid.uuid4()}_{safe_filename}"
    file_path = os.path.join(org_dir, stored_name)
    if os.path.commonpath([os.path.abspath(file_path), os.path.abspath(org_dir)]) != os.path.abspath(org_dir):
        raise HTTPException(status_code=400, detail="Invalid filename")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    analysis = await analyze_photo(file_bytes, file.content_type or "image/jpeg")

    photo = InspectionPhoto(
        inspection_id=inspection_id,
        room_area=room_area,
        file_path=file_path,
        analyzed=analysis["analyzed"],
        overall_condition=analysis["overall_condition"],
        issues_json=json.dumps(analysis["issues"]) if analysis["issues"] else None,
        analysis_confidence=analysis["confidence"],
    )
    db.add(photo)
    db.commit()
    db.refresh(inspection)
    return inspection


@router.get("/{inspection_id}/report")
async def download_inspection_report(
    inspection_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inspection = db.query(Inspection).join(Property).filter(
        Inspection.id == inspection_id,
        Property.organization_id == current_user.organization_id,
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    org_name = current_user.organization.name if current_user.organization else "Property Manager"
    pdf_bytes = generate_inspection_report_pdf(inspection, org_name)
    filename = f"inspection_{inspection.property_name}_{inspection.inspection_date}.pdf".replace(" ", "_")
    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
