import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from database.base import Base


class Testimonial(Base):
    """Real customer testimonials/case-study quotes, entered by the platform
    owner as they're actually collected (with the customer's permission) --
    NOT seeded or fabricated. is_published defaults to False so the owner can
    draft one and review it before it ever appears on the public marketing
    site; /public/testimonials only ever returns published rows, and returns
    an honest empty list when there are none rather than any fallback."""
    __tablename__ = "testimonials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_name = Column(String(255), nullable=False)
    customer_title = Column(String(255), nullable=True)  # e.g. "Owner, Sunset Properties"
    quote_text = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)  # 1-5, optional
    is_published = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
