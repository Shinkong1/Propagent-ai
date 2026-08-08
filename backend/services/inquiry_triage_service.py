"""Automatic triage for inbound rental inquiries -- runs the moment an
inquiry arrives, before anyone has manually screened financials. Distinct
from services/tenant_service.py's evaluate_screening(): screening needs
the applicant to supply income/credit/employment data by hand and decides
approve/deny; triage needs nothing from them at all, and only ever
produces an informational hot/warm/cold read on what they already wrote
(the message, move-in timeline, contact completeness) -- meant to help a
subscriber with a pile of inquiries know who to call first, not to
approve or reject anyone. Never treat priority_label/priority_score as a
screening decision; it isn't one.
"""
import logging
import re
from datetime import datetime, date

logger = logging.getLogger(__name__)

URGENCY_WORDS = (
    "asap", "urgent", "urgently", "immediately", "right away", "as soon as possible",
    "need to move", "moving soon", "this week", "today",
)


def _heuristic_triage(message: str, desired_move_in, has_email: bool, has_phone: bool) -> dict:
    """Rule-based fallback when no OPENAI_API_KEY is configured -- keeps
    triage working (degraded, not absent) the same way other agents in
    this codebase fall back when the LLM isn't available. Every point is
    explainable, not a black box."""
    score = 40
    reasons = []

    msg = (message or "").strip()
    if len(msg) >= 40:
        score += 15
        reasons.append("wrote a detailed message")
    elif len(msg) == 0:
        score -= 10
        reasons.append("left no message")

    if any(w in msg.lower() for w in URGENCY_WORDS):
        score += 15
        reasons.append("expressed urgency")

    if desired_move_in:
        try:
            days_out = (desired_move_in - date.today()).days
            if 0 <= days_out <= 30:
                score += 20
                reasons.append("wants to move within 30 days")
            elif days_out < 0:
                score -= 5
                reasons.append("desired move-in date has already passed")
        except TypeError:
            pass

    if has_phone:
        score += 10
        reasons.append("provided a phone number")
    if has_email:
        score += 5

    score = max(0, min(100, score))
    label = "hot" if score >= 70 else "warm" if score >= 45 else "cold"
    reasoning = ("Heuristic read: " + ", ".join(reasons) + ".") if reasons else "Heuristic read: minimal signal to go on."
    return {"label": label, "score": score, "reasoning": reasoning}


async def triage_inquiry(message: str, desired_move_in, has_email: bool, has_phone: bool) -> dict:
    """Returns {"label": "hot"|"warm"|"cold", "score": 0-100, "reasoning": str}.
    Tries the LLM first for a genuinely contextual read; falls back to the
    deterministic heuristic above on any failure or if no API key is
    configured, so this never blocks an inquiry from being saved."""
    from config import settings

    if not settings.OPENAI_API_KEY:
        return _heuristic_triage(message, desired_move_in, has_email, has_phone)

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        move_in_str = desired_move_in.isoformat() if desired_move_in else "not specified"
        prompt = (
            "A prospective tenant submitted this rental inquiry. Rate how promising a lead this is "
            "for the property manager to follow up on FIRST, based only on what's given -- not "
            "whether they'd be approved (that's a separate financial screening step you have no part in).\n\n"
            f"Message: {message or '(no message provided)'}\n"
            f"Desired move-in: {move_in_str}\n"
            f"Provided a phone number: {has_phone}\n"
            f"Provided an email: {has_email}\n\n"
            "Respond with exactly three lines, nothing else:\n"
            "LABEL: hot|warm|cold\n"
            "SCORE: <0-100 integer>\n"
            "REASON: <one short sentence, plain language, for the property manager to read>"
        )
        resp = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=120,
        )
        text = resp.choices[0].message.content or ""

        label_match = re.search(r"LABEL:\s*(hot|warm|cold)", text, re.IGNORECASE)
        score_match = re.search(r"SCORE:\s*(\d+)", text)
        reason_match = re.search(r"REASON:\s*(.+)", text)

        if not (label_match and score_match):
            raise ValueError(f"Unparseable triage response: {text!r}")

        return {
            "label": label_match.group(1).lower(),
            "score": max(0, min(100, int(score_match.group(1)))),
            "reasoning": reason_match.group(1).strip() if reason_match else "AI triage (no reasoning returned).",
        }
    except Exception as e:
        logger.warning(f"inquiry_triage_service: LLM triage failed, using heuristic fallback: {e}")
        return _heuristic_triage(message, desired_move_in, has_email, has_phone)
