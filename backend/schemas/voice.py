"""Voice AI call history — response schemas"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class VoiceCallOut(BaseModel):
    id: UUID
    call_sid: str
    from_number: Optional[str] = None
    status: str
    duration_seconds: Optional[int] = None
    intent: Optional[str] = None
    outcome_summary: Optional[str] = None
    caller_name: Optional[str] = None
    caller_type: Optional[str] = None  # "tenant" | "prospect" | None
    property_name: Optional[str] = None
    owner_notified: bool
    started_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VoiceCallListOut(BaseModel):
    calls: list[VoiceCallOut]
    total_calls: int
    calls_this_month: int
    avg_duration_seconds: Optional[int] = None
    resolved_count: int
