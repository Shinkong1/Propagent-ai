import builtins
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates
import enum
from database.base import Base


class PropertyType(enum.Enum):
    single_family = "single_family"
    multi_family = "multi_family"
    apartment = "apartment"
    condo = "condo"
    commercial = "commercial"


class Property(Base):
    __tablename__ = "properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(50), nullable=False)
    zip_code = Column(String(20), nullable=False)
    property_type = Column(SAEnum(PropertyType), default=PropertyType.apartment)
    total_units = Column(Integer, default=1)
    year_built = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    purchase_price = Column(Float, nullable=True)
    mortgage_payment = Column(Float, nullable=True)  # monthly debt service
    is_active = Column(Boolean, default=True)
    is_public_listing = Column(Boolean, default=False, nullable=False)  # opt-in: shown on propagent.app/listings directory
    # When is_public_listing was last flipped True -- distinct from created_at, which
    # reflects when the property record itself was created (possibly long before it
    # ever went public). None if the property has never been made public. Kept in sync
    # by the validator below so every code path that sets is_public_listing (routes,
    # seed scripts, admin tooling) gets it for free without needing to remember to.
    public_listed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="properties")
    units = relationship("Unit", back_populates="property", cascade="all, delete-orphan")
    maintenance_tickets = relationship("MaintenanceTicket", back_populates="property")
    expenses = relationship("Expense", back_populates="property", cascade="all, delete-orphan")
    compliance_items = relationship("ComplianceItem", back_populates="property", cascade="all, delete-orphan")

    @validates('is_public_listing')
    def _stamp_public_listed_at(self, key, value):
        """Stamp public_listed_at the moment is_public_listing transitions to
        True -- covers every write path (properties routes, demo seeding,
        future admin tooling) since it's on the model, not any one caller."""
        if value and not self.is_public_listing:
            self.public_listed_at = datetime.utcnow()
        return value

    @property
    def occupied_units(self) -> int:
        return sum(1 for u in self.units if u.is_occupied)

    @property
    def vacancy_rate(self) -> float:
        if not self.units:
            return 0.0
        return ((self.total_units - self.occupied_units) / self.total_units) * 100


class Unit(Base):
    __tablename__ = "units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id = Column(UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False)
    unit_number = Column(String(50), nullable=False)
    bedrooms = Column(Integer, default=1)
    bathrooms = Column(Float, default=1.0)
    square_feet = Column(Integer, nullable=True)
    monthly_rent = Column(Float, nullable=False, default=0.0)
    is_occupied = Column(Boolean, default=False)
    is_available = Column(Boolean, default=True)
    floor = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    features = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

    property = relationship("Property", back_populates="units")
    leases = relationship("Lease", back_populates="unit")
    maintenance_tickets = relationship("MaintenanceTicket", back_populates="unit")

    @builtins.property
    def active_lease(self):
        from models.tenant import LeaseStatus
        for lease in self.leases:
            if lease.status == LeaseStatus.active:
                return lease
        return None

    @builtins.property
    def tenant_name(self):
        lease = self.active_lease
        return lease.tenant.full_name if lease and lease.tenant else None
