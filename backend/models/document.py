import builtins
import json
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class DocumentCategory(enum.Enum):
    lease = "lease"
    insurance = "insurance"
    vendor_contract = "vendor_contract"
    hoa_document = "hoa_document"
    utility_bill = "utility_bill"
    mortgage_document = "mortgage_document"
    inspection_report = "inspection_report"
    other = "other"


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=True)
    category = Column(SAEnum(DocumentCategory), default=DocumentCategory.other, nullable=False)
    title = Column(String(255), nullable=False)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(100), nullable=True)
    extracted_text = Column(Text, nullable=True)
    extraction_status = Column(String(50), default="pending")  # pending, extracted, unsupported, failed
    extracted_fields_json = Column(Text, nullable=True)  # JSON string: {"rent": ..., "deposit": ..., ...}
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property")

    @builtins.property
    def property_name(self):
        return self.property.name if self.property else None

    @builtins.property
    def extracted_fields(self):
        return json.loads(self.extracted_fields_json) if self.extracted_fields_json else None
