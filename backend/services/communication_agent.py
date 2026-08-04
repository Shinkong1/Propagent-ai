"""Communication Agent — templated messages across SMS, email, and in-app,
with automatic triggers for lease renewals, maintenance updates, rent
reminders, community announcements, and emergency notifications.

SMS uses the real Twilio SDK when TWILIO_SID/TOKEN/PHONE are configured; email
uses the same SMTP helper pattern already used for lead outreach. Without
credentials, a channel is not silently faked — it's logged as
'logged_only' so the send history stays honest about what actually went out.
WhatsApp and push notifications are NOT implemented — both need separate
paid integrations (WhatsApp Business API, a mobile app with push
subscriptions) that don't exist in this app.
"""
import logging
import smtplib
import socket
from datetime import date

from config import settings

logger = logging.getLogger(__name__)

TEMPLATES = {
    "lease_renewal": {
        "subject": "Your lease at {property_name} is coming up for renewal",
        "body": "Hi {tenant_name}, your lease for Unit {unit_number} at {property_name} is set to expire on {end_date}. "
                "Please reach out to discuss renewal options at your earliest convenience.",
    },
    "maintenance_update": {
        "subject": "Update on your maintenance request",
        "body": "Hi {tenant_name}, there's an update on your maintenance ticket \"{ticket_title}\" at {property_name}: "
                "status is now {ticket_status}. We'll keep you posted.",
    },
    "rent_reminder": {
        "subject": "Rent payment reminder",
        "body": "Hi {tenant_name}, this is a friendly reminder that your rent payment of ${amount} for Unit {unit_number} "
                "at {property_name} is due. Thank you!",
    },
    "community_announcement": {
        "subject": "Announcement from {property_name}",
        "body": "Hi {tenant_name}, {announcement_text}",
    },
    "emergency_notification": {
        "subject": "URGENT: Emergency notice for {property_name}",
        "body": "Hi {tenant_name}, this is an urgent notice regarding {property_name}: {emergency_text}. "
                "Please follow any posted safety instructions and contact us with questions.",
    },
    "custom": {"subject": "", "body": ""},
}


def render_template(template_type: str, context: dict) -> tuple:
    tpl = TEMPLATES.get(template_type, TEMPLATES["custom"])
    try:
        subject = tpl["subject"].format(**context)
        body = tpl["body"].format(**context)
    except KeyError as e:
        logger.warning(f"Missing template variable {e} for {template_type}, using partial fill")
        safe_context = {k: context.get(k, f"{{{k}}}") for k in context}
        subject = tpl["subject"]
        body = tpl["body"]
        for k, v in context.items():
            subject = subject.replace(f"{{{k}}}", str(v))
            body = body.replace(f"{{{k}}}", str(v))
    return subject, body


def send_sms(to_phone: str, body: str) -> tuple:
    """Returns (status, error_message). status is 'sent', 'failed', or 'logged_only'."""
    if not (settings.TWILIO_SID and settings.TWILIO_TOKEN and settings.TWILIO_PHONE):
        return "logged_only", None
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_SID, settings.TWILIO_TOKEN)
        client.messages.create(to=to_phone, from_=settings.TWILIO_PHONE, body=body)
        return "sent", None
    except Exception as e:
        logger.warning(f"SMS send failed to {to_phone}: {e}")
        return "failed", str(e)


class _SMTP_IPv4(smtplib.SMTP):
    """Some cloud hosts (Render included) advertise a working IPv6 route that
    isn't actually usable, so a plain smtplib.SMTP() connect can fail with
    'Network is unreachable' before ever reaching the SMTP handshake, even
    though outbound IPv4 works fine. Force IPv4 address resolution so the
    connection actually goes out."""

    def _get_socket(self, host, port, timeout):
        infos = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        last_err = None
        for family, socktype, proto, _canonname, sockaddr in infos:
            sock = None
            try:
                sock = socket.socket(family, socktype, proto)
                if timeout is not None:
                    sock.settimeout(timeout)
                sock.connect(sockaddr)
                return sock
            except OSError as e:
                last_err = e
                if sock is not None:
                    sock.close()
        raise last_err or OSError(f"No IPv4 address found for {host}")


def send_email(to_email: str, subject: str, body: str) -> tuple:
    if not (settings.SMTP_USER and settings.SMTP_PASSWORD):
        return "logged_only", None
    try:
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(body, "plain"))

        # timeout is critical here: this runs synchronously inside async route
        # handlers on a single-worker server, so a hung connection to the SMTP
        # host would otherwise block every other request on the process, not
        # just this one.
        with _SMTP_IPv4(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())
        return "sent", None
    except Exception as e:
        logger.warning(f"Email send failed to {to_email}: {e}")
        return "failed", str(e)
