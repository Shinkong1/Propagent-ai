"""Prefilled tenant notice PDF generation — real tenant/lease/property data, Professional plan and up.

Complements services/contract_service.py (full lease agreements) with the shorter
notice letters landlords send during an active tenancy: renewal, rent increase, move-out.
"""
import io
from datetime import date
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_JUSTIFY

DISCLAIMER_TEXT = (
    "<b>This is an automatically generated template, not a legally reviewed document.</b> "
    "It is provided for informational and organizational purposes only, does not constitute legal advice, "
    "and may not satisfy the notice-period or delivery requirements of your jurisdiction. "
    "Consult a licensed attorney before relying on this document."
)


def _base_doc():
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.85 * inch, bottomMargin=0.85 * inch,
        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('NoticeTitle', parent=styles['Title'], fontSize=17, spaceAfter=4)
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10.5, leading=15, alignment=TA_JUSTIFY, spaceAfter=10)
    meta_style = ParagraphStyle('Meta', parent=styles['Normal'], fontSize=10, leading=14, spaceAfter=2)
    disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.HexColor('#7A1F1F'))
    return buffer, doc, title_style, body_style, meta_style, disclaimer_style


def _disclaimer_box(disclaimer_style):
    return Table(
        [[Paragraph(DISCLAIMER_TEXT, disclaimer_style)]],
        colWidths=[5.7 * inch],
        style=TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FDEDED')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#C0392B')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ])
    )


def _address_line(prop, unit) -> str:
    if not prop:
        return "Address on file"
    line = f"{prop.address}, {prop.city}, {prop.state} {prop.zip_code}"
    if unit:
        line += f", Unit {unit.unit_number}"
    return line


def _custom_clause_block(custom_clause: str, body_style, section_style=None):
    if not custom_clause or not custom_clause.strip():
        return []
    return [
        Paragraph("ADDITIONAL TERMS", section_style) if section_style else Paragraph("<b>Additional Terms</b>", body_style),
        Paragraph(custom_clause.strip(), body_style),
    ]


def generate_lease_renewal_notice_pdf(lease, org_name: str, new_end_date: date, custom_clause: str = None) -> bytes:
    tenant = lease.tenant
    unit = lease.unit
    prop = unit.property if unit else None
    buffer, doc, title_style, body_style, meta_style, disclaimer_style = _base_doc()

    story = [
        Paragraph("LEASE RENEWAL NOTICE", title_style),
        Spacer(1, 6),
        _disclaimer_box(disclaimer_style),
        Spacer(1, 16),
        Paragraph(f"Date: {date.today().strftime('%B %d, %Y')}", meta_style),
        Paragraph(f"To: {tenant.full_name}", meta_style),
        Paragraph(f"Property: {_address_line(prop, unit)}", meta_style),
        Spacer(1, 14),
        Paragraph(f"Dear {tenant.full_name},", body_style),
        Paragraph(
            f"Your current lease, which began on <b>{lease.start_date.strftime('%B %d, %Y')}</b> and is "
            f"scheduled to end on <b>{lease.end_date.strftime('%B %d, %Y')}</b>, is eligible for renewal. "
            f"{org_name} is offering to renew your lease through <b>{new_end_date.strftime('%B %d, %Y')}</b>, "
            f"at the current monthly rent of <b>${lease.monthly_rent:,.2f}</b> unless otherwise negotiated.",
            body_style
        ),
        Paragraph(
            "Please confirm your intent to renew, or notify us of your intent to vacate, in accordance with "
            "the notice period required under your lease and applicable local law.",
            body_style
        ),
        *_custom_clause_block(custom_clause, body_style),
        Spacer(1, 24),
        HRFlowable(width="100%", color=colors.HexColor('#CBD5E1')),
        Spacer(1, 16),
        Paragraph(f"Sincerely,<br/>{org_name}", meta_style),
    ]
    doc.build(story)
    return buffer.getvalue()


def generate_rent_increase_notice_pdf(lease, org_name: str, new_rent: float, effective_date: date, custom_clause: str = None) -> bytes:
    tenant = lease.tenant
    unit = lease.unit
    prop = unit.property if unit else None
    buffer, doc, title_style, body_style, meta_style, disclaimer_style = _base_doc()

    increase_pct = ((new_rent - lease.monthly_rent) / lease.monthly_rent * 100) if lease.monthly_rent else 0

    story = [
        Paragraph("NOTICE OF RENT INCREASE", title_style),
        Spacer(1, 6),
        _disclaimer_box(disclaimer_style),
        Spacer(1, 16),
        Paragraph(f"Date: {date.today().strftime('%B %d, %Y')}", meta_style),
        Paragraph(f"To: {tenant.full_name}", meta_style),
        Paragraph(f"Property: {_address_line(prop, unit)}", meta_style),
        Spacer(1, 14),
        Paragraph(f"Dear {tenant.full_name},", body_style),
        Paragraph(
            f"This letter is to notify you that, effective <b>{effective_date.strftime('%B %d, %Y')}</b>, "
            f"your monthly rent will change from <b>${lease.monthly_rent:,.2f}</b> to "
            f"<b>${new_rent:,.2f}</b> ({increase_pct:+.1f}%).",
            body_style
        ),
        Paragraph(
            "This notice is being provided in advance of the effective date. Please confirm receipt of this "
            "notice. If you have questions about this change, contact us using the information on file.",
            body_style
        ),
        *_custom_clause_block(custom_clause, body_style),
        Spacer(1, 24),
        HRFlowable(width="100%", color=colors.HexColor('#CBD5E1')),
        Spacer(1, 16),
        Paragraph(f"Sincerely,<br/>{org_name}", meta_style),
    ]
    doc.build(story)
    return buffer.getvalue()


def generate_move_out_notice_pdf(lease, org_name: str, move_out_date: date, custom_clause: str = None) -> bytes:
    tenant = lease.tenant
    unit = lease.unit
    prop = unit.property if unit else None
    buffer, doc, title_style, body_style, meta_style, disclaimer_style = _base_doc()

    story = [
        Paragraph("NOTICE TO VACATE", title_style),
        Spacer(1, 6),
        _disclaimer_box(disclaimer_style),
        Spacer(1, 16),
        Paragraph(f"Date: {date.today().strftime('%B %d, %Y')}", meta_style),
        Paragraph(f"To: {tenant.full_name}", meta_style),
        Paragraph(f"Property: {_address_line(prop, unit)}", meta_style),
        Spacer(1, 14),
        Paragraph(f"Dear {tenant.full_name},", body_style),
        Paragraph(
            f"This letter confirms that the tenancy at the above address is scheduled to end, and the Premises "
            f"must be vacated by <b>{move_out_date.strftime('%B %d, %Y')}</b>.",
            body_style
        ),
        Paragraph(
            "Please leave the unit in clean, undamaged condition, remove all personal belongings, and return "
            "all keys and access devices by the move-out date. A move-out inspection may be scheduled prior to "
            "or on that date. Any security deposit will be returned in accordance with applicable law after "
            "deductions for damage beyond normal wear and tear or amounts owed.",
            body_style
        ),
        *_custom_clause_block(custom_clause, body_style),
        Spacer(1, 24),
        HRFlowable(width="100%", color=colors.HexColor('#CBD5E1')),
        Spacer(1, 16),
        Paragraph(f"Sincerely,<br/>{org_name}", meta_style),
    ]
    doc.build(story)
    return buffer.getvalue()
