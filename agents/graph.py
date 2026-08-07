"""LangGraph agent orchestration graph"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from langgraph.graph import StateGraph, END
    from agents.state import AgentState, Intent
    from agents.agents.master_agent import master_agent_node
    from agents.agents.maintenance_agent import maintenance_agent_node
    from agents.agents.leasing_agent import leasing_agent_node
    from agents.agents.screening_agent import screening_agent_node
    from agents.agents.vendor_agent import vendor_agent_node
    from agents.agents.tenant_support_agent import tenant_support_agent_node
    from agents.agents.sales_agent import sales_agent_node
    LANGGRAPH_AVAILABLE = True
except ImportError:
    logger.warning("LangGraph not installed, using simple routing fallback")
    LANGGRAPH_AVAILABLE = False


def route_to_agent(state: AgentState) -> str:
    """Router function: maps intent to agent node"""
    intent = state.get("intent", "general")
    routing = {
        Intent.MAINTENANCE: "maintenance_agent",
        Intent.LEASING: "leasing_agent",
        Intent.SCREENING: "screening_agent",
        Intent.SALES: "sales_agent",
        Intent.PAYMENT: "tenant_support",
        Intent.GENERAL: "tenant_support",
    }
    return routing.get(intent, "tenant_support")


def build_graph():
    """Build and compile the LangGraph agent workflow"""
    if not LANGGRAPH_AVAILABLE:
        return None
    
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("master", master_agent_node)
    workflow.add_node("maintenance_agent", maintenance_agent_node)
    workflow.add_node("vendor_agent", vendor_agent_node)
    workflow.add_node("leasing_agent", leasing_agent_node)
    workflow.add_node("screening_agent", screening_agent_node)
    workflow.add_node("tenant_support", tenant_support_agent_node)
    workflow.add_node("sales_agent", sales_agent_node)
    
    # Entry point
    workflow.set_entry_point("master")
    
    # Master routes to specialized agents
    workflow.add_conditional_edges("master", route_to_agent, {
        "maintenance_agent": "maintenance_agent",
        "leasing_agent": "leasing_agent",
        "screening_agent": "screening_agent",
        "tenant_support": "tenant_support",
        "sales_agent": "sales_agent",
    })
    
    # Maintenance → Vendor dispatch
    workflow.add_edge("maintenance_agent", "vendor_agent")
    workflow.add_edge("vendor_agent", END)
    
    # Other agents → END
    workflow.add_edge("leasing_agent", END)
    workflow.add_edge("screening_agent", END)
    workflow.add_edge("tenant_support", END)
    workflow.add_edge("sales_agent", END)
    
    return workflow.compile()


# Compile graph at startup
_graph = None


def get_graph():
    global _graph
    if _graph is None and LANGGRAPH_AVAILABLE:
        _graph = build_graph()
    return _graph


async def process_message(
    message: str,
    tenant_id: Optional[str] = None,
    property_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    channel: str = "chat",
    db=None,
    history: list = None,
    language: str = "en",
    forced_agent: Optional[str] = None,
) -> dict:
    """Main entry point: process a message through the agent pipeline.

    forced_agent skips intent classification entirely and continues directly
    with a specific agent — used when the previous turn left the conversation
    mid-intake (still_gathering), so a bare answer like "my name is Alex"
    isn't misrouted to the generic chat agent just because it lacks the
    original topic's keywords.
    """

    initial_state: AgentState = {
        "message": message,
        "tenant_id": tenant_id,
        "property_id": property_id,
        "organization_id": organization_id,
        "channel": channel,
        "language": language,
        "intent": None,
        "confidence": 0.0,
        "current_agent": None,
        "ticket_id": None,
        "vendor_assigned": False,
        "response": "",
        "actions_taken": [],
        "history": history or [],
        "metadata": {},
        "still_gathering": False,
    }

    if forced_agent:
        final_state = await _run_forced_agent(initial_state, forced_agent)
    else:
        graph = get_graph()

        if graph:
            try:
                final_state = await graph.ainvoke(initial_state)
            except Exception as e:
                logger.error(f"Graph execution failed: {e}")
                final_state = await _fallback_process(initial_state)
        else:
            final_state = await _fallback_process(initial_state)

    return {
        "response": final_state.get("response", "I'm here to help! How can I assist you?"),
        "intent": final_state.get("intent"),
        "ticket_id": final_state.get("ticket_id"),
        "vendor_assigned": final_state.get("vendor_assigned", False),
        "actions_taken": final_state.get("actions_taken", []),
        "agent": final_state.get("current_agent"),
        "still_gathering": final_state.get("still_gathering", False),
    }


async def _run_forced_agent(state: AgentState, agent_name: str) -> AgentState:
    """Continue directly with a specific agent, bypassing intent routing."""
    state["current_agent"] = agent_name
    if agent_name == "maintenance":
        from agents.agents.maintenance_agent import maintenance_agent_node
        from agents.agents.vendor_agent import vendor_agent_node
        state = await maintenance_agent_node(state)
        state = await vendor_agent_node(state)
    elif agent_name == "leasing":
        from agents.agents.leasing_agent import leasing_agent_node
        state = await leasing_agent_node(state)
    elif agent_name == "screening":
        from agents.agents.screening_agent import screening_agent_node
        state = await screening_agent_node(state)
    elif agent_name == "sales":
        from agents.agents.sales_agent import sales_agent_node
        state = await sales_agent_node(state)
    else:
        from agents.agents.tenant_support_agent import tenant_support_agent_node
        state = await tenant_support_agent_node(state)
    return state


async def _fallback_process(state: AgentState) -> AgentState:
    """Fallback when LangGraph is unavailable"""
    from agents.agents.master_agent import master_agent_node
    from agents.agents.maintenance_agent import maintenance_agent_node
    from agents.agents.leasing_agent import leasing_agent_node
    from agents.agents.tenant_support_agent import tenant_support_agent_node
    
    state = await master_agent_node(state)
    intent = state.get("intent", "general")
    
    if intent == "maintenance":
        state = await maintenance_agent_node(state)
    elif intent == "leasing":
        state = await leasing_agent_node(state)
    else:
        state = await tenant_support_agent_node(state)
    
    return state
