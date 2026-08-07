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

    # vendor_assigned was already set accurately by maintenance_agent_node
    # from the real ticket.vendor_notified value -- this used to
    # unconditionally overwrite it to True whenever a ticket existed,
    # regardless of whether a vendor was actually found, which logged
    # "vendor dispatch notified" in the audit trail even when no real
    # vendor matched the ticket's category.
    if ticket_id:
        if state.get("vendor_assigned"):
            logger.info(f"VendorAgent: vendor already dispatched for ticket {ticket_id}")
            state["actions_taken"] = state.get("actions_taken", []) + [
                "Vendor dispatch notified", "Scheduling in progress"
            ]
        else:
            logger.info(f"VendorAgent: no matching vendor found for ticket {ticket_id}")
            state["actions_taken"] = state.get("actions_taken", []) + [
                "No matching vendor found automatically -- needs manual assignment"
            ]

    return state
