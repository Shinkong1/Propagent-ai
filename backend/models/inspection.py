import builtins
import json
import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Date, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from database.base import Base


class InspectionType(enum.Enum):
    move_in = "move_in"
    move_out = "move_out"
    annual = "annual"
    other = "other"


class InspectionStatus(enum.Enum):
    draft = "draft"
    completed = "completed"


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=True)
    inspection_type = Column(SAEnum(InspectionType), default=InspectionType.other, nullable=False)
    inspection_date = Column(Date, default=date.today, nullable=False)
    inspector_name = Column(String(255), nullable=True)
    status = Column(SAEnum(InspectionStatus), default=InspectionStatus.draft, nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property")
    unit = relationship("Unit")
    photos = relationship("InspectionPhoto", back_populates="inspection", cascade="all, delete-orphan")

    @builtins.property
    def property_name(self):
        return self.property.name if self.property else None

    @builtins.property
    def unit_number(self):
        return self.unit.unit_number if self.unit else None

    @builtins.property
    def estimated_repair_cost(self):
        return round(sum(p.estimated_cost or 0 for p in self.photos), 2)

    @builtins.property
    def total_issues(self):
        return sum(len(p.issues or []) for p in self.photos)


class InspectionPhoto(Base):
    __tablename__ = "inspection_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inspection_id = Column(UUID(as_uuid=True), ForeignKey("inspections.id"), nullable=False)
    room_area = Column(String(100), nullable=False)
    file_path = Column(String(1000), nullable=False)
    analyzed = Column(Boolean, default=False)
    overall_condition = Column(String(50), nullable=True)  # good, fair, poor, needs_manual_review
    issues_json = Column(Text, nullable=True)  # JSON array: [{type, severity, description, estimated_cost}]
    analysis_confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    inspection = relationship("Inspection", back_populates="photos")

    @builtins.property
    def issues(self):
        return json.loads(self.issues_json) if self.issues_json else []

    @builtins.property
    def estimated_cost(self):
        return round(sum(i.get("estimated_cost", 0) for i in self.issues), 2)
