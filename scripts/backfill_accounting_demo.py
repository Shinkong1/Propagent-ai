"""
Backfill 12 months of demo rent payments and expenses for an already-seeded database.
Useful when the Accounting Agent ships after the initial seed already ran.
Run: python scripts/backfill_accounting_demo.py
"""
import sys, os
from datetime import date, timedelta
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database.base import SessionLocal
from models.property import Property
from models.tenant import Lease, LeaseStatus
from models.accounting import RentPayment, Expense, PaymentStatus, PaymentMethod, ExpenseCategory

PROPERTY_FINANCIALS = {
    "Sunset Towers": (1800000.0, 7500.0),
    "Riverside Commons": (950000.0, 4100.0),
    "Cedar Heights": (2600000.0, 10800.0),
}


def backfill():
    db = SessionLocal()
    try:
        props = db.query(Property).all()
        if not props:
            print("No properties found — run seed_database.py first.")
            return

        print("💵 Setting purchase price / mortgage payment on properties...")
        for prop in props:
            if prop.name in PROPERTY_FINANCIALS and not prop.purchase_price:
                prop.purchase_price, prop.mortgage_payment = PROPERTY_FINANCIALS[prop.name]
        db.commit()

        if db.query(RentPayment).first() or db.query(Expense).first():
            print("✅ Rent payments / expenses already exist — skipping.")
            return

        leases = db.query(Lease).filter(Lease.status == LeaseStatus.active).all()
        print(f"💰 Creating 12 months of rent payments for {len(leases)} leases and expenses for {len(props)} properties...")

        today = date.today()
        for month_offset in range(11, -1, -1):
            month_date = (today.replace(day=1) - timedelta(days=month_offset * 30)).replace(day=1)

            for lease in leases:
                is_late = (month_offset % 5 == 0)
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
                prop_leases = [l for l in leases if l.unit.property_id == prop.id]
                if month_offset % 4 == 0 and prop_leases:
                    db.add(Expense(
                        property_id=prop.id, category=ExpenseCategory.management_fee,
                        amount=round(sum(l.monthly_rent for l in prop_leases) * 0.08, 2),
                        expense_date=month_date, description="Property management fee",
                    ))

        db.commit()
        print("✅ Backfill complete!")

    except Exception as e:
        db.rollback()
        print(f"❌ Backfill failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    backfill()
