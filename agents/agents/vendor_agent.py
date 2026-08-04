"""Vendor Dispatch Agent — finds and notifies vendors"""
import logging
from agents.state import AgentState

logger = logging.getLogger(__name__)


async def vendor_agent_node(state: AgentState) -> AgentState:
    # Maintenance intake is still mid-conversation (waiting on an answer to a
    # clarifying question) — don't touch state. Overwriting current_agent to
    # "vendor" here would corrupt the pending-agent tracking that routes the
    # caller's next answer back to the maintenance agent instead of
    # misrouting it through intent classification again.
    if state.get("still_gathering"):
        return state

    state["current_agent"] = "vendor"
    ticket_id = state.get("ticket_id")
    
    if ticket_id:
        logger.info(f"VendorAgent dispatching for ticket {ticket_id}")
        state["vendor_assigned"] = True
        state["actions_taken"] = state.get("actions_taken", []) + [
            "Vendor dispatch notified", "Scheduling in progress"
        ]
    
    return state
