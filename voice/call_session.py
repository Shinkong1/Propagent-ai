"""Per-call conversation state, stored in Redis keyed by Twilio CallSid.

A phone call is a sequence of independent HTTP requests to /voice/gather —
nothing survives between them unless we persist it ourselves.
"""
import json
import logging
from config import settings

logger = logging.getLogger(__name__)

CALL_SESSION_TTL = 3600  # calls don't last an hour; this just bounds abandoned-call memory
NO_INPUT_HANGUP_THRESHOLD = 2

_client = None


def _get_client():
    global _client
    if _client is None:
        import redis
        _client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
    return _client


def get_history(call_sid: str) -> list:
    try:
        raw = _get_client().get(f"voice:history:{call_sid}")
        return json.loads(raw) if raw else []
    except Exception as e:
        logger.warning(f"Call history unavailable for {call_sid}: {e}")
        return []


def append_turns(call_sid: str, turns: list) -> None:
    """turns: list of {"role": "user"|"assistant", "content": str}"""
    try:
        history = get_history(call_sid)
        history.extend(turns)
        _get_client().setex(f"voice:history:{call_sid}", CALL_SESSION_TTL, json.dumps(history))
    except Exception as e:
        logger.warning(f"Failed to save call history for {call_sid}: {e}")


def bump_no_input_count(call_sid: str) -> int:
    try:
        client = _get_client()
        key = f"voice:noinput:{call_sid}"
        count = client.incr(key)
        client.expire(key, CALL_SESSION_TTL)
        return count
    except Exception as e:
        logger.warning(f"No-input counter unavailable for {call_sid}: {e}")
        return 1


def reset_no_input_count(call_sid: str) -> None:
    try:
        _get_client().delete(f"voice:noinput:{call_sid}")
    except Exception as e:
        logger.warning(f"Failed to reset no-input counter for {call_sid}: {e}")


def get_pending_agent(call_sid: str) -> "str | None":
    """Which agent (if any) is mid-intake and expecting a direct answer to
    its last question — set when a turn leaves still_gathering=True, so the
    next turn skips intent classification and goes straight back to it."""
    try:
        return _get_client().get(f"voice:pending_agent:{call_sid}")
    except Exception as e:
        logger.warning(f"Pending agent lookup unavailable for {call_sid}: {e}")
        return None


def set_pending_agent(call_sid: str, agent: "str | None") -> None:
    try:
        client = _get_client()
        key = f"voice:pending_agent:{call_sid}"
        if agent:
            client.setex(key, CALL_SESSION_TTL, agent)
        else:
            client.delete(key)
    except Exception as e:
        logger.warning(f"Failed to update pending agent for {call_sid}: {e}")


def clear_session(call_sid: str) -> None:
    try:
        client = _get_client()
        client.delete(f"voice:history:{call_sid}")
        client.delete(f"voice:noinput:{call_sid}")
        client.delete(f"voice:pending_agent:{call_sid}")
    except Exception as e:
        logger.warning(f"Failed to clear call session for {call_sid}: {e}")
