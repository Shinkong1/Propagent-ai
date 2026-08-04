"""One-off script: create/seed the public 'Demo Organization' used by the
homepage's 'View Demo' button. Idempotent — safe to re-run."""
import sys
import os
import uuid
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from database.base import Base, engine, SessionLocal
from middleware.auth import hash_password

# Import every model module so relationship string-refs resolve before querying.
import models.user  # noqa
import models.property  # noqa
import models.tenant  # noqa
import models.maintenance  # noqa
import models.lead  # noqa
import models.accounting  # noqa
import models.compliance  # noqa
import models.collections  # noqa
import models.document  # noqa
import models.inspection  # noqa
import models.communication  # noqa
import models.owner_message  # noqa
import models.workflow  # noqa
import models.platform  # noqa

from models.user import Organization, User, UserRole, PlanType
from models.property import Property, Unit, PropertyType
from models.tenant import Tenant
from models.maintenance import MaintenanceTicket, TicketCategory, TicketPriority, TicketStatus
from models.lead import Lead, LeadSource, LeadStatus

DEMO_EMAIL = "demo@propagentai.com"
DEMO_PASSWORD = "PropAgentDemo2026!"

db = SessionLocal()

org = db.query(Organization).filter(Organization.slug == "propagent-demo").first()
if org:
    print("Demo org already exists, skipping seed.")
    db.close()
    sys.exit(0)

org = Organization(
    name="Sunrise Property Group (Demo)",
    slug="propagent-demo",
    plan=PlanType.enterprise,
    subscription_status="active",  # exempt from trial-expiry gating forever
)
db.add(org)
db.flush()

user = User(
    organization_id=org.id,
    email=DEMO_EMAIL,
    hashed_password=hash_password(DEMO_PASSWORD),
    first_name="Demo",
    last_name="Account",
    role=UserRole.owner,
    is_active=True,
    is_verified=True,
)
db.add(user)
db.flush()

properties_data = [
    ("Maple Ridge Apartments", "482 Maple Ridge Rd", "Austin", "TX", "78701", PropertyType.apartment, 2019),
    ("Sunrise Townhomes", "117 Sunrise Ave", "Denver", "CO", "80202", PropertyType.multi_family, 2015),
    ("Harbor View Duplex", "29 Harbor View Ln", "Tampa", "FL", "33602", PropertyType.multi_family, 2008),
]

properties = []
for name, address, city, state, zip_code, ptype, year in properties_data:
    p = Property(
        organization_id=org.id, name=name, address=address, city=city, state=state,
        zip_code=zip_code, property_type=ptype, year_built=year,
        total_units=6 if ptype == PropertyType.apartment else 2,
    )
    db.add(p)
    properties.append(p)
db.flush()

units = []
unit_specs = [
    (properties[0], [("101", 1, 1.0, 750, 1450, True), ("102", 2, 1.0, 950, 1750, True),
                      ("201", 2, 2.0, 1050, 1850, False), ("202", 1, 1.0, 700, 1400, True),
                      ("301", 3, 2.0, 1300, 2400, True), ("302", 2, 1.5, 1000, 1800, False)]),
    (properties[1], [("A", 2, 1.5, 1100, 1950, True), ("B", 3, 2.0, 1400, 2500, True)]),
    (properties[2], [("Unit 1", 2, 1.0, 900, 1600, True), ("Unit 2", 2, 1.0, 900, 1600, False)]),
]
for prop, specs in unit_specs:
    for unit_number, bed, bath, sqft, rent, occupied in specs:
        u = Unit(
            property_id=prop.id, unit_number=unit_number, bedrooms=bed, bathrooms=bath,
            square_feet=sqft, monthly_rent=rent, is_occupied=occupied, is_available=not occupied,
        )
        db.add(u)
        units.append(u)
db.flush()

occupied_units = [u for u in units if u.is_occupied]
tenant_names = [
    ("Sarah", "Chen"), ("Marcus", "Johnson"), ("Priya", "Patel"), ("Jake", "Williams"),
    ("Elena", "Garcia"), ("Tom", "Anderson"), ("Nina", "Kowalski"),
]
tenants = []
for i, u in enumerate(occupied_units):
    fn, ln = tenant_names[i % len(tenant_names)]
    t = Tenant(
        organization_id=org.id, first_name=fn, last_name=ln,
        email=f"{fn.lower()}.{ln.lower()}@example.com", phone=f"555-01{i:02d}",
        annual_income=55000 + i * 4500, employment_status="employed", is_active=True,
        screening_approved=True,
    )
    db.add(t)
    tenants.append(t)
db.flush()

ticket_specs = [
    ("Leaking kitchen faucet", "Tenant reports steady drip under the sink.", TicketCategory.plumbing, TicketPriority.medium, TicketStatus.open),
    ("No heat in unit", "Thermostat set to 70 but unit stays cold.", TicketCategory.hvac, TicketPriority.emergency, TicketStatus.in_progress),
    ("Broken mailbox lock", "Lock won't turn, tenant can't retrieve mail.", TicketCategory.other, TicketPriority.low, TicketStatus.open),
    ("Hallway light out", "Third floor hallway light has been out for a week.", TicketCategory.electrical, TicketPriority.low, TicketStatus.completed),
    ("Garbage disposal jammed", "Disposal hums but doesn't spin.", TicketCategory.appliance, TicketPriority.medium, TicketStatus.scheduled),
]
for i, (title, desc, cat, pri, status) in enumerate(ticket_specs):
    u = units[i % len(units)]
    t = MaintenanceTicket(
        property_id=u.property_id, unit_id=u.id,
        tenant_id=tenants[i % len(tenants)].id if tenants else None,
        title=title, description=desc, category=cat, priority=pri, status=status,
        ai_classification=f"Auto-classified as {cat.value} — {pri.value} priority" if status != TicketStatus.open else None,
    )
    db.add(t)
db.flush()

lead_specs = [
    ("Robert", "Kim", "Kim Property Holdings", LeadSource.google_maps, LeadStatus.new, 62),
    ("Amanda", "Torres", "Torres Realty Group", LeadSource.linkedin, LeadStatus.contacted, 78),
    ("David", "Nguyen", None, LeadSource.zillow, LeadStatus.interested, 85),
    ("Grace", "Osei", "Osei Family Trust", LeadSource.manual, LeadStatus.demo_scheduled, 71),
    ("Chris", "Baker", None, LeadSource.google_maps, LeadStatus.closed_won, 92),
]
for fn, ln, company, source, status, score in lead_specs:
    l = Lead(
        organization_id=org.id, first_name=fn, last_name=ln, company=company,
        email=f"{fn.lower()}.{ln.lower()}@example.com", source=source, status=status, score=score,
    )
    db.add(l)

db.commit()
print(f"Demo org created: {org.id}")
print(f"Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
db.close()
