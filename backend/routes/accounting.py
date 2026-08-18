"""Accounting & financial reporting routes"""
import logging
from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User
from models.property import Property, Unit
from models.tenant import Lease
from models.accounting import RentPayment, Expense, ExpenseCategory, PaymentStatus
from schemas.accounting import RentPaymentCreate, RentPaymentResponse, ExpenseCreate, ExpenseResponse
from middleware.auth import get_current_user
from services.export_service import rows_to_csv, sheets_to_excel, accounting_report_pdf

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/accounting", tags=["accounting"])

NON_OPERATING_CATEGORIES = [ExpenseCategory.mortgage, ExpenseCategory.capital_improvement]


def _verify_property(db: Session, property_id: UUID, org_id) -> Property:
    prop = db.query(Property).filter(Property.id == property_id, Property.organization_id == org_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop


def _verify_lease(db: Session, lease_id: UUID, org_id) -> Lease:
    lease = db.query(Lease).join(Unit).join(Property).filter(
        Lease.id == lease_id, Property.organization_id == org_id
    ).first()
    if not lease:
        raise HTTPException(status_code=404, detail="Lease not found")
    return lease


@router.get("/leases", response_model=List[dict])
async def list_leases_for_billing(
    property_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Active leases with tenant/unit context, for payment-recording pickers"""
    from models.tenant import Tenant, LeaseStatus

    query = db.query(Lease).join(Unit).join(Property).join(Tenant).filter(
        Property.organization_id == current_user.organization_id,
        Lease.status == LeaseStatus.active,
    )
    if property_id:
        query = query.filter(Unit.property_id == property_id)

    leases = query.all()
    return [{
        "id": str(l.id),
        "tenant_name": l.tenant.full_name,
        "property_name": l.unit.property.name,
        "unit_number": l.unit.unit_number,
        "monthly_rent": l.monthly_rent,
    } for l in leases]


@router.post("/payments", response_model=RentPaymentResponse, status_code=201)
async def record_payment(
    payload: RentPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _verify_lease(db, payload.lease_id, current_user.organization_id)
    payment = RentPayment(**payload.dict())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/payments", response_model=List[RentPaymentResponse])
async def list_payments(
    property_id: Optional[UUID] = None,
    lease_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).join(Property).filter(
        Property.organization_id == current_user.organization_id
    )
    if property_id:
        query = query.filter(Unit.property_id == property_id)
    if lease_id:
        query = query.filter(RentPayment.lease_id == lease_id)
    return query.order_by(RentPayment.due_date.desc()).all()


@router.post("/expenses", response_model=ExpenseResponse, status_code=201)
async def record_expense(
    payload: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _verify_property(db, payload.property_id, current_user.organization_id)
    # vendor_id is optional and was previously persisted unchecked -- a
    # foreign org's real vendor_id would create a cross-org dangling
    # reference and leak that vendor's name back via ExpenseResponse.
    # Found in a security audit.
    if payload.vendor_id:
        from models.maintenance import Vendor
        owns_vendor = db.query(Vendor.id).filter(Vendor.id == payload.vendor_id, Vendor.organization_id == current_user.organization_id).first()
        if not owns_vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
    expense = Expense(**payload.dict())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/expenses", response_model=List[ExpenseResponse])
async def list_expenses(
    property_id: Optional[UUID] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Expense).join(Property).filter(Property.organization_id == current_user.organization_id)
    if property_id:
        query = query.filter(Expense.property_id == property_id)
    if category:
        query = query.filter(Expense.category == category)
    return query.order_by(Expense.expense_date.desc()).all()


def _compute_financials(income_q, expense_q, purchase_price, mortgage_payment, period_days: int) -> dict:
    total_income = income_q.with_entities(func.sum(RentPayment.amount)).filter(
        RentPayment.status == PaymentStatus.paid
    ).scalar() or 0.0
    total_expenses = expense_q.with_entities(func.sum(Expense.amount)).scalar() or 0.0
    operating_expenses = expense_q.filter(~Expense.category.in_(NON_OPERATING_CATEGORIES)).with_entities(
        func.sum(Expense.amount)
    ).scalar() or 0.0

    noi = total_income - operating_expenses
    annualization_factor = 365.0 / period_days if period_days > 0 else 1.0
    annual_noi = noi * annualization_factor

    cap_rate = round((annual_noi / purchase_price) * 100, 2) if purchase_price else None
    annual_debt_service = (mortgage_payment * 12) if mortgage_payment else None
    dscr = round(annual_noi / annual_debt_service, 2) if annual_debt_service else None
    monthly_debt_service = mortgage_payment or 0.0
    cash_flow = round(noi - (monthly_debt_service * (period_days / 30.44)), 2)

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "operating_expenses": round(operating_expenses, 2),
        "noi": round(noi, 2),
        "annualized_noi": round(annual_noi, 2),
        "cap_rate": cap_rate,
        "dscr": dscr,
        "cash_flow": cash_flow,
    }


@router.get("/reports/property/{property_id}")
async def property_financials(
    property_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    prop = _verify_property(db, property_id, current_user.organization_id)
    end = end_date or date.today()
    start = start_date or (end - timedelta(days=365))
    period_days = max((end - start).days, 1)

    income_q = db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).filter(
        Unit.property_id == property_id,
        RentPayment.due_date >= start,
        RentPayment.due_date <= end,
    )
    expense_q = db.query(Expense).filter(
        Expense.property_id == property_id,
        Expense.expense_date >= start,
        Expense.expense_date <= end,
    )

    result = _compute_financials(income_q, expense_q, prop.purchase_price, prop.mortgage_payment, period_days)
    result.update({
        "property_id": str(property_id),
        "property_name": prop.name,
        "period_start": str(start),
        "period_end": str(end),
    })
    return result


@router.get("/reports/portfolio")
async def portfolio_financials(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org_id = current_user.organization_id
    end = end_date or date.today()
    start = start_date or (end - timedelta(days=365))
    period_days = max((end - start).days, 1)

    properties = db.query(Property).filter(Property.organization_id == org_id, Property.is_active == True).all()
    total_purchase_price = sum(p.purchase_price for p in properties if p.purchase_price) or None
    total_mortgage = sum(p.mortgage_payment for p in properties if p.mortgage_payment) or None

    income_q = db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
        RentPayment.due_date >= start,
        RentPayment.due_date <= end,
    )
    expense_q = db.query(Expense).join(Property).filter(
        Property.organization_id == org_id,
        Expense.expense_date >= start,
        Expense.expense_date <= end,
    )

    result = _compute_financials(income_q, expense_q, total_purchase_price, total_mortgage, period_days)
    result.update({
        "period_start": str(start),
        "period_end": str(end),
        "property_count": len(properties),
    })
    return result


def _report_export(report: dict, scope_label: str, format: str) -> Response:
    if format not in ("csv", "xlsx", "pdf"):
        raise HTTPException(status_code=422, detail="format must be csv, xlsx, or pdf")

    if format == "csv":
        content = rows_to_csv([{"metric": k, "value": v} for k, v in report.items()])
        media_type, ext = "text/csv", "csv"
    elif format == "xlsx":
        content = sheets_to_excel({"Report": [{"metric": k, "value": v} for k, v in report.items()]})
        media_type, ext = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    else:
        content = accounting_report_pdf(report, scope_label)
        media_type, ext = "application/pdf", "pdf"

    return Response(
        content=content, media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="financial_report.{ext}"'},
    )


@router.get("/reports/portfolio/export")
async def export_portfolio_financials(
    format: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await portfolio_financials(start_date, end_date, db, current_user)
    org_name = current_user.organization.name if current_user.organization else "Portfolio"
    return _report_export(report, org_name, format)


@router.get("/reports/property/{property_id}/export")
async def export_property_financials(
    property_id: UUID,
    format: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = await property_financials(property_id, start_date, end_date, db, current_user)
    return _report_export(report, report.get("property_name", "Property"), format)
