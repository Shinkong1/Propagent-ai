"""Portfolio Management Agent routes — consolidated cross-property dashboard"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from database.session import get_db
from models.user import User, PlanType
from middleware.plan_gate import require_plan
from middleware.auth import get_current_user
from services.portfolio_agent import compute_portfolio_dashboard
from services.export_service import rows_to_csv, sheets_to_excel, portfolio_dashboard_pdf

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolio", tags=["portfolio"], dependencies=[Depends(require_plan(PlanType.enterprise))])


@router.get("/dashboard")
async def portfolio_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compute_portfolio_dashboard(db, current_user.organization_id)


@router.get("/dashboard/export")
async def export_portfolio_dashboard(
    format: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if format not in ("csv", "xlsx", "pdf"):
        raise HTTPException(status_code=422, detail="format must be csv, xlsx, or pdf")

    data = compute_portfolio_dashboard(db, current_user.organization_id)
    property_rows = data["properties"]
    org_name = current_user.organization.name if current_user.organization else "Portfolio"

    if format == "csv":
        content = rows_to_csv(property_rows)
        media_type, ext = "text/csv", "csv"
    elif format == "xlsx":
        totals_rows = [{"metric": k, "value": v} for k, v in data["portfolio"].items() if k != "health_scores"]
        content = sheets_to_excel({"Properties": property_rows, "Totals": totals_rows})
        media_type, ext = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    else:
        content = portfolio_dashboard_pdf(property_rows, data["portfolio"], org_name)
        media_type, ext = "application/pdf", "pdf"

    return Response(
        content=content, media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="portfolio_dashboard.{ext}"'},
    )
