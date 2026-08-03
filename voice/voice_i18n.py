"""Voice AI localization — Polly voice/language mapping and translated static prompts."""
import logging

logger = logging.getLogger(__name__)

VOICE_CONFIG = {
    "en": {"voice": "Polly.Joanna", "gather_language": "en-US", "name": "English"},
    "es": {"voice": "Polly.Lupe", "gather_language": "es-US", "name": "Spanish"},
    "fr": {"voice": "Polly.Lea", "gather_language": "fr-FR", "name": "French"},
    "de": {"voice": "Polly.Vicki", "gather_language": "de-DE", "name": "German"},
    "zh": {"voice": "Polly.Zhiyu", "gather_language": "cmn-CN", "name": "Chinese"},
}

PROMPTS = {
    "en": {
        "greeting": "Hello! You've reached the PropAgent AI property management assistant. Please describe your request after the tone, and press pound when finished.",
        "listening": "Go ahead, I'm listening.",
        "no_catch_retry": "I didn't catch that. Please call back and try again.",
        "no_catch_repeat": "I didn't quite catch that. Could you please repeat your request?",
        "no_input_final": "I'm still not catching anything. Please call back when you're ready. Goodbye!",
        "goodbye": "Thanks for calling PropAgent AI. Have a great day. Goodbye!",
        "anything_else": "Is there anything else I can help you with? Just say goodbye when you're done.",
        "just_say_goodbye": "Just say goodbye when you're done.",
        "trouble": "I'm having trouble processing your request right now. Please hold while I connect you to our support team, or you can text your request to this number.",
        "plan_required": "Thanks for calling. Our AI phone assistant isn't enabled on this account yet. Please contact your property manager directly, or leave a message after the tone.",
    },
    "es": {
        "greeting": "¡Hola! Se ha comunicado con el asistente de gestión de propiedades de PropAgent AI. Describa su solicitud después del tono y presione la tecla numeral al terminar.",
        "listening": "Adelante, le escucho.",
        "no_catch_retry": "No entendí eso. Por favor, vuelva a llamar e inténtelo de nuevo.",
        "no_catch_repeat": "No entendí bien eso. ¿Podría repetir su solicitud, por favor?",
        "no_input_final": "Sigo sin escuchar nada. Por favor, llame de nuevo cuando esté listo. ¡Adiós!",
        "goodbye": "Gracias por llamar a PropAgent AI. Que tenga un buen día. ¡Adiós!",
        "anything_else": "¿Hay algo más en lo que pueda ayudarle? Solo diga 'adiós' cuando termine.",
        "just_say_goodbye": "Solo diga 'adiós' cuando termine.",
        "trouble": "Estoy teniendo problemas para procesar su solicitud en este momento. Por favor espere mientras lo conectamos con nuestro equipo de soporte, o puede enviar su solicitud por mensaje de texto a este número.",
        "plan_required": "Gracias por llamar. Nuestro asistente telefónico de IA aún no está habilitado en esta cuenta. Comuníquese directamente con su administrador de propiedades, o deje un mensaje después del tono.",
    },
    "fr": {
        "greeting": "Bonjour ! Vous avez contacté l'assistant de gestion immobilière de PropAgent AI. Veuillez décrire votre demande après le bip, puis appuyez sur dièse pour terminer.",
        "listening": "Allez-y, je vous écoute.",
        "no_catch_retry": "Je n'ai pas compris. Veuillez rappeler et réessayer.",
        "no_catch_repeat": "Je n'ai pas bien compris. Pourriez-vous répéter votre demande, s'il vous plaît ?",
        "no_input_final": "Je n'entends toujours rien. Veuillez rappeler quand vous serez prêt. Au revoir !",
        "goodbye": "Merci d'avoir appelé PropAgent AI. Bonne journée. Au revoir !",
        "anything_else": "Puis-je vous aider avec autre chose ? Dites simplement au revoir quand vous avez terminé.",
        "just_say_goodbye": "Dites simplement au revoir quand vous avez terminé.",
        "trouble": "J'ai des difficultés à traiter votre demande en ce moment. Veuillez patienter pendant que nous vous mettons en relation avec notre équipe d'assistance, ou vous pouvez envoyer votre demande par SMS à ce numéro.",
        "plan_required": "Merci de votre appel. Notre assistant téléphonique IA n'est pas encore activé sur ce compte. Veuillez contacter directement votre gestionnaire immobilier, ou laisser un message après le bip.",
    },
    "de": {
        "greeting": "Hallo! Sie sind mit dem PropAgent AI Immobilienverwaltungs-Assistenten verbunden. Bitte beschreiben Sie Ihr Anliegen nach dem Ton und drücken Sie danach die Raute-Taste.",
        "listening": "Bitte sprechen Sie, ich höre zu.",
        "no_catch_retry": "Das habe ich nicht verstanden. Bitte rufen Sie erneut an.",
        "no_catch_repeat": "Das habe ich nicht ganz verstanden. Könnten Sie Ihr Anliegen bitte wiederholen?",
        "no_input_final": "Ich höre immer noch nichts. Bitte rufen Sie zurück, wenn Sie bereit sind. Auf Wiederhören!",
        "goodbye": "Danke, dass Sie PropAgent AI angerufen haben. Einen schönen Tag noch. Auf Wiederhören!",
        "anything_else": "Kann ich Ihnen noch mit etwas anderem helfen? Sagen Sie einfach Auf Wiederhören, wenn Sie fertig sind.",
        "just_say_goodbye": "Sagen Sie einfach Auf Wiederhören, wenn Sie fertig sind.",
        "trouble": "Ich habe gerade Schwierigkeiten, Ihre Anfrage zu bearbeiten. Bitte bleiben Sie dran, während wir Sie mit unserem Support-Team verbinden, oder senden Sie Ihre Anfrage per SMS an diese Nummer.",
        "plan_required": "Danke für Ihren Anruf. Unser KI-Telefonassistent ist für dieses Konto noch nicht aktiviert. Bitte wenden Sie sich direkt an Ihre Hausverwaltung oder hinterlassen Sie nach dem Ton eine Nachricht.",
    },
    "zh": {
        "greeting": "您好！这里是 PropAgent AI 物业管理助手。请在提示音后说明您的需求，完成后请按井号键。",
        "listening": "请说，我在听。",
        "no_catch_retry": "我没有听清楚。请重新致电再试一次。",
        "no_catch_repeat": "我没有听清楚。您能重复一下您的需求吗？",
        "no_input_final": "我还是没有听到任何声音。请您准备好后再回电。再见！",
        "goodbye": "感谢您致电 PropAgent AI。祝您愉快，再见！",
        "anything_else": "还有什么我可以帮您的吗？完成后请说“再见”。",
        "just_say_goodbye": "完成后请说“再见”。",
        "trouble": "我目前处理您的请求时遇到了问题。请稍候，我们将为您转接支持团队，您也可以将需求发送短信至此号码。",
        "plan_required": "感谢您的来电。此账户尚未启用我们的 AI 电话助手。请直接联系您的物业管理人员，或在提示音后留言。",
    },
}


def get_voice_config(language: str) -> dict:
    return VOICE_CONFIG.get(language, VOICE_CONFIG["en"])


def get_prompt(language: str, key: str) -> str:
    return PROMPTS.get(language, PROMPTS["en"]).get(key, PROMPTS["en"][key])


def get_org_for_phone(caller_phone: str):
    """Look up the organization that owns the calling tenant, if any.

    Returns a detached-safe plain dict (id, language, plan) rather than the ORM
    object, since the DB session closes before the caller uses the result.
    """
    if not caller_phone:
        return None
    try:
        from database.base import SessionLocal
        from models.tenant import Tenant
        from models.user import Organization

        db = SessionLocal()
        try:
            tenant = db.query(Tenant).filter(Tenant.phone == caller_phone).first()
            if tenant and tenant.organization_id:
                org = db.query(Organization).filter(Organization.id == tenant.organization_id).first()
                if org:
                    return {"id": str(org.id), "language": org.language, "plan": org.plan.value}
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Could not resolve organization for {caller_phone}: {e}")
    return None


def get_org_language(caller_phone: str) -> str:
    """Look up the calling tenant's organization language preference, defaulting to English."""
    org = get_org_for_phone(caller_phone)
    return org["language"] if org and org.get("language") else "en"
