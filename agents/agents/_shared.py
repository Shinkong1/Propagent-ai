"""Shared helpers used by more than one agent node."""


def get_available_listings(organization_id: str) -> str:
    """Real, current vacancy data for this org -- the ONLY source of truth
    any agent describing availability is allowed to reference. Always
    returns an explicit statement (never a blank string) so the model is
    never left to fill a gap with a plausible-sounding guess -- that's
    exactly how it ends up inventing units in a city ("Sunset, Florida")
    that isn't in the portfolio at all."""
    from database.base import SessionLocal
    from models.property import Property
    from uuid import UUID

    db = SessionLocal()
    try:
        properties = (
            db.query(Property)
            .filter(Property.organization_id == UUID(organization_id), Property.is_active == True)
            .all()
        )
        if not properties:
            return "This organization has no properties on file at all. Do not claim to have any units, properties, or locations available anywhere."

        lines = []
        any_vacancy = False
        for p in properties:
            avail_units = [u for u in p.units if not u.is_occupied]
            if not avail_units:
                continue
            any_vacancy = True
            unit_descs = ", ".join(
                f"Unit {u.unit_number} ({u.bedrooms}bd/{u.bathrooms}ba, ${u.monthly_rent:.0f}/mo)"
                for u in avail_units[:6]
            )
            lines.append(f"- {p.name} in {p.city}, {p.state}: {unit_descs}")

        if not any_vacancy:
            names = ", ".join(f"{p.name} ({p.city}, {p.state})" for p in properties)
            return f"This organization's only properties are: {names}. NONE currently have a vacant unit. Do not claim any unit is available -- offer to take the caller's info for when something opens up instead."

        return "The ONLY real, current vacancies you may describe:\n" + "\n".join(lines)
    finally:
        db.close()


NO_ORG_WARNING = (
    "No organization could be identified for this caller -- their phone number/session doesn't "
    "match any known tenant, applicant, or account. You have NO property data to draw on. Do not "
    "invent property names, cities, states, or availability under any circumstances. Ask who they're "
    "trying to reach (company or property name) so a human can route them, or offer to take a message."
)
