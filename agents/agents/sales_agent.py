"""Sales Agent — handles inbound prospect inquiries"""
import logging
from agents.state import AgentState
from config import settings

logger = logging.getLogger(__name__)

# Mirrors frontend/pages/pricing.tsx's PLANS array exactly -- this agent
# talks directly to prospective PAYING SUBSCRIBERS, so an invented price or
# feature here is a real false-advertising risk, not just an inconvenience.
# Keep these two in sync by hand; there's no shared source of truth between
# the Next.js pricing page and this Python prompt.
REAL_PLANS = """Starter -- $49/mo: 3 properties, 25 units, AI chat support, maintenance tracking, document uploads & search, rental inquiry & prospect tracking, 100 AI calls/mo, email support.
Professional -- $149/mo (most popular): 15 properties, 150 units, Voice AI call center, Executive AI Assistant, lease & notice generation, Inspection AI (photo damage detection), Compliance/Collections/Communications agents, 1,000 AI calls/mo, priority support.
Enterprise -- $499/mo: unlimited properties and units, Portfolio Dashboard, Investment Analysis, Pricing Intelligence, full AI autonomy, custom integrations (public REST API), dedicated CSM, unlimited AI calls, SLA guarantee.
All plans include a 14-day free trial, no credit card required to start."""


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
                    "content": f"""You are a sales assistant for PropAgent AI, an AI-powered property management platform.
Help property managers and landlords understand our value proposition.
Highlight: time savings, automated tenant communication, AI maintenance dispatch, leasing automation.
Be consultative, not pushy. Ask about their portfolio size and pain points. Guide toward a demo booking.

The ONLY real pricing and features you may quote -- do not invent, round, or approximate any number or capability outside this:
{REAL_PLANS}

If asked about a capability not listed above, say plainly that you're not certain and offer to have someone
from the team confirm, rather than guessing. Getting a price or feature wrong to a prospective paying
customer is a real business liability, not a minor error.

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
