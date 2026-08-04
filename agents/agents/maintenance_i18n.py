"""Translated templates for the deterministic (non-LLM) maintenance response path."""

CATEGORY_NAMES = {
    "en": {"plumbing": "plumbing", "electrical": "electrical", "hvac": "HVAC", "appliance": "appliance",
           "structural": "structural", "pest_control": "pest control", "cleaning": "cleaning",
           "landscaping": "landscaping", "other": "maintenance"},
    "es": {"plumbing": "de plomería", "electrical": "eléctrico", "hvac": "de climatización", "appliance": "de electrodomésticos",
           "structural": "estructural", "pest_control": "de control de plagas", "cleaning": "de limpieza",
           "landscaping": "de jardinería", "other": "de mantenimiento"},
    "fr": {"plumbing": "de plomberie", "electrical": "électrique", "hvac": "de chauffage/climatisation", "appliance": "d'électroménager",
           "structural": "structurel", "pest_control": "de lutte antiparasitaire", "cleaning": "de nettoyage",
           "landscaping": "d'aménagement paysager", "other": "d'entretien"},
    "de": {"plumbing": "Sanitär-", "electrical": "Elektro-", "hvac": "Heizungs-/Klima-", "appliance": "Geräte-",
           "structural": "baulichen", "pest_control": "Schädlingsbekämpfungs-", "cleaning": "Reinigungs-",
           "landscaping": "Garten-", "other": "Wartungs-"},
    "zh": {"plumbing": "水管", "electrical": "电气", "hvac": "暖通空调", "appliance": "家电",
           "structural": "结构", "pest_control": "虫害防治", "cleaning": "清洁",
           "landscaping": "园艺", "other": "维修"},
}

TEMPLATES = {
    "en": {
        "default_title": "your issue",
        "created": "I've created a maintenance ticket for {title}.",
        "emergency": "This is being treated as an emergency. ",
        "high": "We've flagged this as high priority. ",
        "vendor_assigned": "We're assigning a qualified vendor to your request.",
        "vendor_pending": "We'll assign a qualified vendor shortly.",
        "specialist": "A {category} specialist will be dispatched to resolve this.",
        "closing": "You'll receive updates on the repair status. Is there anything else you'd like to add about the issue?",
        "callback_confirmed": "Thanks {name}, I don't have you on file as a tenant so I can't file this automatically, but I've got your callback number as {number} and noted: {summary}. Someone from the property team will follow up with you as soon as possible.",
    },
    "es": {
        "default_title": "su problema",
        "created": "He creado un ticket de mantenimiento para {title}.",
        "emergency": "Esto se está tratando como una emergencia. ",
        "high": "Lo hemos marcado como alta prioridad. ",
        "vendor_assigned": "Estamos asignando un proveedor calificado a su solicitud.",
        "vendor_pending": "Asignaremos un proveedor calificado en breve.",
        "specialist": "Se enviará un especialista {category} para resolver esto.",
        "closing": "Recibirá actualizaciones sobre el estado de la reparación. ¿Hay algo más que quiera añadir sobre el problema?",
        "callback_confirmed": "Gracias {name}, no lo tengo registrado como inquilino, así que no puedo crear un ticket automáticamente, pero anoté su número de contacto {number} y lo siguiente: {summary}. Alguien del equipo de administración se pondrá en contacto con usted lo antes posible.",
    },
    "fr": {
        "default_title": "votre problème",
        "created": "J'ai créé un ticket de maintenance pour {title}.",
        "emergency": "Ceci est traité comme une urgence. ",
        "high": "Nous avons marqué ceci comme prioritaire. ",
        "vendor_assigned": "Nous assignons un prestataire qualifié à votre demande.",
        "vendor_pending": "Nous assignerons un prestataire qualifié sous peu.",
        "specialist": "Un spécialiste {category} sera envoyé pour résoudre ce problème.",
        "closing": "Vous recevrez des mises à jour sur l'état de la réparation. Souhaitez-vous ajouter autre chose concernant le problème ?",
        "callback_confirmed": "Merci {name}, je ne vous trouve pas comme locataire donc je ne peux pas créer de ticket automatiquement, mais j'ai noté votre numéro {number} et ceci : {summary}. Quelqu'un de l'équipe de gestion vous recontactera dès que possible.",
    },
    "de": {
        "default_title": "Ihr Anliegen",
        "created": "Ich habe ein Wartungsticket für {title} erstellt.",
        "emergency": "Dies wird als Notfall behandelt. ",
        "high": "Wir haben dies als hohe Priorität markiert. ",
        "vendor_assigned": "Wir weisen Ihrer Anfrage einen qualifizierten Dienstleister zu.",
        "vendor_pending": "Wir werden in Kürze einen qualifizierten Dienstleister zuweisen.",
        "specialist": "Ein {category}spezialist wird zur Behebung entsandt.",
        "closing": "Sie erhalten Updates zum Reparaturstatus. Möchten Sie noch etwas zu dem Problem hinzufügen?",
        "callback_confirmed": "Danke {name}, ich finde Sie nicht als Mieter im System, daher kann ich kein Ticket automatisch erstellen, aber ich habe Ihre Rückrufnummer {number} und Folgendes notiert: {summary}. Jemand aus der Hausverwaltung wird sich so schnell wie möglich bei Ihnen melden.",
    },
    "zh": {
        "default_title": "您的问题",
        "created": "我已为{title}创建了维修工单。",
        "emergency": "此事正按紧急情况处理。",
        "high": "我们已将此标记为高优先级。",
        "vendor_assigned": "我们正在为您的请求分配合格的供应商。",
        "vendor_pending": "我们将尽快分配合格的供应商。",
        "specialist": "我们将派遣{category}专业人员解决此问题。",
        "closing": "您将收到维修状态的更新。关于这个问题您还有什么需要补充的吗？",
        "callback_confirmed": "谢谢{name}，我在系统中找不到您的租户记录，因此无法自动创建工单，但我已记下您的联系电话{number}以及以下内容：{summary}。物业管理团队会尽快与您联系。",
    },
}


def get_category_name(language: str, category: str) -> str:
    return CATEGORY_NAMES.get(language, CATEGORY_NAMES["en"]).get(category, category)


def get_template(language: str, key: str) -> str:
    return TEMPLATES.get(language, TEMPLATES["en"]).get(key, TEMPLATES["en"][key])
