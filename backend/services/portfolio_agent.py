"""Portfolio Management Agent — consolidated cross-property health view.

Assembles occupancy, revenue, expenses, delinquencies, lease expirations,
maintenance backlog, cash flow, and capital expenditures that already exist
across the property/tenant/maintenance/accounting models into one view, plus
a rule-based property health score with an explanation for each component.
"""
from datetime import date, datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.property import Property, Unit
from models.tenant import Lease, LeaseStatus
from models.maintenance import MaintenanceTicket, TicketStatus
from models.accounting import RentPayment, Expense, PaymentStatus, ExpenseCategory

OPEN_TICKET_STATUSES = [TicketStatus.open, TicketStatus.in_progress, TicketStatus.waiting_vendor, TicketStatus.scheduled]
DELINQUENT_STATUSES = [PaymentStatus.late, PaymentStatus.missed, PaymentStatus.partial]


def _lease_expirations(leases, today):
    exp_30 = exp_60 = exp_90 = 0
    for l in leases:
        days = (l.end_date - today).days
        if 0 <= days <= 30:
            exp_30 += 1
        if 0 <= days <= 60:
            exp_60 += 1
        if 0 <= days <= 90:
            exp_90 += 1
    return exp_30, exp_60, exp_90


def _delinquency(db: Session, lease_ids, today):
    if not lease_ids:
        return 0, 0.0
    payments = db.query(RentPayment).filter(
        RentPayment.lease_id.in_(lease_ids),
        (RentPayment.status.in_(DELINQUENT_STATUSES)) |
        ((RentPayment.status == PaymentStatus.pending) & (RentPayment.due_date < today)),
    ).all()
    return len(payments), round(sum(p.amount for p in payments), 2)


def _maintenance_backlog(db: Session, property_id, now):
    open_tickets = db.query(MaintenanceTicket).filter(
        MaintenanceTicket.property_id == property_id,
        MaintenanceTicket.status.in_(OPEN_TICKET_STATUSES),
    ).all()
    count = len(open_tickets)
    avg_age = round(sum((now - t.created_at).days for t in open_tickets) / count, 1) if count else 0.0
    return count, avg_age


def _cash_flow_30d(db: Session, lease_ids, property_ids, today):
    start = today - timedelta(days=30)

    collected = 0.0
    if lease_ids:
        collected = db.query(RentPayment).filter(
            RentPayment.lease_id.in_(lease_ids),
            RentPayment.status == PaymentStatus.paid,
            RentPayment.paid_date >= start,
        ).with_entities(func.sum(RentPayment.amount)).scalar() or 0.0

    expenses = 0.0
    if property_ids:
        expenses = db.query(Expense).filter(
            Expense.property_id.in_(property_ids),
            Expense.expense_date >= start,
        ).with_entities(func.sum(Expense.amount)).scalar() or 0.0

    return round(collected, 2), round(expenses, 2), round(collected - expenses, 2)


def _capex_trailing_12mo(db: Session, property_ids):
    if not property_ids:
        return 0.0
    one_year_ago = date.today() - timedelta(days=365)
    total = db.query(Expense).filter(
        Expense.property_id.in_(property_ids),
        Expense.category == ExpenseCategory.capital_improvement,
        Expense.expense_date >= one_year_ago,
    ).with_entities(func.sum(Expense.amount)).scalar() or 0.0
    return round(total, 2)


def _health_score(vacancy_rate, delinquent_amount, revenue_mrr, maintenance_open, total_units, cash_flow_30d):
    """Rule-based 0-100 composite score across four equally-weighted factors."""
    factors = []

    vacancy_component = max(0.0, 100 - vacancy_rate * 2.5)
    factors.append({"name": "occupancy", "score": round(vacancy_component, 1), "detail": f"{vacancy_rate}% vacancy"})

    delinquency_rate = (delinquent_amount / revenue_mrr * 100) if revenue_mrr else 0.0
    delinquency_component = max(0.0, 100 - delinquency_rate * 4)
    factors.append({"name": "delinquency", "score": round(delinquency_component, 1), "detail": f"${delinquent_amount:,.0f} delinquent vs ${revenue_mrr:,.0f}/mo revenue"})

    tickets_per_unit = (maintenance_open / total_units) if total_units else 0.0
    maintenance_component = max(0.0, 100 - tickets_per_unit * 80)
    factors.append({"name": "maintenance_backlog", "score": round(maintenance_component, 1), "detail": f"{maintenance_open} open ticket(s) for {total_units} unit(s)"})

    cash_flow_component = 100.0 if cash_flow_30d >= 0 else max(0.0, 100 + (cash_flow_30d / max(revenue_mrr, 1)) * 100)
    factors.append({"name": "cash_flow", "score": round(cash_flow_component, 1), "detail": f"${cash_flow_30d:,.0f} net cash flow (30d)"})

    score = round(sum(f["score"] for f in factors) / len(factors))
    grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F"
    return score, grade, factors


def compute_portfolio_dashboard(db: Session, org_id) -> dict:
    today = date.today()
    now = datetime.utcnow()

    properties = db.query(Property).filter(Property.organization_id == org_id, Property.is_active == True).all()
    property_rows = []

    portfolio_totals = {
        "total_properties": len(properties), "total_units": 0, "occupied_units": 0,
        "revenue_mrr": 0.0, "collected_30d": 0.0, "expenses_30d": 0.0, "cash_flow_30d": 0.0,
        "delinquent_count": 0, "delinquent_amount": 0.0,
        "leases_expiring_30": 0, "leases_expiring_60": 0, "leases_expiring_90": 0,
        "maintenance_open": 0, "capex_trailing_12mo": 0.0,
        "health_scores": [],
    }

    for p in properties:
        units = p.units
        total_units = len(units) or p.total_units or 0
        occupied_units = sum(1 for u in units if u.is_occupied)
        vacancy_rate = round(((total_units - occupied_units) / total_units) * 100, 1) if total_units else 0.0

        active_leases = [l for u in units for l in u.leases if l.status == LeaseStatus.active]
        lease_ids = [l.id for l in active_leases]
        revenue_mrr = sum(l.monthly_rent for l in active_leases)

        exp_30, exp_60, exp_90 = _lease_expirations(active_leases, today)
        delinquent_count, delinquent_amount = _delinquency(db, lease_ids, today)
        maintenance_open, maintenance_avg_age = _maintenance_backlog(db, p.id, now)
        collected_30d, expenses_30d, cash_flow_30d = _cash_flow_30d(db, lease_ids, [p.id], today)
        capex = _capex_trailing_12mo(db, [p.id])

        score, grade, factors = _health_score(vacancy_rate, delinquent_amount, revenue_mrr, maintenance_open, total_units, cash_flow_30d)

        property_rows.append({
            "property_id": str(p.id),
            "property_name": p.name,
            "total_units": total_units,
            "occupied_units": occupied_units,
            "vacancy_rate": vacancy_rate,
            "revenue_mrr": round(revenue_mrr, 2),
            "collected_30d": collected_30d,
            "expenses_30d": expenses_30d,
            "cash_flow_30d": cash_flow_30d,
            "delinquent_count": delinquent_count,
            "delinquent_amount": delinquent_amount,
            "leases_expiring_30": exp_30,
            "leases_expiring_60": exp_60,
            "leases_expiring_90": exp_90,
            "maintenance_open": maintenance_open,
            "maintenance_avg_age_days": maintenance_avg_age,
            "capex_trailing_12mo": capex,
            "health_score": score,
            "health_grade": grade,
            "health_factors": factors,
        })

        portfolio_totals["total_units"] += total_units
        portfolio_totals["occupied_units"] += occupied_units
        portfolio_totals["revenue_mrr"] += revenue_mrr
        portfolio_totals["collected_30d"] += collected_30d
        portfolio_totals["expenses_30d"] += expenses_30d
        portfolio_totals["cash_flow_30d"] += cash_flow_30d
        portfolio_totals["delinquent_count"] += delinquent_count
        portfolio_totals["delinquent_amount"] += delinquent_amount
        portfolio_totals["leases_expiring_30"] += exp_30
        portfolio_totals["leases_expiring_60"] += exp_60
        portfolio_totals["leases_expiring_90"] += exp_90
        portfolio_totals["maintenance_open"] += maintenance_open
        portfolio_totals["capex_trailing_12mo"] += capex
        portfolio_totals["health_scores"].append(score)

    health_scores = portfolio_totals.pop("health_scores")
    portfolio_totals["avg_health_score"] = round(sum(health_scores) / len(health_scores)) if health_scores else None
    portfolio_totals["vacancy_rate"] = round(
        ((portfolio_totals["total_units"] - portfolio_totals["occupied_units"]) / portfolio_totals["total_units"]) * 100, 1
    ) if portfolio_totals["total_units"] else 0.0
    for k in ("revenue_mrr", "collected_30d", "expenses_30d", "cash_flow_30d", "delinquent_amount", "capex_trailing_12mo"):
        portfolio_totals[k] = round(portfolio_totals[k], 2)

    property_rows.sort(key=lambda r: r["health_score"])

    return {"portfolio": portfolio_totals, "properties": property_rows}
