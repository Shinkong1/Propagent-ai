"""AI Workforce Command Center — response schemas"""
from typing import List, Optional
from pydantic import BaseModel


class AgentStat(BaseModel):
    label: str
    value: str


class AgentCard(BaseModel):
    key: str
    name: str
    description: str
    icon: str
    link: str
    min_tier: Optional[str] = None  # None | "professional" | "enterprise"
    master_only: bool = False
    stats: List[AgentStat]


class AIWorkforceSummary(BaseModel):
    agents: List[AgentCard]
