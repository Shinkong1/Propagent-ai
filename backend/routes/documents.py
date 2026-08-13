"""Document Intelligence Agent routes — upload, text extraction, keyword search"""
import json
import logging
import os
import uuid
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.session import get_db
from models.user import User, PlanType
from models.property import Property
from models.tenant import Tenant
from models.document import Document, DocumentCategory
from schemas.document import DocumentResponse, DocumentSearchResult, DocumentGenerateRequest
from middleware.auth import get_current_user
from middleware.plan_gate import require_plan
from services.document_agent import extract_text, extract_fields, build_snippet
from services.contract_service import generate_lease_contract_pdf
from services.document_generator import (
    generate_lease_renewal_notice_pdf,
    generate_rent_increase_notice_pdf,
    generate_move_out_notice_pdf,
)
from services import storage_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentTemplates(BaseModel):
    lease_agreement: Optional[str] = None
    lease_renewal_notice: Optional[str] = None
    rent_increase_notice: Optional[str] = None
    move_out_notice: Optional[str] = None


@router.get("/templates", response_model=DocumentTemplates)
async def get_document_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = current_user.organization
    return DocumentTemplates(
        lease_agreement=org.doc_template_lease_agreement if org else None,
        lease_renewal_notice=org.doc_template_lease_renewal_notice if org else None,
        rent_increase_notice=org.doc_template_rent_increase_notice if org else None,
        move_out_notice=org.doc_template_move_out_notice if org else None,
    )


@router.patch("/templates", response_model=DocumentTemplates)
async def update_document_templates(
    payload: DocumentTemplates,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_plan(PlanType.professional)),
):
    org = current_user.organization
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    data = payload.dict(exclude_unset=True)
    if "lease_agreement" in data:
        org.doc_template_lease_agreement = data["lease_agreement"] or None
    if "lease_renewal_notice" in data:
        org.doc_template_lease_renewal_notice = data["lease_renewal_notice"] or None
    if "rent_increase_notice" in data:
        org.doc_template_rent_increase_notice = data["rent_increase_notice"] or None
    if "move_out_notice" in data:
        org.doc_template_move_out_notice = data["move_out_notice"] or None
    db.commit()
    return DocumentTemplates(
        lease_agreement=org.doc_template_lease_agreement,
        lease_renewal_notice=org.doc_template_lease_renewal_notice,
        rent_increase_notice=org.doc_template_rent_increase_notice,
        move_out_notice=org.doc_template_move_out_notice,
    )

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

GENERATABLE_TYPES = {"lease_agreement", "lease_renewal_notice", "rent_increase_notice", "move_out_notice"}


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    category: Optional[str] = None,
    property_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Document).filter(
        Document.organization_id == current_user.organization_id,
        Document.is_active == True,
    )
    if category:
        query = query.filter(Document.category == category)
    if property_id:
        query = query.filter(Document.property_id == property_id)
    return query.order_by(Document.created_at.desc()).all()


@router.get("/search", response_model=List[DocumentSearchResult])
async def search_documents(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=422, detail="Search query must be at least 2 characters.")

    docs = db.query(Document).filter(
        Document.organization_id == current_user.organization_id,
        Document.is_active == True,
        (Document.extracted_text.ilike(f"%{q}%")) | (Document.title.ilike(f"%{q}%")),
    ).order_by(Document.created_at.desc()).limit(50).all()

    return [
        DocumentSearchResult(
            id=d.id, title=d.title, category=d.category.value,
            property_name=d.property_name,
            snippet=build_snippet(d.extracted_text or d.title, q),
            created_at=d.created_at,
        )
        for d in docs
    ]


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("other"),
    property_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    property_uuid = None
    if property_id:
        try:
            property_uuid = UUID(property_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid property_id")
        prop = db.query(Property).filter(
            Property.id == property_uuid,
            Property.organization_id == current_user.organization_id,
        ).first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

    try:
        category_enum = DocumentCategory(category)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid category: {category}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds the 20MB upload limit.")

    # Strip any directory components from the client-supplied filename before
    # using it in the object key — an unsanitized filename like
    # "../../etc/cron.d/x" would otherwise let an upload escape its org's
    # namespace (storage_service also backstops this for the local-disk
    # fallback specifically).
    safe_filename = os.path.basename(file.filename or "upload")
    stored_name = f"{uuid.uuid4()}_{safe_filename}"
    key = f"documents/{current_user.organization_id}/{stored_name}"
    try:
        file_path = await run_in_threadpool(storage_service.save_file, key, file_bytes, file.content_type or "application/octet-stream")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to save the uploaded file — please try again in a moment.")

    extracted, status = extract_text(file_bytes, file.content_type or "")
    fields = extract_fields(extracted) if extracted else {}

    doc = Document(
        organization_id=current_user.organization_id,
        property_id=property_uuid,
        category=category_enum,
        title=title,
        filename=file.filename,
        file_path=file_path,
        file_size=len(file_bytes),
        mime_type=file.content_type,
        extracted_text=extracted,
        extraction_status=status,
        extracted_fields_json=json.dumps(fields) if fields else None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/generate", response_model=DocumentResponse, status_code=201)
async def generate_document(
    payload: DocumentGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_plan(PlanType.professional)),
):
    if payload.document_type not in GENERATABLE_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown document_type: {payload.document_type}")

    tenant = db.query(Tenant).filter(
        Tenant.id == payload.tenant_id,
        Tenant.organization_id == current_user.organization_id,
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    lease = tenant.active_lease
    if not lease:
        raise HTTPException(status_code=422, detail="This tenant has no active lease to generate a document from.")

    org = current_user.organization
    org_name = org.name if org else "Landlord"
    unit = lease.unit
    prop = unit.property if unit else None

    if payload.document_type == "lease_agreement":
        pdf_bytes = generate_lease_contract_pdf(lease, org_name, org.doc_template_lease_agreement if org else None)
        title = f"Lease Agreement — {tenant.full_name}"
        filename = f"lease_agreement_{tenant.full_name.replace(' ', '_')}.pdf"
        fields = {
            "tenant_name": tenant.full_name, "monthly_rent": lease.monthly_rent,
            "start_date": str(lease.start_date), "end_date": str(lease.end_date),
        }
        summary = f"Lease agreement for {tenant.full_name} at {prop.name if prop else 'the property'}, unit {unit.unit_number if unit else 'N/A'}. Rent ${lease.monthly_rent:,.2f}/mo, term {lease.start_date} to {lease.end_date}."

    elif payload.document_type == "lease_renewal_notice":
        if not payload.new_end_date:
            raise HTTPException(status_code=422, detail="new_end_date is required for a lease renewal notice.")
        pdf_bytes = generate_lease_renewal_notice_pdf(lease, org_name, payload.new_end_date, org.doc_template_lease_renewal_notice if org else None)
        title = f"Lease Renewal Notice — {tenant.full_name}"
        filename = f"lease_renewal_notice_{tenant.full_name.replace(' ', '_')}.pdf"
        fields = {"tenant_name": tenant.full_name, "current_end_date": str(lease.end_date), "new_end_date": str(payload.new_end_date)}
        summary = f"Lease renewal notice for {tenant.full_name}, offering renewal through {payload.new_end_date} at ${lease.monthly_rent:,.2f}/mo."

    elif payload.document_type == "rent_increase_notice":
        if not payload.new_rent or not payload.effective_date:
            raise HTTPException(status_code=422, detail="new_rent and effective_date are required for a rent increase notice.")
        pdf_bytes = generate_rent_increase_notice_pdf(lease, org_name, payload.new_rent, payload.effective_date, org.doc_template_rent_increase_notice if org else None)
        title = f"Rent Increase Notice — {tenant.full_name}"
        filename = f"rent_increase_notice_{tenant.full_name.replace(' ', '_')}.pdf"
        fields = {"tenant_name": tenant.full_name, "old_rent": lease.monthly_rent, "new_rent": payload.new_rent, "effective_date": str(payload.effective_date)}
        summary = f"Rent increase notice for {tenant.full_name}: ${lease.monthly_rent:,.2f} to ${payload.new_rent:,.2f}/mo effective {payload.effective_date}."

    else:  # move_out_notice
        if not payload.move_out_date:
            raise HTTPException(status_code=422, detail="move_out_date is required for a move-out notice.")
        pdf_bytes = generate_move_out_notice_pdf(lease, org_name, payload.move_out_date, org.doc_template_move_out_notice if org else None)
        title = f"Notice to Vacate — {tenant.full_name}"
        filename = f"move_out_notice_{tenant.full_name.replace(' ', '_')}.pdf"
        fields = {"tenant_name": tenant.full_name, "move_out_date": str(payload.move_out_date)}
        summary = f"Notice to vacate for {tenant.full_name}, move-out date {payload.move_out_date}."

    # filename is derived from tenant.full_name, which an org user controls when
    # creating a tenant — sanitize before using it in the object key, same
    # reasoning as upload_document.
    safe_filename = os.path.basename(filename or "document.pdf")
    stored_name = f"{uuid.uuid4()}_{safe_filename}"
    key = f"documents/{current_user.organization_id}/{stored_name}"
    try:
        file_path = await run_in_threadpool(storage_service.save_file, key, pdf_bytes, "application/pdf")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to save the generated document — please try again in a moment.")

    category = DocumentCategory.lease if payload.document_type in ("lease_agreement", "lease_renewal_notice") else DocumentCategory.other

    doc = Document(
        organization_id=current_user.organization_id,
        property_id=prop.id if prop else None,
        category=category,
        title=title,
        filename=filename,
        file_path=file_path,
        file_size=len(pdf_bytes),
        mime_type="application/pdf",
        extracted_text=summary,
        extraction_status="extracted",
        extracted_fields_json=json.dumps(fields),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == current_user.organization_id,
        Document.is_active == True,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # R2-backed: redirect to a short-lived presigned URL so the file streams
    # straight from Cloudflare's edge (free egress) instead of proxying the
    # full bytes through this backend. Local-disk fallback: serve directly,
    # same as before.
    try:
        presigned = await run_in_threadpool(storage_service.get_download_url, doc.file_path, doc.filename or "document")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to generate a download link — please try again in a moment.")
    if presigned:
        return RedirectResponse(presigned)

    if not os.path.exists(doc.file_path):
        # Real, unrecoverable case for anything uploaded before R2 was
        # configured: local disk on Render is wiped on every deploy, so the
        # bytes are gone even though this DB row survived.
        raise HTTPException(status_code=404, detail="This file is no longer available — it was uploaded before persistent storage was configured.")
    return FileResponse(doc.file_path, media_type=doc.mime_type or "application/octet-stream", filename=doc.filename)


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.organization_id == current_user.organization_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.is_active = False
    db.commit()
    from fastapi import Response
    return Response(status_code=204)
