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
    
    # Context
    history: List[dict]
    metadata: dict
