"""Loose phone-number matching for caller-ID lookups.

Twilio always reports the caller's number in strict E.164 (e.g.
"+15125551203"), but phone numbers are free-text everywhere else in this
app (Tenant.phone, RentalInquiry.phone) -- entered by staff as
"(512) 555-1203", "512-555-1203", "5125551234", etc. A raw string-equality
match against Twilio's caller ID essentially never matches a real record,
silently breaking call attribution for virtually every tenant. Comparing
the last 10 digits of both sides is a pragmatic fix for US/Canada numbers
(this app's current market) without adding a full phonenumbers-library
dependency.
"""
from sqlalchemy import func, false


def phone_match_filter(column, caller_phone: str):
    """SQLAlchemy filter: True where the last 10 digits of `column` (after
    stripping every non-digit character) equal the last 10 digits of
    caller_phone. Returns an always-false filter if caller_phone doesn't
    have at least 10 digits, so a blank/malformed number never matches
    every blank column value."""
    digits = ''.join(ch for ch in (caller_phone or '') if ch.isdigit())
    last10 = digits[-10:]
    if len(last10) < 10:
        return false()
    return func.right(func.regexp_replace(column, r'\D', '', 'g'), 10) == last10
