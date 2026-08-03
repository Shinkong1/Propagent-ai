"""Vendor Dispatch Agent — finds and notifies vendors"""
import logging
from agents.state import AgentState

logger = logging.getLogger(__name__)


async def vendor_agent_node(state: AgentState) -> AgentState:
    state["current_agent"] = "vendor"
    ticket_id = state.get("ticket_id")
    
    if ticket_id:
        logger.info(f"VendorAgent dispatching for ticket {ticket_id}")
        state["vendor_assigned"] = True
        state["actions_taken"] = state.get("actions_taken", []) + [
            "Vendor dispatch notified", "Scheduling in progress"
        ]
    
    return state
