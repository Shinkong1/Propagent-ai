"""Rental contract (lease agreement) PDF generation — Professional plan and up"""
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY


def generate_lease_contract_pdf(lease, org_name: str, custom_clause: str = None) -> bytes:
    """Build a residential lease agreement PDF from real lease/tenant/property/unit data."""
    tenant = lease.tenant
    unit = lease.unit
    prop = unit.property if unit else None

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('LeaseTitle', parent=styles['Title'], fontSize=18, spaceAfter=4)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=12, spaceBefore=14, spaceAfter=6, textColor=colors.HexColor('#1E3A6E'))
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14, alignment=TA_JUSTIFY)
    disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.HexColor('#7A1F1F'))

    story = []

    story.append(Paragraph("RESIDENTIAL LEASE AGREEMENT", title_style))
    story.append(Spacer(1, 6))

    story.append(Table(
        [[Paragraph(
            "<b>This is an automatically generated template, not a legally reviewed document.</b> "
            "It is provided for informational and organizational purposes only, does not constitute legal advice, "
            "and may not satisfy the landlord-tenant law requirements of your jurisdiction. "
            "Consult a licensed attorney before relying on this document.",
            disclaimer_style
        )]],
        colWidths=[6.3 * inch],
        style=TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FDEDED')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#C0392B')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ])
    ))
    story.append(Spacer(1, 16))

    story.append(Paragraph("1. PARTIES", section_style))
    story.append(Paragraph(
        f"This Lease Agreement (\"Agreement\") is entered into between <b>{org_name}</b> (\"Landlord\") "
        f"and <b>{tenant.full_name}</b> (\"Tenant\").",
        body_style
    ))

    story.append(Paragraph("2. PROPERTY", section_style))
    address_line = f"{prop.address}, {prop.city}, {prop.state} {prop.zip_code}" if prop else "Address on file"
    unit_line = f"Unit {unit.unit_number}" if unit else "Unit on file"
    story.append(Paragraph(
        f"The Landlord agrees to rent to the Tenant the residential unit located at: "
        f"<b>{address_line}, {unit_line}</b> (the \"Premises\").",
        body_style
    ))

    story.append(Paragraph("3. LEASE TERM", section_style))
    story.append(Paragraph(
        f"The lease term begins on <b>{lease.start_date.strftime('%B %d, %Y')}</b> and ends on "
        f"<b>{lease.end_date.strftime('%B %d, %Y')}</b>, unless terminated earlier in accordance with this Agreement "
        f"or applicable law.",
        body_style
    ))

    story.append(Paragraph("4. RENT", section_style))
    story.append(Paragraph(
        f"Tenant agrees to pay Landlord monthly rent of <b>${lease.monthly_rent:,.2f}</b>, due on the 1st day of "
        f"each month. A late fee may apply if rent is not received within the grace period specified by local law "
        f"or landlord policy. Rent is payable by the method(s) designated by the Landlord.",
        body_style
    ))

    story.append(Paragraph("5. SECURITY DEPOSIT", section_style))
    deposit_text = f"${lease.security_deposit:,.2f}" if lease.security_deposit else "as agreed separately"
    story.append(Paragraph(
        f"Tenant shall pay a security deposit of <b>{deposit_text}</b> prior to occupancy. The deposit will be "
        f"held and returned in accordance with applicable landlord-tenant law, less any lawful deductions for "
        f"damage beyond normal wear and tear or unpaid amounts owed under this Agreement.",
        body_style
    ))

    story.append(Paragraph("6. USE OF PREMISES &amp; MAINTENANCE", section_style))
    story.append(Paragraph(
        "Tenant shall use the Premises solely as a private residence and shall maintain the Premises in a clean "
        "and sanitary condition. Tenant shall promptly report needed repairs to Landlord. Landlord is responsible "
        "for maintaining the Premises in habitable condition and for major repairs not caused by Tenant's neglect.",
        body_style
    ))

    story.append(Paragraph("7. UTILITIES", section_style))
    story.append(Paragraph(
        "Unless otherwise agreed in writing, Tenant is responsible for arranging and paying for all utility "
        "services to the Premises, including electricity, gas, water, and internet, except as otherwise stated.",
        body_style
    ))

    story.append(Paragraph("8. PETS", section_style))
    story.append(Paragraph(
        "No pets are permitted on the Premises without the Landlord's prior written consent, which may be subject "
        "to an additional pet deposit or monthly pet rent.",
        body_style
    ))

    story.append(Paragraph("9. RIGHT OF ENTRY", section_style))
    story.append(Paragraph(
        "Landlord may enter the Premises for inspections, repairs, or showings after providing notice in "
        "accordance with applicable law, except in the case of an emergency.",
        body_style
    ))

    story.append(Paragraph("10. TERMINATION", section_style))
    story.append(Paragraph(
        "Either party may terminate this Agreement at the end of the lease term by providing written notice as "
        "required by local law. Early termination terms, if any, must be agreed to in writing by both parties.",
        body_style
    ))

    if lease.notes:
        story.append(Paragraph("11. ADDITIONAL TERMS", section_style))
        story.append(Paragraph(lease.notes, body_style))

    if custom_clause and custom_clause.strip():
        story.append(Paragraph("12. ORGANIZATION TERMS", section_style))
        story.append(Paragraph(custom_clause.strip(), body_style))

    story.append(Spacer(1, 28))
    story.append(HRFlowable(width="100%", color=colors.HexColor('#CBD5E1')))
    story.append(Spacer(1, 20))

    sig_table = Table(
        [
            ["Landlord Signature: ______________________________", "Date: ____________________"],
            ["", ""],
            [f"Tenant Signature ({tenant.full_name}): ______________________________", "Date: ____________________"],
        ],
        colWidths=[4.3 * inch, 2 * inch],
        style=TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
        ])
    )
    story.append(sig_table)

    doc.build(story)
    return buffer.getvalue()
