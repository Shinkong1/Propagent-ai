"""General Tenant Support Agent"""
import logging
from agents.state import AgentState
from voice.voice_i18n import VOICE_CONFIG
from config import settings

logger = logging.getLogger(__name__)


async def tenant_support_agent_node(state: AgentState) -> AgentState:
    state["current_agent"] = "tenant_support"
    
    if not settings.OPENAI_API_KEY:
        state["response"] = (
            "Hi! I'm your property management assistant. I can help you with maintenance requests, "
            "lease questions, rent payments, and more. How can I assist you today?"
        )
        return state
    
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        language_name = VOICE_CONFIG.get(state.get("language", "en"), VOICE_CONFIG["en"])["name"]
        language_instruction = "" if language_name == "English" else f" Respond in {language_name}, regardless of the language the tenant writes in."

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a helpful property management assistant.
Assist tenants with: maintenance requests, lease information, rent payments, move-in/move-out, amenities.
Be friendly, efficient, and empathetic. If you detect a maintenance issue, offer to create a ticket.{language_instruction}"""
                },
                *[{"role": m["role"], "content": m["content"]} for m in state.get("history", [])],
                {"role": "user", "content": state["message"]}
            ],
            max_tokens=300,
        )
        state["response"] = response.choices[0].message.content
    except Exception as e:
        logger.error(f"Support agent error: {e}")
        state["response"] = "I'm here to help! Could you tell me more about what you need assistance with?"
    
    return state
