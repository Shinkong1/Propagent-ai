"""
PropAgent AI — Database Seed Script
Run: python scripts/seed_database.py
"""
import sys, os, json
from datetime import date, timedelta, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database.base import Base, engine, SessionLocal
from models.user import User, Organization, PlanType
from models.property import Property, Unit, PropertyType
from models.tenant import Tenant, Lease, LeaseStatus
from models.maintenance import MaintenanceTicket, Vendor, TicketCategory, TicketPriority, TicketStatus
from models.lead import Lead, LeadStatus, LeadSource
from models.accounting import RentPayment, Expense, PaymentStatus, PaymentMethod, ExpenseCategory
from middleware.auth import hash_password


def seed():
    print("🏗  Creating tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(Organization).first():
            print("✅ Already seeded — skipping.")
            return

        # ── Org & User ──
        print("👤 Creating demo org + user...")
        org = Organization(name="Sunset Property Management", slug="sunset-pm", plan=PlanType.professional)
        db.add(org); db.flush()

        user = User(
            organization_id=org.id, email="demo@propagent.ai",
            hashed_password=hash_password("demo1234"),
            first_name="Alex", last_name="Morgan",
            role="owner", is_active=True, is_verified=True,
        )
        db.add(user)

        # ── Properties ──
        print("🏢 Creating properties...")
        prop_data = [
            dict(name="Sunset Towers", address="100 Congress Ave", city="Austin", state="TX", zip_code="78701", property_type=PropertyType.apartment, total_units=24, purchase_price=1800000.0, mortgage_payment=7500.0),
            dict(name="Riverside Commons", address="450 W 6th St", city="Austin", state="TX", zip_code="78701", property_type=PropertyType.multi_family, total_units=12, purchase_price=950000.0, mortgage_payment=4100.0),
            dict(name="Cedar Heights", address="2200 Barton Springs Rd", city="Austin", state="TX", zip_code="78746", property_type=PropertyType.apartment, total_units=36, purchase_price=2600000.0, mortgage_payment=10800.0),
        ]
        props = []
        for pd in prop_data:
            p = Property(**pd, organization_id=org.id); db.add(p); db.flush(); props.append(p)

        # ── Vendors ──
        print("🔧 Creating vendors...")
        vendor_data = [
            dict(name="Mike Torres", company="Torres Plumbing", email="mike@torresplumbing.com", phone="(512) 555-0101", specialties=json.dumps(["plumbing"]), hourly_rate=95.0, rating=4.8, is_preferred=True),
            dict(name="Sandra Lee", company="Lee HVAC Services", email="sandra@leehvac.com", phone="(512) 555-0102", specialties=json.dumps(["hvac","heating","cooling"]), hourly_rate=120.0, rating=4.9, is_preferred=True),
            dict(name="James Wright", company="Wright Electric", email="james@wrightelectric.com", phone="(512) 555-0103", specialties=json.dumps(["electrical"]), hourly_rate=110.0, rating=4.7),
            dict(name="Rosa Gutierrez", company="Gutierrez Appliance Repair", email="rosa@gutierrezrepair.com", phone="(512) 555-0104", specialties=json.dumps(["appliance"]), hourly_rate=80.0, rating=4.6),
        ]
        vendors = []
        for vd in vendor_data:
            v = Vendor(**vd, organization_id=org.id); db.add(v); db.flush(); vendors.append(v)

        # ── Units, Tenants, Leases ──
        print("🏠 Creating units, tenants, and leases...")
        tenant_names = [
            ("Jordan", "Kim"), ("Priya", "Patel"), ("Marcus", "Williams"),
            ("Sofia", "Rodriguez"), ("Tyler", "Johnson"), ("Aisha", "Okafor"),
            ("Ben", "Chen"), ("Layla", "Hassan"), ("Devon", "Scott"),
        ]
        tenant_idx = 0
        leases = []

        for prop in props:
            for i in range(1, 7):
                beds = (i % 3) + 1
                rent = 1200.0 + (beds * 300) + (i * 50)
                unit = Unit(
                    property_id=prop.id, unit_number=str(i),
                    bedrooms=beds, bathrooms=float(beds),
                    square_feet=600 + (beds * 200), monthly_rent=rent,
                    is_occupied=i <= 4, is_available=i > 4,
                )
                db.add(unit); db.flush()

                if i <= 4 and tenant_idx < len(tenant_names):
                    fn, ln = tenant_names[tenant_idx]; tenant_idx += 1
                    tenant = Tenant(
                        organization_id=org.id, first_name=fn, last_name=ln,
                        email=f"{fn.lower()}.{ln.lower()}@email.com",
                        phone=f"(512) 555-{1200 + tenant_idx:04d}",
                        annual_income=60000.0 + (tenant_idx * 5000),
                        employment_status="employed", employer="Austin Tech Inc.",
                        screening_approved=True, is_active=True,
                    )
                    db.add(tenant); db.flush()

                    lease = Lease(
                        tenant_id=tenant.id, unit_id=unit.id, monthly_rent=rent,
                        security_deposit=rent * 1.5,
                        start_date=date.today() - timedelta(days=180),
                        end_date=date.today() + timedelta(days=185),
                        status=LeaseStatus.active,
                    )
                    db.add(lease); db.flush(); leases.append((lease, prop))

        # ── Maintenance Tickets ──
        print("🔨 Creating maintenance tickets...")
        first_prop = props[0]
        ticket_data = [
            dict(title="HVAC not cooling", description="AC unit in unit 3 stopped working. Temperature is 85°F inside.", category=TicketCategory.hvac, priority=TicketPriority.high, status=TicketStatus.in_progress, vendor=vendors[1]),
            dict(title="Kitchen faucet dripping", description="The kitchen faucet won't stop dripping. Losing a lot of water.", category=TicketCategory.plumbing, priority=TicketPriority.medium, status=TicketStatus.open, vendor=vendors[0]),
            dict(title="Bathroom outlet sparking", description="The bathroom outlet near the sink sparked when I plugged in my hair dryer.", category=TicketCategory.electrical, priority=TicketPriority.emergency, status=TicketStatus.scheduled, vendor=vendors[2]),
            dict(title="Dishwasher not draining", description="Water sitting in the bottom of the dishwasher after every cycle.", category=TicketCategory.appliance, priority=TicketPriority.low, status=TicketStatus.open, vendor=None),
            dict(title="Heater makes loud noise", description="The heater makes a loud banging noise when it turns on.", category=TicketCategory.hvac, priority=TicketPriority.medium, status=TicketStatus.completed, vendor=vendors[1]),
        ]
        for td in ticket_data:
            v = td.pop("vendor")
            t = MaintenanceTicket(
                **td, property_id=first_prop.id,
                vendor_id=v.id if v else None,
                vendor_notified=v is not None,
            )
            db.add(t)

        # ── 12 months of rent payments + expenses ──
        print("💰 Creating 12 months of rent payments and expenses...")
        today = date.today()
        for month_offset in range(11, -1, -1):
            month_date = (today.replace(day=1) - timedelta(days=month_offset * 30)).replace(day=1)

            for lease, prop in leases:
                is_late = (month_offset % 5 == 0)  # occasional late payment for realism
                paid_date = month_date + timedelta(days=6) if is_late else month_date
                db.add(RentPayment(
                    lease_id=lease.id, amount=lease.monthly_rent,
                    due_date=month_date, paid_date=paid_date,
                    status=PaymentStatus.late if is_late else PaymentStatus.paid,
                    payment_method=PaymentMethod.ach,
                ))

            for prop in props:
                if prop.mortgage_payment:
                    db.add(Expense(
                        property_id=prop.id, category=ExpenseCategory.mortgage,
                        amount=prop.mortgage_payment, expense_date=month_date,
                        description="Monthly mortgage payment",
                    ))
                db.add(Expense(
                    property_id=prop.id, category=ExpenseCategory.utilities,
                    amount=180.0 + (prop.total_units * 4), expense_date=month_date,
                    description="Water, electric, and gas (common areas)",
                ))
                if month_offset % 3 == 0:
                    db.add(Expense(
                        property_id=prop.id, category=ExpenseCategory.insurance,
                        amount=prop.total_units * 45.0, expense_date=month_date,
                        description="Quarterly property insurance premium",
                    ))
                if month_offset % 4 == 0:
                    db.add(Expense(
                        property_id=prop.id, category=ExpenseCategory.management_fee,
                        amount=round(sum(l.monthly_rent for l, p in leases if p.id == prop.id) * 0.08, 2),
                        expense_date=month_date, description="Property management fee",
                    ))

        # ── Leads ──
        print("📊 Creating CRM leads...")
        lead_data = [
            dict(first_name="Robert", last_name="Chang", company="Chang Property Group", email="rchang@changproperties.com", phone="(512) 555-2001", city="Austin", state="TX", num_properties=18, source=LeadSource.google_maps, status=LeadStatus.interested, score=82),
            dict(first_name="Lisa", last_name="Martinez", company="Martinez Realty", email="lisa@martinezrealty.com", phone="(737) 555-2002", city="Austin", state="TX", num_properties=7, source=LeadSource.linkedin, status=LeadStatus.contacted, score=65),
            dict(first_name="David", last_name="Park", company="Park Investment Properties", email="dpark@parkip.com", phone="(512) 555-2003", city="Round Rock", state="TX", num_properties=34, source=LeadSource.zillow, status=LeadStatus.demo_scheduled, score=91),
            dict(first_name="Karen", last_name="White", company="White Residential LLC", email="karen@whiteresidential.com", num_properties=5, city="Cedar Park", state="TX", source=LeadSource.manual, status=LeadStatus.new, score=55),
            dict(first_name="Tom", last_name="Nguyen", company="Nguyen Holdings", email="tom@nguyenholdings.com", num_properties=22, city="Austin", state="TX", source=LeadSource.google_maps, status=LeadStatus.closed_won, score=88),
        ]
        for ld in lead_data:
            db.add(Lead(**ld, organization_id=org.id))

        db.commit()
        print("\n✅ Seed complete!")
        print("   Email:    demo@propagent.ai")
        print("   Password: demo1234")
        print(f"   Org:      {org.name}")
        print(f"   Plan:     {org.plan.value}")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
