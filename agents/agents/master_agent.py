"""Master Agent — intent detection and routing"""
import logging
import json
from agents.state import AgentState, Intent
from config import settings

logger = logging.getLogger(__name__)

INTENT_EXAMPLES = {
    Intent.MAINTENANCE: [
        "heater broken", "toilet overflow", "leak", "no hot water", "AC not working",
        "broken window", "mold", "pest", "roach", "plumbing", "electrical issue",
        # Spanish
        "calentador roto", "inodoro desborda", "fuga", "sin agua caliente",
        "aire acondicionado no funciona", "ventana rota", "moho", "plaga", "cucaracha",
        "plomería", "problema eléctrico",
        # French
        "chauffage cassé", "toilettes débordent", "fuite", "pas d'eau chaude",
        "climatisation ne fonctionne pas", "fenêtre cassée", "moisissure", "nuisible",
        "cafard", "plomberie", "problème électrique",
        # German
        "heizung kaputt", "toilette läuft über", "leck", "kein warmwasser",
        "klimaanlage funktioniert nicht", "fenster kaputt", "schimmel", "schädling",
        "kakerlake", "sanitär", "elektrisches problem",
        # Chinese
        "暖气坏了", "马桶溢出", "漏水", "没有热水", "空调不工作", "窗户破了", "霉菌", "害虫", "蟑螂", "水管", "电气问题",
    ],
    Intent.LEASING: [
        "apartment available", "how much is rent", "schedule tour", "apply",
        "move in", "vacancy", "when can I visit", "application",
        # Spanish
        "apartamento disponible", "cuánto es la renta", "agendar tour", "solicitar",
        "mudarme", "vacante", "cuándo puedo visitar", "solicitud",
        # French
        "appartement disponible", "combien coûte le loyer", "planifier une visite",
        "postuler", "emménager", "vacance", "quand puis-je visiter", "candidature",
        # German
        "wohnung verfügbar", "wie hoch ist die miete", "besichtigung vereinbaren",
        "bewerben", "einziehen", "leerstand", "wann kann ich besichtigen", "bewerbung",
        # Chinese
        "公寓空置", "租金是多少", "安排看房", "申请", "搬入", "空房", "什么时候可以参观",
    ],
    Intent.SCREENING: [
        "background check", "credit check", "income verification", "references",
        "rental application", "screening",
        # Spanish
        "verificación de antecedentes", "verificación de crédito", "verificación de ingresos",
        "referencias", "solicitud de alquiler",
        # French
        "vérification des antécédents", "vérification de crédit", "vérification des revenus",
        "références", "demande de location",
        # German
        "hintergrundüberprüfung", "bonitätsprüfung", "einkommensnachweis",
        "referenzen", "mietantrag",
        # Chinese
        "背景调查", "信用调查", "收入核实", "推荐信", "租房申请",
    ],
    Intent.PAYMENT: [
        "pay rent", "payment", "late fee", "rent due", "how to pay", "portal",
        # Spanish
        "pagar la renta", "pago", "cargo por retraso", "renta vencida", "cómo pagar",
        # French
        "payer le loyer", "paiement", "frais de retard", "loyer dû", "comment payer",
        # German
        "miete bezahlen", "zahlung", "verspätungsgebühr", "miete fällig", "wie bezahle ich",
        # Chinese
        "支付租金", "付款", "滞纳金", "租金到期", "如何支付",
    ],
}


def keyword_intent_detection(message: str) -> tuple[str, float]:
    """Fast keyword-based intent detection"""
    message_lower = message.lower()
    scores = {}
    
    for intent, keywords in INTENT_EXAMPLES.items():
        matches = sum(1 for kw in keywords if all(word in message_lower for word in kw.split()))
        if matches > 0:
            scores[intent] = matches / len(keywords)
    
    if not scores:
        return Intent.GENERAL, 0.5
    
    best_intent = max(scores, key=scores.get)
    return best_intent, min(scores[best_intent] * 10, 0.99)


async def detect_intent_with_ai(message: str, history: list) -> tuple[str, float]:
    """Use OpenAI to detect intent if API key is available"""
    if not settings.OPENAI_API_KEY:
        return keyword_intent_detection(message)
    
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": """You are an intent classifier for a property management AI.
Classify the user message into one of: maintenance, leasing, screening, payment, general, sales.
Respond with JSON: {"intent": "...", "confidence": 0.0-1.0, "summary": "brief description"}"""
                },
                {"role": "user", "content": message}
            ],
            max_tokens=100,
            temperature=0,
        )
        
        result = json.loads(response.choices[0].message.content)
        return result.get("intent", "general"), result.get("confidence", 0.7)
    
    except Exception as e:
        logger.warning(f"AI intent detection failed, using keyword fallback: {e}")
        return keyword_intent_detection(message)


async def master_agent_node(state: AgentState) -> AgentState:
    """Route message to appropriate specialized agent"""
    logger.info(f"MasterAgent processing: {state['message'][:50]}...")
    
    intent, confidence = await detect_intent_with_ai(state["message"], state.get("history", []))
    
    state["intent"] = intent
    state["confidence"] = confidence
    state["current_agent"] = "master"
    state["actions_taken"] = state.get("actions_taken", []) + [f"Intent detected: {intent} ({confidence:.0%})"]
    
    logger.info(f"Intent: {intent} (confidence: {confidence:.2f})")
    return state
