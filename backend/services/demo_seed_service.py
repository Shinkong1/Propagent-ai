"""Builds (or rebuilds) a dedicated, fully-populated demo organization for
sales/marketing use -- a real login prospects (or the team) can explore
with realistic data in every feature area, kept entirely separate from
any real subscriber's data.

Idempotent: re-running finds the existing "PropAgent Demo" org by slug,
wipes its data via org_wipe_service, and reseeds fresh -- so this can be
safely re-run to refresh the demo (new dates, reset state) without
accumulating duplicates or needing a new login each time.
"""
import json
import logging
import os
import secrets
import uuid
from datetime import datetime, date, timedelta

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

DEMO_ORG_SLUG = "propagent-demo"
DEMO_USER_EMAIL = "demo@propagent.app"


def _d(days_from_today: int) -> date:
    return date.today() + timedelta(days=days_from_today)


def _dt(days_from_now: int) -> datetime:
    return datetime.utcnow() + timedelta(days=days_from_now)


def seed_demo_organization(db: Session) -> dict:
    from models.user import Organization, User, PlanType, UserRole
    from models.property import Property, Unit, PropertyType
    from models.tenant import Tenant, Lease, LeaseStatus
    from models.accounting import RentPayment, Expense, PaymentStatus, PaymentMethod, ExpenseCategory
    from models.maintenance import MaintenanceTicket, Vendor, TicketStatus, TicketPriority, TicketCategory
    from models.inspection import Inspection, InspectionType, InspectionStatus
    from models.compliance import ComplianceItem, ComplianceCategory, ComplianceStatus
    from models.document import Document, DocumentCategory
    from models.inquiry import RentalInquiry, InquiryStatus
    from models.workflow import WorkflowRule, WorkflowTrigger
    from models.voice_call import VoiceCall
    from models.platform import AICallLog
    from models.communication import CommunicationLog, CommunicationChannel, CommunicationTemplate, CommunicationStatus
    from middleware.auth import hash_password
    from services.org_wipe_service import wipe_organization_data

    # ── Org + user: create fresh, or find + wipe existing ──
    org = db.query(Organization).filter(Organization.slug == DEMO_ORG_SLUG).first()
    if org:
        wipe_organization_data(db, org.id)
        db.flush()
    else:
        org = Organization(
            name="PropAgent Demo", slug=DEMO_ORG_SLUG, plan=PlanType.enterprise,
            language="en", is_active=True, trial_ends_at=None,  # grandfathered -- never expires
            referral_code=f"DEMO{secrets.token_hex(3).upper()}",
        )
        db.add(org)
        db.flush()

    password = secrets.token_urlsafe(9)
    user = db.query(User).filter(User.email == DEMO_USER_EMAIL).first()
    if user:
        user.hashed_password = hash_password(password)
        user.organization_id = org.id
        user.is_active = True
        user.is_verified = True
    else:
        user = User(
            organization_id=org.id, email=DEMO_USER_EMAIL, hashed_password=hash_password(password),
            first_name="Demo", last_name="Manager", role=UserRole.owner,
            is_active=True, is_verified=True, is_master=False,
        )
        db.add(user)
    db.flush()

    # ── Vendors ──
    vendors = [
        Vendor(organization_id=org.id, name="Reliable Plumbing Co", company="Reliable Plumbing Co",
               email="dispatch@example.com", phone="5125550101", specialties=json.dumps(["plumbing"]),
               hourly_rate=95, rating=4.8, is_preferred=True),
        Vendor(organization_id=org.id, name="BrightSpark Electric", company="BrightSpark Electric",
               email="jobs@example.com", phone="5125550102", specialties=json.dumps(["electrical"]),
               hourly_rate=110, rating=4.6, is_preferred=True),
        Vendor(organization_id=org.id, name="Cool Air HVAC Services", company="Cool Air HVAC",
               email="service@example.com", phone="5125550103", specialties=json.dumps(["hvac"]),
               hourly_rate=105, rating=4.5, is_preferred=False),
        Vendor(organization_id=org.id, name="GreenScape Landscaping", company="GreenScape Landscaping",
               email="hello@example.com", phone="5125550104", specialties=json.dumps(["landscaping"]),
               hourly_rate=60, rating=4.2, is_preferred=False),
    ]
    db.add_all(vendors)
    db.flush()
    vendor_plumbing, vendor_electric, vendor_hvac, vendor_landscape = vendors

    # ── Properties + units ──
    prop_riverside = Property(
        organization_id=org.id, name="Riverside Commons", address="482 Riverside Dr",
        city="Austin", state="TX", zip_code="78701", property_type=PropertyType.multi_family,
        total_units=12, year_built=2015, purchase_price=2850000, mortgage_payment=14200,
        description="12-unit riverside multifamily community with on-site parking and a shared courtyard.",
    )
    prop_oakwood = Property(
        organization_id=org.id, name="Oakwood Townhomes", address="215 Oakwood Ln",
        city="Austin", state="TX", zip_code="78704", property_type=PropertyType.multi_family,
        total_units=6, year_built=2009, purchase_price=1650000, mortgage_payment=8100,
        description="Six 2-3 bedroom townhomes with attached garages, south Austin.",
    )
    prop_downtown = Property(
        organization_id=org.id, name="Downtown Lofts", address="88 Congress Ave",
        city="Austin", state="TX", zip_code="78701", property_type=PropertyType.apartment,
        total_units=4, year_built=2019, purchase_price=1420000, mortgage_payment=6900,
        description="Boutique 4-unit loft building steps from downtown -- actively leasing.",
        is_public_listing=True,
    )
    db.add_all([prop_riverside, prop_oakwood, prop_downtown])
    db.flush()

    units = []
    # Riverside Commons: 12 units, 101-112, mostly occupied (2 vacant)
    for i in range(12):
        n = 101 + i
        bd = 1 if i % 3 == 0 else 2
        units.append(Unit(
            property_id=prop_riverside.id, unit_number=str(n), bedrooms=bd, bathrooms=1.0 if bd == 1 else 2.0,
            square_feet=650 + bd * 200, monthly_rent=1450 + bd * 250,
            is_occupied=i < 10, is_available=i >= 10, floor=(i // 4) + 1,
        ))
    # Oakwood Townhomes: 6 units, T1-T6, 1 vacant
    for i in range(6):
        bd = 2 if i % 2 == 0 else 3
        units.append(Unit(
            property_id=prop_oakwood.id, unit_number=f"T{i+1}", bedrooms=bd, bathrooms=2.0,
            square_feet=1100 + bd * 150, monthly_rent=1800 + bd * 200,
            is_occupied=i < 5, is_available=i >= 5, floor=1,
        ))
    # Downtown Lofts: 4 units, 2 vacant -- the active leasing-pipeline story
    for i in range(4):
        units.append(Unit(
            property_id=prop_downtown.id, unit_number=f"{i+1}A", bedrooms=0 if i < 2 else 1,
            bathrooms=1.0, square_feet=520 + i * 80, monthly_rent=1650 + i * 120,
            is_occupied=i < 2, is_available=i >= 2, floor=i + 1,
            description="Exposed brick, polished concrete floors, walk to 6th Street." if i >= 2 else None,
        ))
    db.add_all(units)
    db.flush()

    occupied_units = [u for u in units if u.is_occupied]
    vacant_units = [u for u in units if not u.is_occupied]

    # ── Tenants + leases (one per occupied unit) ──
    names = [
        ("Sarah", "Chen"), ("Marcus", "Johnson"), ("Priya", "Patel"), ("James", "Rodriguez"),
        ("Emily", "Nguyen"), ("David", "Kim"), ("Olivia", "Martinez"), ("Ryan", "O'Brien"),
        ("Grace", "Thompson"), ("Noah", "Williams"), ("Ava", "Garcia"), ("Ethan", "Brooks"),
        ("Sofia", "Lopez"), ("Liam", "Anderson"), ("Mia", "Clarke"), ("Lucas", "Bennett"),
        ("Isabella", "Foster"),
    ]
    lease_end_offsets = [40, 25, -1000] + [400] * 20  # first two expire soon (renewal-risk demo)
    tenants, leases = [], []
    for i, unit in enumerate(occupied_units):
        first, last = names[i % len(names)]
        t = Tenant(
            organization_id=org.id, first_name=first, last_name=last,
            email=f"{first.lower()}.{last.lower().replace(chr(39), '')}@resident.example",
            phone=f"512555{1000 + i:04d}", annual_income=48000 + (i % 5) * 9000,
            credit_score=640 + (i % 6) * 20, employment_status="employed", employer="Local employer",
            screening_approved=True, is_active=True,
        )
        tenants.append(t)
    db.add_all(tenants)
    db.flush()

    for i, (unit, tenant) in enumerate(zip(occupied_units, tenants)):
        start = _d(-(200 + i * 11))
        end_offset = lease_end_offsets[i] if i < len(lease_end_offsets) else 400
        end = _d(end_offset) if end_offset != -1000 else start + timedelta(days=365)
        lease = Lease(
            tenant_id=tenant.id, unit_id=unit.id, monthly_rent=unit.monthly_rent,
            security_deposit=unit.monthly_rent, start_date=start, end_date=end,
            status=LeaseStatus.active,
            signed_at=datetime.combine(start, datetime.min.time()), signature_name=tenant.full_name,
            signature_ip="203.0.113.10",
        )
        leases.append(lease)
    db.add_all(leases)
    db.flush()

    # ── Rent payments: last 4 months per lease, with a couple overdue ──
    payments = []
    for i, lease in enumerate(leases):
        for m in range(4, 0, -1):
            due = _d(-30 * m)
            if m == 1 and i < 3:
                # 3 leases currently overdue -- feeds Collections + Accounting demo
                payments.append(RentPayment(lease_id=lease.id, amount=lease.monthly_rent, due_date=due, status=PaymentStatus.pending))
            else:
                late = (i % 7 == 0)
                payments.append(RentPayment(
                    lease_id=lease.id, amount=lease.monthly_rent, due_date=due,
                    paid_date=due + timedelta(days=6 if late else 1),
                    status=PaymentStatus.late if late else PaymentStatus.paid,
                    payment_method=PaymentMethod.ach,
                ))
    db.add_all(payments)

    # ── Expenses ──
    expense_defs = [
        (prop_riverside, ExpenseCategory.maintenance, 420, "Roof gutter repair", vendor_plumbing, -12),
        (prop_riverside, ExpenseCategory.utilities, 1180, "Common area electric", None, -20),
        (prop_riverside, ExpenseCategory.insurance, 2100, "Quarterly property insurance", None, -45),
        (prop_riverside, ExpenseCategory.capital_improvement, 3200, "Parking lot resurfacing", None, -70),
        (prop_oakwood, ExpenseCategory.maintenance, 260, "HVAC filter replacement, all units", vendor_hvac, -8),
        (prop_oakwood, ExpenseCategory.other, 340, "Monthly landscaping", vendor_landscape, -15),
        (prop_oakwood, ExpenseCategory.property_tax, 4200, "Q2 property tax installment", None, -50),
        (prop_downtown, ExpenseCategory.management_fee, 890, "Monthly management fee", None, -5),
        (prop_downtown, ExpenseCategory.maintenance, 175, "Lobby door lock replacement", vendor_electric, -18),
        (prop_downtown, ExpenseCategory.utilities, 520, "Common area water", None, -25),
        (prop_riverside, ExpenseCategory.maintenance, 610, "Unit 104 water heater replacement", vendor_plumbing, -60),
        (prop_oakwood, ExpenseCategory.mortgage, 8100, "Monthly mortgage payment", None, -30),
        (prop_riverside, ExpenseCategory.mortgage, 14200, "Monthly mortgage payment", None, -30),
        (prop_downtown, ExpenseCategory.mortgage, 6900, "Monthly mortgage payment", None, -30),
        (prop_riverside, ExpenseCategory.other, 145, "Pest control service", None, -22),
    ]
    expenses = []
    for prop, cat, amt, desc, vendor, days_ago in expense_defs:
        expenses.append(Expense(
            property_id=prop.id, vendor_id=vendor.id if vendor else None, category=cat,
            amount=amt, expense_date=_d(days_ago), description=desc,
        ))
    db.add_all(expenses)

    # ── Maintenance tickets ──
    ticket_defs = [
        (prop_riverside, occupied_units[0], tenants[0], TicketCategory.plumbing, TicketPriority.emergency, TicketStatus.open, "Burst pipe under kitchen sink", "Tenant reports active leak, water pooling on floor.", vendor_plumbing, True),
        (prop_riverside, occupied_units[1], tenants[1], TicketCategory.hvac, TicketPriority.high, TicketStatus.in_progress, "AC not cooling", "Unit stays above 80F despite thermostat set to 70.", vendor_hvac, True),
        (prop_riverside, occupied_units[2], tenants[2], TicketCategory.electrical, TicketPriority.medium, TicketStatus.waiting_vendor, "Flickering hallway light", "Intermittent flicker, possible ballast issue.", vendor_electric, True),
        (prop_oakwood, occupied_units[10], tenants[10] if len(tenants) > 10 else tenants[0], TicketCategory.appliance, TicketPriority.medium, TicketStatus.scheduled, "Dishwasher not draining", "Standing water after each cycle.", None, False),
        (prop_oakwood, occupied_units[11], tenants[11] if len(tenants) > 11 else tenants[0], TicketCategory.structural, TicketPriority.low, TicketStatus.completed, "Loose deck railing", "Railing on rear deck wobbles.", vendor_electric, False),
        (prop_downtown, occupied_units[16], tenants[16] if len(tenants) > 16 else tenants[0], TicketCategory.plumbing, TicketPriority.low, TicketStatus.completed, "Slow bathroom drain", "Drains slowly, likely hair clog.", vendor_plumbing, True),
        (prop_riverside, occupied_units[3], tenants[3], TicketCategory.pest_control, TicketPriority.medium, TicketStatus.open, "Ants near kitchen window", "Tenant reports small ant trail.", None, True),
        (prop_oakwood, occupied_units[12] if len(occupied_units) > 12 else occupied_units[0], tenants[12] if len(tenants) > 12 else tenants[0], TicketCategory.cleaning, TicketPriority.low, TicketStatus.open, "Move-out clean requested", "Tenant requests professional clean before move-out inspection.", None, False),
        (prop_riverside, occupied_units[4], tenants[4], TicketCategory.hvac, TicketPriority.high, TicketStatus.completed, "No heat", "No heat overnight, tenant called after hours.", vendor_hvac, True),
        (prop_downtown, occupied_units[17] if len(occupied_units) > 17 else occupied_units[0], tenants[17] if len(tenants) > 17 else tenants[0], TicketCategory.electrical, TicketPriority.medium, TicketStatus.cancelled, "Outlet not working", "Resolved by tenant resetting GFCI -- ticket cancelled.", None, True),
    ]
    tickets = []
    for prop, unit, tenant, cat, pri, status, title, desc, vendor, ai_touched in ticket_defs:
        completed = status == TicketStatus.completed
        tickets.append(MaintenanceTicket(
            property_id=prop.id, unit_id=unit.id, tenant_id=tenant.id, vendor_id=vendor.id if vendor else None,
            title=title, description=desc, category=cat, priority=pri, status=status,
            ai_classification=(f"Classified as {cat.value} / {pri.value} priority based on tenant description." if ai_touched else None),
            scheduled_date=_dt(3) if status in (TicketStatus.scheduled, TicketStatus.waiting_vendor) else None,
            completed_date=_dt(-5) if completed else None,
            estimated_cost=150 if not completed else None, actual_cost=180 if completed else None,
            tenant_notified=True, vendor_notified=vendor is not None,
        ))
    db.add_all(tickets)

    # ── Inspections ──
    inspections = [
        Inspection(organization_id=org.id, property_id=prop_riverside.id, unit_id=occupied_units[0].id,
                   inspection_type=InspectionType.annual, inspection_date=_d(-30), inspector_name="Demo Inspector",
                   status=InspectionStatus.completed, notes="Annual walkthrough -- unit in good condition overall."),
        Inspection(organization_id=org.id, property_id=prop_oakwood.id, unit_id=occupied_units[10].id if len(occupied_units) > 10 else occupied_units[0].id,
                   inspection_type=InspectionType.move_in, inspection_date=_d(-200), inspector_name="Demo Inspector",
                   status=InspectionStatus.completed, notes="Move-in condition documented, no pre-existing damage noted."),
        Inspection(organization_id=org.id, property_id=prop_downtown.id, unit_id=vacant_units[0].id if vacant_units else None,
                   inspection_type=InspectionType.move_out, inspection_date=_d(-14), inspector_name="Demo Inspector",
                   status=InspectionStatus.draft, notes="Move-out inspection pending final sign-off."),
    ]
    db.add_all(inspections)

    # ── Compliance items ──
    compliance = [
        ComplianceItem(organization_id=org.id, property_id=prop_riverside.id, category=ComplianceCategory.fire_inspection,
                       title="Annual Fire Inspection", issuing_authority="Austin Fire Dept", issued_date=_d(-400),
                       expiration_date=_d(-6), status=ComplianceStatus.active, notes="Renewal inspection needs scheduling."),
        ComplianceItem(organization_id=org.id, property_id=prop_riverside.id, category=ComplianceCategory.insurance,
                       title="Property Insurance Policy", issuing_authority="Statewide Insurance Group", issued_date=_d(-350),
                       expiration_date=_d(10), status=ComplianceStatus.active),
        ComplianceItem(organization_id=org.id, property_id=prop_oakwood.id, category=ComplianceCategory.rental_license,
                       title="Rental Registration Renewal", issuing_authority="City of Austin", issued_date=_d(-300),
                       expiration_date=_d(60), status=ComplianceStatus.active),
        ComplianceItem(organization_id=org.id, property_id=prop_oakwood.id, category=ComplianceCategory.smoke_detector,
                       title="Smoke Detector Certification", issuing_authority="Austin Fire Dept", issued_date=_d(-100),
                       expiration_date=_d(265), status=ComplianceStatus.active),
        ComplianceItem(organization_id=org.id, property_id=prop_downtown.id, category=ComplianceCategory.insurance,
                       title="Property Insurance Policy", issuing_authority="Statewide Insurance Group", issued_date=_d(-200),
                       expiration_date=_d(165), status=ComplianceStatus.active),
        ComplianceItem(organization_id=org.id, property_id=prop_downtown.id, category=ComplianceCategory.accessibility,
                       title="ADA Accessibility Review", issuing_authority="Texas Dept of Licensing", issued_date=_d(-500),
                       expiration_date=_d(-40), status=ComplianceStatus.resolved, notes="Resolved -- ramp installed and re-certified."),
    ]
    db.add_all(compliance)

    # ── Documents: write small real files so downloads actually work ──
    upload_root = "/app/uploads/documents"
    org_dir = os.path.join(upload_root, str(org.id))
    os.makedirs(org_dir, exist_ok=True)
    doc_defs = [
        (prop_riverside, DocumentCategory.lease, "Riverside Commons -- Master Lease Template",
         "This is a demo placeholder for a master lease template document.\nUsed to illustrate the Documents feature with a real, downloadable file.\n"),
        (prop_riverside, DocumentCategory.insurance, "Riverside Commons -- Property Insurance Policy 2026",
         "Demo placeholder: property insurance policy summary.\nCoverage, deductible, and renewal terms would appear here.\n"),
        (None, DocumentCategory.vendor_contract, "Reliable Plumbing Co -- Service Agreement",
         "Demo placeholder: vendor service agreement terms.\n"),
    ]
    documents = []
    for prop, cat, title, content in doc_defs:
        stored_name = f"{uuid.uuid4()}_{title.replace(' ', '_')}.txt"
        file_path = os.path.join(org_dir, stored_name)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            file_size = len(content.encode("utf-8"))
        except OSError as e:
            logger.warning(f"Could not write demo document file {file_path}: {e}")
            file_size = None
        documents.append(Document(
            organization_id=org.id, property_id=prop.id if prop else None, category=cat,
            title=title, filename=os.path.basename(file_path), file_path=file_path,
            file_size=file_size, mime_type="text/plain", extraction_status="unsupported",
        ))
    db.add_all(documents)

    # ── Rental inquiries: full funnel, mostly on the vacant Downtown Lofts units ──
    inquiry_defs = [
        ("Jordan", "Reyes", "jordan.reyes@resident.example", "5125552201", InquiryStatus.new, None, None, None, None, None, None),
        ("Taylor", "Brooks", "taylor.brooks@resident.example", "5125552202", InquiryStatus.contacted, None, None, None, None, None, None),
        ("Casey", "Nguyen", "casey.nguyen@resident.example", "5125552203", InquiryStatus.tour_scheduled, None, None, None, None, None, None),
        ("Morgan", "Diaz", "morgan.diaz@resident.example", "5125552204", InquiryStatus.applied, 72000, 710, "employed", "Regional Health Systems", True, 88),
        ("Riley", "Foster", "riley.foster@resident.example", "5125552205", InquiryStatus.applied, 31000, 560, "unemployed", None, False, 38),
        ("Avery", "Hall", "avery.hall@resident.example", "5125552206", InquiryStatus.converted, 65000, 690, "employed", "Austin Tech Co", True, 81),
    ]
    downtown_vacant = [u for u in vacant_units if u.property_id == prop_downtown.id]
    inquiries = []
    for i, (first, last, email, phone, status, income, credit, empstat, employer, approved, score) in enumerate(inquiry_defs):
        # Cycle only through Downtown Lofts' own vacant units, so unit_id always
        # matches the property_id set below -- picking from the wrong property's
        # vacant units would show a unit number that doesn't exist on this property.
        unit = downtown_vacant[i % len(downtown_vacant)] if downtown_vacant else None
        screened = income is not None
        inquiries.append(RentalInquiry(
            organization_id=org.id, property_id=prop_downtown.id, unit_id=unit.id if unit else None,
            first_name=first, last_name=last, email=email, phone=phone,
            message="Interested in the loft -- is it still available? Would love to see it this week." if status == InquiryStatus.new else None,
            desired_move_in=_d(30), status=status,
            annual_income=income, credit_score=credit, employment_status=empstat, employer=employer,
            screening_approved=approved, screening_score=score,
            screening_notes=("Meets income and credit criteria." if approved else "Below minimum income-to-rent ratio.") if screened else None,
            screened_at=_dt(-3) if screened else None,
            created_at=_dt(-(20 - i * 3)),
        ))
    db.add_all(inquiries)

    # ── Workflow automation rules ──
    workflows = [
        WorkflowRule(organization_id=org.id, name="Emergency maintenance -> notify owner immediately",
                    trigger=WorkflowTrigger.maintenance_created,
                    conditions=[{"field": "priority", "operator": "equals", "value": "emergency"}],
                    actions=[{"type": "notify_owner", "params": {}}], is_active=True, run_count=3,
                    last_run_at=_dt(-2)),
        WorkflowRule(organization_id=org.id, name="Rent overdue -> send reminder",
                    trigger=WorkflowTrigger.payment_overdue, conditions=[],
                    actions=[{"type": "send_email", "params": {"template": "rent_reminder"}}],
                    is_active=True, run_count=11, last_run_at=_dt(-1)),
        WorkflowRule(organization_id=org.id, name="New tenant -> welcome notification",
                    trigger=WorkflowTrigger.tenant_created, conditions=[],
                    actions=[{"type": "notify_owner", "params": {}}], is_active=True, run_count=17,
                    last_run_at=_dt(-9)),
    ]
    db.add_all(workflows)

    # ── Voice AI calls ──
    call_defs = [
        (tenants[0], "maintenance", "Tenant reported the emergency pipe leak and asked for immediate help.", 184, True),
        (tenants[1], "maintenance", "Tenant asked for an AC repair update; agent confirmed a technician is scheduled.", 96, True),
        (None, "leasing", "Prospect asked about pricing and availability at Downtown Lofts.", 142, False),
        (tenants[2], "tenant_support", "Tenant asked how to pay rent online; agent explained the tenant portal.", 61, True),
        (None, "leasing", "Prospect asked about pet policy and move-in timeline.", 118, False),
    ]
    voice_calls = []
    for i, (tenant, intent, outcome, dur, resolved) in enumerate(call_defs):
        started = _dt(-(14 - i * 2))
        transcript = json.dumps([
            {"role": "user", "content": "Hi, I need some help."},
            {"role": "assistant", "content": outcome},
        ])
        voice_calls.append(VoiceCall(
            call_sid=f"DEMO-CALL-{i+1:04d}", organization_id=org.id,
            tenant_id=tenant.id if tenant else None,
            property_id=prop_riverside.id if tenant else prop_downtown.id,
            from_number=tenant.phone if tenant else "5125559900",
            to_number="5125550100", status="completed", duration_seconds=dur,
            transcript=transcript, intent=intent, outcome_summary=outcome,
            owner_notified=True, started_at=started, ended_at=started + timedelta(seconds=dur),
        ))
    db.add_all(voice_calls)

    # ── AI call logs (usage tracking, feeds Executive Assistant + Maintenance stats) ──
    ai_logs = []
    for i in range(6):
        ai_logs.append(AICallLog(
            organization_id=org.id,
            feature="executive_query" if i % 2 == 0 else "maintenance_chat",
            created_at=_dt(-(25 - i * 4)),
        ))
    db.add_all(ai_logs)

    # ── Communication logs ──
    comm_defs = [
        (tenants[0], CommunicationChannel.sms, CommunicationTemplate.maintenance_update, "Your maintenance request has been scheduled for tomorrow between 9-11am."),
        (tenants[1], CommunicationChannel.email, CommunicationTemplate.rent_reminder, "Friendly reminder: rent is due in 3 days."),
        (tenants[2], CommunicationChannel.sms, CommunicationTemplate.maintenance_update, "Technician is on the way, ETA 20 minutes."),
        (tenants[3], CommunicationChannel.email, CommunicationTemplate.community_announcement, "Pool maintenance scheduled this weekend -- pool will be closed Saturday."),
        (tenants[4], CommunicationChannel.email, CommunicationTemplate.lease_renewal, "Your lease is coming up for renewal -- let us know if you'd like to discuss terms."),
    ]
    comms = []
    for i, (tenant, channel, template, body) in enumerate(comm_defs):
        comms.append(CommunicationLog(
            organization_id=org.id, tenant_id=tenant.id, channel=channel, template=template,
            recipient=tenant.email or tenant.phone, body=body, status=CommunicationStatus.sent,
            created_at=_dt(-(15 - i * 2)),
        ))
    db.add_all(comms)

    db.flush()

    return {
        "organization_id": str(org.id),
        "login_email": DEMO_USER_EMAIL,
        "login_password": password,
        "counts": {
            "properties": 3, "units": len(units), "tenants": len(tenants), "leases": len(leases),
            "rent_payments": len(payments), "expenses": len(expenses), "vendors": len(vendors),
            "maintenance_tickets": len(tickets), "inspections": len(inspections),
            "compliance_items": len(compliance), "documents": len(documents),
            "rental_inquiries": len(inquiries), "workflow_rules": len(workflows),
            "voice_calls": len(voice_calls), "ai_call_logs": len(ai_logs), "communication_logs": len(comms),
        },
    }
