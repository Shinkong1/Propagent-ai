"""LangGraph agent state definition"""
from typing import TypedDict, Optional, List, Any
from enum import Enum


class Intent(str, Enum):
    MAINTENANCE = "maintenance"
    LEASING = "leasing"
    SCREENING = "screening"
    PAYMENT = "payment"
    GENERAL = "general"
    SALES = "sales"
    UNKNOWN = "unknown"


class AgentState(TypedDict):
    # Input
    message: str
    tenant_id: Optional[str]
    property_id: Optional[str]
    # Which subscriber this conversation belongs to -- None means the caller
    # couldn't be matched to any org at all (unrecognized number, no inquiry
    # on file). Agents MUST treat a missing organization_id as "I don't have
    # a specific portfolio to check" rather than inventing one.
    organization_id: Optional[str]
    channel: str  # chat, voice, sms
    language: str  # en, es, fr, de, zh
    
    # Routing
    intent: Optional[str]
    confidence: float
    
    # Processing
    current_agent: Optional[str]
    ticket_id: Optional[str]
    vendor_assigned: bool
    
    # Response
    response: str
    actions_taken: List[str]
    # True while an agent is mid-intake (asking a clarifying question and
    # expecting a direct answer next turn) — callers shouldn't be told "just
    # say goodbye when you're done" while they're actively being interviewed.
    still_gathering: bool
    
    # Context
    history: List[dict]
    metadata: dict
