"""Screening Agent — tenant qualification and risk assessment"""
import logging
from agents.state import AgentState
from services.tenant_service import evaluate_screening

logger = logging.getLogger(__name__)


async def screening_agent_node(state: AgentState) -> AgentState:
    state["current_agent"] = "screening"
    state["response"] = (
        "I can help you with the rental application and screening process. "
        "To get started, I'll need: your annual income, current employment status, "
        "and consent to run a background/credit check. "
        "Would you like to proceed with the application?"
    )
    state["actions_taken"] = state.get("actions_taken", []) + ["Screening inquiry handled"]
    return state
