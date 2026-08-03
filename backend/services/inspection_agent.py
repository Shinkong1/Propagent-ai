"""Inspection AI Agent — photo-based damage detection and repair estimation.

Damage detection uses GPT-4o vision when OPENAI_API_KEY is configured (the
same fallback pattern the other agents in this app already use). Without a
key, photos are flagged "needs_manual_review" rather than faking a result.
Repair cost estimates are a rough rule-based lookup table, not a contractor
quote — this is surfaced in the UI, not hidden.
"""
import base64
import json
import logging
import io
from datetime import datetime

from config import settings

logger = logging.getLogger(__name__)

ISSUE_TYPES = [
    "mold", "water_damage", "broken_window", "carpet_damage",
    "wall_damage", "smoke_detector_issue", "appliance_damage", "roof_deterioration", "other",
]

# Rough per-incident repair cost estimates (USD), not a professional quote.
COST_TABLE = {
    "mold": 500,
    "water_damage": 800,
    "broken_window": 300,
    "carpet_damage": 400,
    "wall_damage": 250,
    "smoke_detector_issue": 50,
    "appliance_damage": 350,
    "roof_deterioration": 1500,
    "other": 200,
}

SEVERITY_MULTIPLIER = {"low": 0.5, "medium": 1.0, "high": 1.75}

VISION_SYSTEM_PROMPT = f"""You are a property inspection assistant analyzing a photo for physical damage or maintenance issues.
Look specifically for: mold, water damage, broken windows, carpet damage, wall damage, smoke detector issues, appliance damage, roof deterioration.
Respond with ONLY valid JSON in this exact shape, no markdown:
{{"overall_condition": "good" | "fair" | "poor", "issues": [{{"type": one of {ISSUE_TYPES}, "severity": "low" | "medium" | "high", "description": "brief plain-language description"}}]}}
If no issues are visible, return an empty issues array and overall_condition "good"."""


def _estimate_issue_cost(issue_type: str, severity: str) -> float:
    base = COST_TABLE.get(issue_type, COST_TABLE["other"])
    mult = SEVERITY_MULTIPLIER.get(severity, 1.0)
    return round(base * mult, 2)


async def analyze_photo(image_bytes: bytes, mime_type: str) -> dict:
    """Returns {overall_condition, issues: [...], confidence, analyzed}."""
    if not settings.OPENAI_API_KEY:
        return {"overall_condition": "needs_manual_review", "issues": [], "confidence": None, "analyzed": False}

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        b64 = base64.b64encode(image_bytes).decode("utf-8")

        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": VISION_SYSTEM_PROMPT},
                {"role": "user", "content": [
                    {"type": "text", "text": "Analyze this inspection photo for damage or maintenance issues."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type or 'image/jpeg'};base64,{b64}"}},
                ]},
            ],
            max_tokens=500,
            temperature=0,
        )
        result = json.loads(response.choices[0].message.content)
        issues = []
        for issue in result.get("issues", []):
            issue_type = issue.get("type") if issue.get("type") in ISSUE_TYPES else "other"
            severity = issue.get("severity", "medium")
            issues.append({
                "type": issue_type,
                "severity": severity,
                "description": issue.get("description", ""),
                "estimated_cost": _estimate_issue_cost(issue_type, severity),
            })
        return {
            "overall_condition": result.get("overall_condition", "fair"),
            "issues": issues,
            "confidence": 0.75,
            "analyzed": True,
        }
    except Exception as e:
        logger.warning(f"Vision damage analysis failed, flagging for manual review: {e}")
        return {"overall_condition": "needs_manual_review", "issues": [], "confidence": None, "analyzed": False}


def generate_inspection_report_pdf(inspection, org_name: str) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75 * inch, bottomMargin=0.75 * inch,
                             leftMargin=0.85 * inch, rightMargin=0.85 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18, spaceAfter=4)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=12, spaceBefore=14, spaceAfter=6, textColor=colors.HexColor('#1E3A6E'))
    body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14)
    disclaimer_style = ParagraphStyle('Disclaimer', parent=styles['Normal'], fontSize=8.5, leading=11, textColor=colors.HexColor('#7A1F1F'))

    story = [Paragraph("PROPERTY INSPECTION REPORT", title_style), Spacer(1, 6)]
    story.append(Table(
        [[Paragraph(
            "AI-assisted damage flags and repair estimates below are automated and approximate. "
            "They are not a substitute for a licensed contractor's assessment.",
            disclaimer_style
        )]],
        colWidths=[6.3 * inch],
        style=TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FDEDED')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#C0392B')),
            ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ])
    ))
    story.append(Spacer(1, 16))

    story.append(Paragraph("INSPECTION DETAILS", section_style))
    unit_line = f" · Unit {inspection.unit_number}" if inspection.unit_number else ""
    story.append(Paragraph(
        f"<b>Property:</b> {inspection.property_name}{unit_line}<br/>"
        f"<b>Type:</b> {inspection.inspection_type.value.replace('_', ' ').title()}<br/>"
        f"<b>Date:</b> {inspection.inspection_date.strftime('%B %d, %Y')}<br/>"
        f"<b>Inspector:</b> {inspection.inspector_name or 'Not specified'}<br/>"
        f"<b>Managed by:</b> {org_name}",
        body_style
    ))

    for photo in inspection.photos:
        story.append(Paragraph(f"AREA: {photo.room_area.upper()}", section_style))
        condition_label = (photo.overall_condition or 'unknown').replace('_', ' ').title()
        story.append(Paragraph(f"<b>Condition:</b> {condition_label}", body_style))
        if photo.issues:
            cell_style = ParagraphStyle('Cell', parent=styles['Normal'], fontSize=8.5, leading=11)
            header_style = ParagraphStyle('CellHeader', parent=cell_style, textColor=colors.white)
            rows = [[Paragraph(h, header_style) for h in ["Issue", "Severity", "Description", "Est. Cost"]]]
            for issue in photo.issues:
                rows.append([
                    Paragraph(issue.get("type", "").replace("_", " ").title(), cell_style),
                    Paragraph(issue.get("severity", "").title(), cell_style),
                    Paragraph(issue.get("description", ""), cell_style),
                    Paragraph(f"${issue.get('estimated_cost', 0):,.0f}", cell_style),
                ])
            t = Table(rows, colWidths=[1.1 * inch, 0.8 * inch, 3.2 * inch, 0.9 * inch])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A6E')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, -1), 8.5),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(Spacer(1, 6))
            story.append(t)
        else:
            story.append(Paragraph("No issues detected.", body_style))
        story.append(Spacer(1, 10))

    story.append(HRFlowable(width="100%", color=colors.HexColor('#CBD5E1')))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        f"<b>Total flagged issues:</b> {inspection.total_issues} &nbsp;&nbsp; "
        f"<b>Total estimated repair cost:</b> ${inspection.estimated_repair_cost:,.2f}",
        body_style
    ))
    if inspection.notes:
        story.append(Spacer(1, 10))
        story.append(Paragraph("NOTES", section_style))
        story.append(Paragraph(inspection.notes, body_style))

    doc.build(story)
    return buffer.getvalue()
