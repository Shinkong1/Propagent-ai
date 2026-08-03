"""Investment Analysis Agent — per-property ROI, cap rate, cash flow, and DSCR,
with a rule-based Buy/Hold/Refinance/Sell recommendation.

Reuses the same NOI/cap-rate/DSCR math already used by the accounting reports
(trailing 12 months) so the numbers stay consistent across the app. Every
recommendation carries an explanation and a confidence score — this is a
deterministic rule engine over real financial data, not a trained model, and
it doesn't have market comps or appreciation data, so confidence is capped
below 1.0 to reflect that limitation.
"""
from datetime import date, timedelta
from sqlalchemy.orm import Session

from models.property import Property, Unit
from models.tenant import Lease
from models.accounting import RentPayment, Expense
from routes.accounting import _compute_financials

RECOMMENDATION_CONFIDENCE = 0.75


def _recommend(cap_rate, cash_flow, dscr):
    if cash_flow is None:
        return None, None

    if cash_flow < 0:
        if cap_rate is not None and cap_rate < 4.0:
            return "sell", f"Cap rate of {cap_rate}% combined with negative cash flow of ${cash_flow:,.0f}/yr suggests this property is underperforming."
        return "refinance", f"Cash flow is negative (${cash_flow:,.0f}/yr) but cap rate of {cap_rate}% is reasonable — refinancing to lower debt service could restore positive cash flow."

    if dscr is not None and dscr < 1.2:
        return "refinance", f"Cash flow is positive but DSCR of {dscr} is close to typical lender minimums (1.2+) — refinancing could widen the safety margin."

    if cap_rate is not None and cap_rate >= 9.0:
        return "buy", f"Cap rate of {cap_rate}% with positive cash flow of ${cash_flow:,.0f}/yr is an exceptional performer — consider acquiring similar properties."

    if cap_rate is not None and cap_rate >= 6.0:
        return "hold", f"Cap rate of {cap_rate}% and positive cash flow of ${cash_flow:,.0f}/yr indicate a solid performer."

    return "hold", f"Positive cash flow of ${cash_flow:,.0f}/yr and stable fundamentals — hold and monitor."


def compute_investment_analysis(db: Session, org_id) -> dict:
    properties = db.query(Property).filter(Property.organization_id == org_id, Property.is_active == True).all()
    end = date.today()
    start = end - timedelta(days=365)
    period_days = (end - start).days

    rows = []
    for p in properties:
        if not p.purchase_price:
            rows.append({
                "property_id": str(p.id),
                "property_name": p.name,
                "purchase_price": None,
                "insufficient_data": True,
                "explanation": "Add a purchase price to this property to enable investment analysis.",
            })
            continue

        income_q = db.query(RentPayment).join(Lease, RentPayment.lease_id == Lease.id).join(Unit).filter(
            Unit.property_id == p.id,
            RentPayment.due_date >= start,
            RentPayment.due_date <= end,
        )
        expense_q = db.query(Expense).filter(
            Expense.property_id == p.id,
            Expense.expense_date >= start,
            Expense.expense_date <= end,
        )
        financials = _compute_financials(income_q, expense_q, p.purchase_price, p.mortgage_payment, period_days)

        annual_cash_flow = round(financials["cash_flow"] * (365.0 / period_days), 2)
        roi = round((annual_cash_flow / p.purchase_price) * 100, 2) if p.purchase_price else None
        recommendation, explanation = _recommend(financials["cap_rate"], annual_cash_flow, financials["dscr"])

        rows.append({
            "property_id": str(p.id),
            "property_name": p.name,
            "purchase_price": p.purchase_price,
            "mortgage_payment": p.mortgage_payment,
            "noi": financials["annualized_noi"],
            "cap_rate": financials["cap_rate"],
            "dscr": financials["dscr"],
            "annual_cash_flow": annual_cash_flow,
            "roi": roi,
            "recommendation": recommendation,
            "explanation": explanation,
            "confidence": RECOMMENDATION_CONFIDENCE if recommendation else None,
            "insufficient_data": False,
        })

    analyzed = [r for r in rows if not r["insufficient_data"]]
    portfolio = {
        "properties_analyzed": len(analyzed),
        "properties_missing_data": len(rows) - len(analyzed),
        "total_annual_cash_flow": round(sum(r["annual_cash_flow"] for r in analyzed), 2) if analyzed else 0.0,
        "avg_cap_rate": round(sum(r["cap_rate"] for r in analyzed if r["cap_rate"] is not None) / len(analyzed), 2) if analyzed else None,
        "by_recommendation": {
            "buy": sum(1 for r in analyzed if r["recommendation"] == "buy"),
            "hold": sum(1 for r in analyzed if r["recommendation"] == "hold"),
            "refinance": sum(1 for r in analyzed if r["recommendation"] == "refinance"),
            "sell": sum(1 for r in analyzed if r["recommendation"] == "sell"),
        },
    }

    rows.sort(key=lambda r: (r["insufficient_data"], -(r["cap_rate"] or -999) if not r["insufficient_data"] else 0))
    return {"portfolio": portfolio, "properties": rows}
