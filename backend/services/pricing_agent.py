"""Pricing Intelligence Agent — rent benchmarking, vacancy forecasting, and
seasonal demand, computed entirely from this organization's own portfolio data.

There is no external market-data feed (Zillow/Apartments.com) wired up, so
"comparable rental analysis" here means comparing each unit to other units of
the same bedroom count within your own portfolio, not live external market
comps. Every recommendation carries an explanation and a confidence score.
"""
from collections import defaultdict
from datetime import date, timedelta
from statistics import mean, median
from sqlalchemy.orm import Session

from models.property import Property, Unit
from models.tenant import Lease, LeaseStatus

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
OVERPRICED_THRESHOLD = 1.10   # >10% above cohort average
UNDERPRICED_THRESHOLD = 0.90  # >10% below cohort average
CONCESSION_CONFIDENCE = 0.7
REPRICE_CONFIDENCE = 0.75


def _bedroom_cohorts(units: list) -> dict:
    """Group units by bedroom count, keyed by int bedrooms -> list of rents."""
    cohorts = defaultdict(list)
    for u in units:
        cohorts[u.bedrooms].append(u.monthly_rent)
    return cohorts


def compute_pricing_analysis(db: Session, org_id) -> dict:
    properties = db.query(Property).filter(Property.organization_id == org_id, Property.is_active == True).all()
    all_units = [u for p in properties for u in p.units]

    cohorts = _bedroom_cohorts(all_units)
    cohort_stats = {
        bd: {"avg": round(mean(rents), 2), "median": round(median(rents), 2), "count": len(rents)}
        for bd, rents in cohorts.items()
    }

    today = date.today()
    unit_rows = []
    for u in all_units:
        stats = cohort_stats.get(u.bedrooms)
        deviation_pct = round(((u.monthly_rent - stats["avg"]) / stats["avg"]) * 100, 1) if stats and stats["avg"] else None

        position = "at_market"
        if deviation_pct is not None:
            if u.monthly_rent >= stats["avg"] * OVERPRICED_THRESHOLD:
                position = "overpriced"
            elif u.monthly_rent <= stats["avg"] * UNDERPRICED_THRESHOLD:
                position = "underpriced"

        recommendation = None
        explanation = None
        confidence = None
        if u.is_occupied and position == "underpriced":
            recommendation = "raise_rent"
            explanation = f"${u.monthly_rent:,.0f}/mo is {abs(deviation_pct)}% below the ${stats['avg']:,.0f} average for {u.bedrooms}-bedroom units in your portfolio — consider raising rent at next renewal."
            confidence = REPRICE_CONFIDENCE
        elif not u.is_occupied and position == "overpriced":
            recommendation = "offer_concession"
            explanation = f"This vacant unit is priced {deviation_pct}% above the ${stats['avg']:,.0f} average for {u.bedrooms}-bedroom units — consider a concession (e.g. one month free) or a price reduction to accelerate leasing."
            confidence = CONCESSION_CONFIDENCE
        elif not u.is_occupied:
            recommendation = "list_at_market"
            explanation = f"List around the ${stats['median']:,.0f} median for {u.bedrooms}-bedroom units in your portfolio." if stats else "Not enough comparable units in your portfolio to benchmark this unit yet."
            confidence = REPRICE_CONFIDENCE if stats else None

        unit_rows.append({
            "unit_id": str(u.id),
            "property_name": u.property.name if u.property else None,
            "unit_number": u.unit_number,
            "bedrooms": u.bedrooms,
            "monthly_rent": u.monthly_rent,
            "is_occupied": u.is_occupied,
            "cohort_avg": stats["avg"] if stats else None,
            "cohort_median": stats["median"] if stats else None,
            "cohort_size": stats["count"] if stats else 0,
            "deviation_pct": deviation_pct,
            "position": position,
            "recommendation": recommendation,
            "explanation": explanation,
            "confidence": confidence,
        })

    # Vacancy forecast — active leases expiring soon become forecasted vacancies
    active_leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
        Lease.status == LeaseStatus.active,
    ).all()
    vacancy_forecast = {"next_30_days": 0, "next_60_days": 0, "next_90_days": 0}
    for l in active_leases:
        days = (l.end_date - today).days
        if 0 <= days <= 30:
            vacancy_forecast["next_30_days"] += 1
        if 0 <= days <= 60:
            vacancy_forecast["next_60_days"] += 1
        if 0 <= days <= 90:
            vacancy_forecast["next_90_days"] += 1

    # Seasonal demand — historical lease start months across all leases ever recorded
    all_leases = db.query(Lease).join(Unit).join(Property).filter(
        Property.organization_id == org_id,
    ).all()
    month_counts = [0] * 12
    for l in all_leases:
        if l.start_date:
            month_counts[l.start_date.month - 1] += 1
    seasonal_demand = [{"month": MONTH_NAMES[i], "lease_starts": month_counts[i]} for i in range(12)]
    total_leases_counted = sum(month_counts)

    total_units = len(all_units)
    occupied_units = sum(1 for u in all_units if u.is_occupied)

    return {
        "portfolio": {
            "total_units": total_units,
            "occupied_units": occupied_units,
            "vacant_units": total_units - occupied_units,
            "overpriced_count": sum(1 for r in unit_rows if r["position"] == "overpriced"),
            "underpriced_count": sum(1 for r in unit_rows if r["position"] == "underpriced"),
            "vacancy_forecast": vacancy_forecast,
        },
        "units": unit_rows,
        "seasonal_demand": seasonal_demand,
        "seasonal_demand_sample_size": total_leases_counted,
    }
