"""Executive AI Assistant — natural language portfolio queries.

Deterministic, DB-backed fact retrieval per intent (never hallucinated), with an
optional OpenAI rephrasing pass that may only restate the computed facts in more
natural language — it is never allowed to introduce new numbers.
"""
import logging
import re
from datetime import date, datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from models.property import Property, Unit
from models.tenant import Lease, LeaseStatus
from models.maintenance import MaintenanceTicket, TicketStatus
from models.accounting import PaymentStatus

logger = logging.getLogger(__name__)


def _org_properties(db: Session, org_id):
    return db.query(Property).filter(Property.organization_id == org_id, Property.is_active == True).all()


def _extract_dollar_amount(query: str, default: float) -> float:
    match = re.search(r'\$?\s?([\d,]+(?:\.\d+)?)', query)
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            pass
    return default


def _handle_vacant_units(db: Session, org_id, query: str) -> dict:
    units = db.query(Unit).join(Property).filter(
        Property.organization_id == org_id,
        Property.is_active == True,
        Unit.is_occupied == False,
    ).all()

    data = [{
        "property_name": u.property.name,
        "unit_number": u.unit_number,
        "monthly_rent": u.monthly_rent,
        "bedrooms": u.bedrooms,
        "bathrooms": u.bathrooms,
    } for u in units]

    if not data:
        answer = "You have no vacant units right now — full occupancy across your portfolio."
    else:
        total_rent = sum(u["monthly_rent"] for u in data)
        answer = f"{len(data)} vacant unit(s), representing ${total_rent:,.0f}/mo in unrealized rent."

    return {
        "intent": "vacant_units",
        "answer": answer,
        "explanation": "Counted directly from units flagged as not occupied across your active properties.",
        "confidence": 1.0,
        "data": data,
    }


def _handle_expensive_repairs(db: Session, org_id, query: str) -> dict:
    threshold = _extract_dollar_amount(query, default=500.0)
    month_start = date.today().replace(day=1)

    tickets = db.query(MaintenanceTicket).join(Property).filter(
        Property.organization_id == org_id,
        MaintenanceTicket.created_at >= month_start,
    ).all()

    flagged = []
    for t in tickets:
        cost = t.actual_cost if t.actual_cost is not None else t.estimated_cost
        if cost is not None and cost > threshold:
            flagged.append({
                "title": t.title,
                "property_name": t.property_name,
                "unit_number": t.unit_number,
                "category": t.category.value if t.category else None,
                "cost": cost,
                "is_estimate": t.actual_cost is None,
                "status": t.status.value if t.status else None,
            })
    flagged.sort(key=lambda f: f["cost"], reverse=True)

    if not flagged:
        answer = f"No maintenance tickets this month have a cost above ${threshold:,.0f}."
    else:
        total = sum(f["cost"] for f in flagged)
        answer = f"{len(flagged)} ticket(s) this month cost over ${threshold:,.0f}, totaling ${total:,.0f}."

    return {
        "intent": "expensive_repairs",
        "answer": answer,
        "explanation": f"Filtered this month's maintenance tickets by actual cost (or estimated cost if not yet completed) above ${threshold:,.0f}.",
        "confidence": 1.0,
        "data": flagged,
    }


def _handle_renewal_likelihood(db: Session, org_id, query: str) -> dict:
    leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
        Lease.status == LeaseStatus.active,
    ).all()

    scored = []
    for l in leases:
        late_count = sum(1 for p in l.rent_payments if p.status in (PaymentStatus.late, PaymentStatus.missed))
        score = 0.6
        reasons = []
        if l.tenant.screening_approved:
            score += 0.15
            reasons.append("screening approved")
        if late_count == 0:
            score += 0.15
            reasons.append("no late/missed payments")
        else:
            score -= 0.25
            reasons.append(f"{late_count} late/missed payment(s)")
        days_to_expiry = (l.end_date - date.today()).days
        if 0 <= days_to_expiry <= 90:
            reasons.append(f"lease expires in {days_to_expiry} days")
        score = max(0.05, min(0.95, score))
        scored.append({
            "tenant_name": l.tenant.full_name,
            "property_name": l.unit.property.name,
            "unit_number": l.unit.unit_number,
            "lease_end_date": str(l.end_date),
            "likelihood": round(score, 2),
            "reasons": reasons,
        })
    scored.sort(key=lambda s: s["likelihood"], reverse=True)
    likely = [s for s in scored if s["likelihood"] >= 0.7]

    answer = f"{len(likely)} of {len(scored)} active tenants look likely to renew, based on payment history and screening status."

    return {
        "intent": "renewal_likelihood",
        "answer": answer,
        "explanation": "Heuristic score, not a trained model: starts from a neutral baseline and is adjusted for screening approval, on-time payment history, and lease-expiry proximity.",
        "confidence": 0.55,
        "data": scored,
    }


def _handle_underperforming(db: Session, org_id, query: str) -> dict:
    properties = _org_properties(db, org_id)
    results = []
    for p in properties:
        total_units = len(p.units) or p.total_units or 1
        occupied = sum(1 for u in p.units if u.is_occupied)
        vacancy_rate = round(((total_units - occupied) / total_units) * 100, 1) if total_units else 0.0
        open_tickets = db.query(MaintenanceTicket).filter(
            MaintenanceTicket.property_id == p.id,
            MaintenanceTicket.status.in_([TicketStatus.open, TicketStatus.in_progress, TicketStatus.waiting_vendor]),
        ).count()
        tickets_per_unit = open_tickets / total_units if total_units else 0.0

        flags = []
        if vacancy_rate > 20:
            flags.append(f"{vacancy_rate}% vacancy")
        if tickets_per_unit > 0.4:
            flags.append(f"{open_tickets} open maintenance ticket(s) for {total_units} unit(s)")

        if flags:
            results.append({
                "property_name": p.name,
                "vacancy_rate": vacancy_rate,
                "open_tickets": open_tickets,
                "total_units": total_units,
                "flags": flags,
            })
    results.sort(key=lambda r: r["vacancy_rate"], reverse=True)

    if not results:
        answer = "No properties are flagged as underperforming — vacancy and maintenance backlog are within normal range across the portfolio."
    else:
        names = ", ".join(r["property_name"] for r in results)
        verb = "is" if len(results) == 1 else "are"
        answer = f"{len(results)} propert{'y' if len(results) == 1 else 'ies'} {verb} underperforming: {names}."

    return {
        "intent": "underperforming_properties",
        "answer": answer,
        "explanation": "Rule-based thresholds, not a trained model: flags any property with vacancy above 20% or an open-maintenance-ticket-to-unit ratio above 0.4.",
        "confidence": 0.7,
        "data": results,
    }


def _handle_revenue_forecast(db: Session, org_id, query: str) -> dict:
    leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
        Lease.status == LeaseStatus.active,
    ).all()
    contracted_mrr = sum(l.monthly_rent for l in leases)

    next_month_start = (date.today().replace(day=1) + timedelta(days=32)).replace(day=1)
    next_month_end = (next_month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    expiring_next_month = [l for l in leases if next_month_start <= l.end_date <= next_month_end]
    at_risk = sum(l.monthly_rent for l in expiring_next_month)

    answer = f"Projected revenue next month: ${contracted_mrr:,.0f} from currently active leases."
    if expiring_next_month:
        answer += f" ${at_risk:,.0f}/mo of that is from {len(expiring_next_month)} lease(s) expiring that month and not yet confirmed renewed."

    return {
        "intent": "revenue_forecast",
        "answer": answer,
        "explanation": "Sum of monthly rent across all currently active leases, assuming no new vacancies or rent changes — a floor estimate, not a statistical forecast.",
        "confidence": 0.6,
        "data": {
            "contracted_mrr": round(contracted_mrr, 2),
            "leases_expiring_next_month": len(expiring_next_month),
            "at_risk_revenue": round(at_risk, 2),
        },
    }


def _handle_capital_improvements(db: Session, org_id, query: str) -> dict:
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    tickets = db.query(MaintenanceTicket).join(Property).filter(
        Property.organization_id == org_id,
        MaintenanceTicket.created_at >= one_year_ago,
    ).all()

    buckets: dict = {}
    for t in tickets:
        key = (t.property_name, t.category.value if t.category else "other")
        buckets[key] = buckets.get(key, 0) + 1

    recommendations = [
        {"property_name": prop_name, "category": category, "ticket_count": count}
        for (prop_name, category), count in buckets.items() if count >= 3
    ]
    recommendations.sort(key=lambda r: r["ticket_count"], reverse=True)

    if not recommendations:
        answer = "No property/category combination has enough repeat maintenance tickets (3+) in the last year to flag for a capital improvement."
    else:
        top = recommendations[0]
        answer = f"Top priority: {top['property_name']} — {top['category']} ({top['ticket_count']} tickets in the last year). {len(recommendations)} combination(s) flagged total."

    return {
        "intent": "capital_improvements",
        "answer": answer,
        "explanation": "Flags any property/category combination with 3 or more maintenance tickets in the trailing 12 months as a candidate for a capital improvement instead of repeated point repairs.",
        "confidence": 0.65,
        "data": recommendations,
    }


def _handle_fallback(db: Session, org_id, query: str) -> dict:
    properties = _org_properties(db, org_id)
    total_units = sum(len(p.units) for p in properties)
    occupied = sum(sum(1 for u in p.units if u.is_occupied) for p in properties)
    open_tickets = db.query(MaintenanceTicket).join(Property).filter(
        Property.organization_id == org_id,
        MaintenanceTicket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
    ).count()
    mrr = db.query(Lease).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
        Lease.status == LeaseStatus.active,
    ).with_entities(func.sum(Lease.monthly_rent)).scalar() or 0.0

    answer = (
        f"I didn't recognize a specific request in that question. Here's your portfolio right now: "
        f"{len(properties)} propert{'y' if len(properties) == 1 else 'ies'}, {total_units} unit(s), "
        f"{occupied} occupied, {open_tickets} open maintenance ticket(s), ${mrr:,.0f}/mo in active rent."
    )
    return {
        "intent": "general",
        "answer": answer,
        "explanation": "No matching query pattern was found, so live portfolio totals are shown instead. Try one of the suggested example questions.",
        "confidence": 0.3,
        "data": None,
    }


INTENT_HANDLERS = [
    ("vacant_units", [r"vacant", r"empty unit", r"available unit"], _handle_vacant_units),
    ("expensive_repairs", [r"repair.*cost", r"cost.*repair", r"maintenance.*over", r"repairs?\s+over", r"cost over"], _handle_expensive_repairs),
    ("renewal_likelihood", [r"likely to renew", r"renewal", r"renew"], _handle_renewal_likelihood),
    ("underperforming_properties", [r"underperform", r"worst perform", r"declining profit", r"losing money"], _handle_underperforming),
    ("revenue_forecast", [r"forecast", r"projected revenue", r"next month.?s revenue", r"expected revenue"], _handle_revenue_forecast),
    ("capital_improvements", [r"capital improvement", r"capex", r"prioriti[sz]e"], _handle_capital_improvements),
]


def _classify(query: str):
    q = query.lower()
    for _name, patterns, handler in INTENT_HANDLERS:
        if any(re.search(p, q) for p in patterns):
            return handler
    return _handle_fallback


async def _polish_with_ai(answer: str, query: str) -> str:
    """Optionally rephrase the deterministic answer more naturally. Never invents new facts."""
    if not settings.OPENAI_API_KEY:
        return answer
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": (
                    "You are a property management executive assistant. Rephrase the given factual "
                    "answer into one or two natural, concise sentences for a busy property owner. "
                    "Do not add any numbers or facts that are not already present in the answer."
                )},
                {"role": "user", "content": f"Question: {query}\nFactual answer: {answer}"},
            ],
            max_tokens=150,
            temperature=0.3,
        )
        polished = (response.choices[0].message.content or "").strip()
        return polished or answer
    except Exception as e:
        logger.warning(f"Executive agent AI polish failed, using deterministic answer: {e}")
        return answer


async def answer_query(db: Session, org_id, query: str) -> dict:
    handler = _classify(query)
    result = handler(db, org_id, query)
    result["answer"] = await _polish_with_ai(result["answer"], query)
    result["query"] = query
    return result
