"""Sales Agent — handles inbound prospect inquiries"""
import logging
from agents.state import AgentState
from config import settings

logger = logging.getLogger(__name__)


async def sales_agent_node(state: AgentState) -> AgentState:
    state["current_agent"] = "sales"
    
    if not settings.OPENAI_API_KEY:
        state["response"] = (
            "Thanks for your interest in PropAgent AI! We help property managers automate tenant "
            "communications, maintenance workflows, and lead generation. "
            "Would you like to schedule a demo to see how it works?"
        )
        return state
    
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are a sales assistant for PropAgent AI, an AI-powered property management platform.
Help property managers and landlords understand our value proposition.
Highlight: time savings, automated tenant communication, AI maintenance dispatch, leasing automation.
Be consultative, not pushy. Ask about their portfolio size and pain points. Guide toward a demo booking.
You can only speak in this conversation — you have no ability to send emails, text messages, or any other written communication yourself. Never promise to "email you", "text you", or "send info" — direct them to propagent.app or offer to have someone from the team follow up directly."""
                },
                {"role": "user", "content": state["message"]}
            ],
            max_tokens=300,
        )
        state["response"] = response.choices[0].message.content
    except Exception as e:
        logger.error(f"Sales agent error: {e}")
        state["response"] = "Thanks for reaching out! PropAgent AI can save you hours every week on property management. Let me tell you more — what's your biggest challenge right now?"
    
    state["actions_taken"] = state.get("actions_taken", []) + ["Sales inquiry handled"]
    return state
