from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class TestimonialCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_title: Optional[str] = Field(None, max_length=255)
    quote_text: str = Field(..., min_length=1)
    rating: Optional[int] = Field(None, ge=1, le=5)
    is_published: bool = False
    display_order: int = 0


class TestimonialUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=1, max_length=255)
    customer_title: Optional[str] = Field(None, max_length=255)
    quote_text: Optional[str] = Field(None, min_length=1)
    rating: Optional[int] = Field(None, ge=1, le=5)
    is_published: Optional[bool] = None
    display_order: Optional[int] = None


class TestimonialOut(BaseModel):
    id: UUID
    customer_name: str
    customer_title: Optional[str] = None
    quote_text: str
    rating: Optional[int] = None
    is_published: bool
    display_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicTestimonialOut(BaseModel):
    """Public-facing shape -- deliberately excludes is_published/timestamps,
    which are internal admin bookkeeping, not something the marketing site needs."""
    id: UUID
    customer_name: str
    customer_title: Optional[str] = None
    quote_text: str
    rating: Optional[int] = None

    class Config:
        from_attributes = True
