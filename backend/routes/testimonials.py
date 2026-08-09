"""Testimonials / case-study quotes.

Two surfaces on one router:
  - /public/testimonials: unauthenticated, returns only is_published=True rows,
    ordered by display_order. Returns an honest empty list when there are none --
    no fallback/example content, ever.
  - /admin/testimonials: master-gated (require_master, same pattern as
    routes/admin.py) CRUD so the platform owner can add real testimonials as
    they're actually collected from real customers, draft them (is_published
    defaults to False) before publishing, and publish/unpublish/delete them.
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.testimonial import Testimonial
from models.user import User
from middleware.plan_gate import require_master
from schemas.testimonial import (
    TestimonialCreate, TestimonialUpdate, TestimonialOut, PublicTestimonialOut,
)

router = APIRouter(tags=["testimonials"])


@router.get("/public/testimonials", response_model=List[PublicTestimonialOut])
async def list_public_testimonials(db: Session = Depends(get_db)):
    testimonials = (
        db.query(Testimonial)
        .filter(Testimonial.is_published == True)  # noqa: E712
        .order_by(Testimonial.display_order.asc(), Testimonial.created_at.asc())
        .all()
    )
    return testimonials


admin_router = APIRouter(prefix="/admin/testimonials", tags=["admin"], dependencies=[Depends(require_master)])


@admin_router.get("", response_model=List[TestimonialOut])
async def list_admin_testimonials(db: Session = Depends(get_db)):
    return (
        db.query(Testimonial)
        .order_by(Testimonial.display_order.asc(), Testimonial.created_at.desc())
        .all()
    )


@admin_router.post("", response_model=TestimonialOut, status_code=201)
async def create_testimonial(
    payload: TestimonialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_master),
):
    testimonial = Testimonial(
        customer_name=payload.customer_name.strip(),
        customer_title=(payload.customer_title or "").strip() or None,
        quote_text=payload.quote_text.strip(),
        rating=payload.rating,
        is_published=payload.is_published,
        display_order=payload.display_order,
    )
    db.add(testimonial)
    db.commit()
    db.refresh(testimonial)
    return testimonial


@admin_router.patch("/{testimonial_id}", response_model=TestimonialOut)
async def update_testimonial(
    testimonial_id: UUID,
    payload: TestimonialUpdate,
    db: Session = Depends(get_db),
):
    testimonial = db.query(Testimonial).filter(Testimonial.id == testimonial_id).first()
    if not testimonial:
        raise HTTPException(status_code=404, detail="Testimonial not found")

    data = payload.model_dump(exclude_unset=True)
    if "customer_name" in data:
        testimonial.customer_name = data["customer_name"].strip()
    if "customer_title" in data:
        testimonial.customer_title = (data["customer_title"] or "").strip() or None
    if "quote_text" in data:
        testimonial.quote_text = data["quote_text"].strip()
    if "rating" in data:
        testimonial.rating = data["rating"]
    if "is_published" in data:
        testimonial.is_published = data["is_published"]
    if "display_order" in data:
        testimonial.display_order = data["display_order"]

    db.commit()
    db.refresh(testimonial)
    return testimonial


@admin_router.delete("/{testimonial_id}", status_code=204)
async def delete_testimonial(testimonial_id: UUID, db: Session = Depends(get_db)):
    testimonial = db.query(Testimonial).filter(Testimonial.id == testimonial_id).first()
    if not testimonial:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    db.delete(testimonial)
    db.commit()
