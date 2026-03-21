"""REST API endpoints for the reports module."""

import logging
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_admin
from app.api.deps import require_content_operator
from app.db.database import get_session
from app.db.models import ContentSubSection, TeamMember
from app.db.repositories import DailyMetricRepository
from app.db.schemas import (
    BackfillRequest,
    BackfillResponse,
    CollectRequest,
    CollectResponse,
    DailyMetricResponse,
    DailyMetricWithDelta,
    ReportSummaryResponse,
)
from app.services.getcourse_service import GetCourseService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports/getcourse", tags=["reports"])
_metrics_repo = DailyMetricRepository()
_getcourse_service = GetCourseService()

# Access dependency: reports viewer (viewer+ role via ContentAccessService)
_require_reports_viewer = require_content_operator(ContentSubSection.reports)


def _get_report_scheduler(request: Request):
    scheduler = getattr(request.app.state, "report_scheduler", None)
    if scheduler is None:
        raise HTTPException(
            status_code=503,
            detail="Report scheduler service unavailable",
        )
    return scheduler


@router.get("/today", response_model=DailyMetricWithDelta)
async def get_today(
    member: TeamMember = Depends(_require_reports_viewer),
    session: AsyncSession = Depends(get_session),
):
    """Get yesterday's metrics with delta vs day before."""
    yesterday = date.today() - timedelta(days=1)
    day_before = yesterday - timedelta(days=1)

    metric = await _metrics_repo.get_by_date(session, "getcourse", yesterday)
    if not metric:
        raise HTTPException(status_code=404, detail="No data for yesterday")

    prev = await _metrics_repo.get_by_date(session, "getcourse", day_before)

    return DailyMetricWithDelta(
        id=metric.id,
        metric_date=metric.metric_date,
        source=metric.source,
        users_count=metric.users_count,
        payments_count=metric.payments_count,
        payments_sum=metric.payments_sum,
        orders_count=metric.orders_count,
        orders_sum=metric.orders_sum,
        collected_at=metric.collected_at,
        collected_by_id=metric.collected_by_id,
        delta_users=metric.users_count - prev.users_count if prev else None,
        delta_payments_count=metric.payments_count - prev.payments_count if prev else None,
        delta_payments_sum=metric.payments_sum - prev.payments_sum if prev else None,
        delta_orders_count=metric.orders_count - prev.orders_count if prev else None,
        delta_orders_sum=metric.orders_sum - prev.orders_sum if prev else None,
    )


@router.get("/range", response_model=list[DailyMetricResponse])
async def get_range(
    date_from: date | None = None,
    date_to: date | None = None,
    member: TeamMember = Depends(_require_reports_viewer),
    session: AsyncSession = Depends(get_session),
):
    """Get metrics for a date range. Default: last 30 days."""
    if date_to is None:
        date_to = date.today() - timedelta(days=1)
    if date_from is None:
        date_from = date_to - timedelta(days=29)

    metrics = await _metrics_repo.get_range(session, "getcourse", date_from, date_to)
    return metrics


@router.get("/summary", response_model=ReportSummaryResponse)
async def get_summary(
    days: int = 30,
    member: TeamMember = Depends(_require_reports_viewer),
    session: AsyncSession = Depends(get_session),
):
    """Get aggregated summary for a period."""
    date_to = date.today() - timedelta(days=1)
    date_from = date_to - timedelta(days=days - 1)

    metrics = await _metrics_repo.get_range(session, "getcourse", date_from, date_to)

    total_users = sum(m.users_count for m in metrics)
    total_payments_count = sum(m.payments_count for m in metrics)
    total_payments_sum = sum((m.payments_sum for m in metrics), Decimal("0"))
    total_orders_count = sum(m.orders_count for m in metrics)
    total_orders_sum = sum((m.orders_sum for m in metrics), Decimal("0"))

    num_days = len(metrics) or 1

    return ReportSummaryResponse(
        days=days,
        date_from=date_from,
        date_to=date_to,
        total_users=total_users,
        total_payments_count=total_payments_count,
        total_payments_sum=total_payments_sum,
        total_orders_count=total_orders_count,
        total_orders_sum=total_orders_sum,
        avg_users_per_day=round(total_users / num_days, 1),
        avg_payments_sum_per_day=round(float(total_payments_sum) / num_days, 2),
        avg_orders_sum_per_day=round(float(total_orders_sum) / num_days, 2),
        metrics=metrics,
    )


@router.post("/collect", response_model=CollectResponse)
async def collect(
    data: CollectRequest,
    member: TeamMember = Depends(_require_reports_viewer),
    session: AsyncSession = Depends(get_session),
):
    """Manually trigger data collection for a specific date."""
    existing = await _metrics_repo.get_by_date(session, "getcourse", data.date)

    # Collect (or recollect)
    try:
        async with session.begin():
            metric = await _getcourse_service.collect_metrics(
                session, data.date, collected_by_id=member.id
            )
        status = "completed" if not existing else "completed"
        return CollectResponse(status=status, metric=DailyMetricResponse.model_validate(metric))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/backfill", response_model=BackfillResponse)
async def backfill(
    data: BackfillRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    member: TeamMember = Depends(require_admin),
):
    """Start backfill for a date range. Admin only. Runs in background."""
    if data.date_from > data.date_to:
        raise HTTPException(status_code=400, detail="date_from must be <= date_to")

    total_dates = (data.date_to - data.date_from).days + 1

    scheduler = _get_report_scheduler(request)
    background_tasks.add_task(
        scheduler.run_backfill, data.date_from, data.date_to, member.id
    )

    return BackfillResponse(status="started", total_dates=total_dates)


@router.get("/backfill/status")
async def backfill_status(
    session: AsyncSession = Depends(get_session),
    member: TeamMember = Depends(_require_reports_viewer),
):
    """Get current backfill status from app_settings."""
    from app.db.repositories import AppSettingsRepository

    repo = AppSettingsRepository()
    setting = await repo.get(session, "backfill_progress")
    if not setting or not isinstance(setting.value, dict):
        return {"status": "idle"}
    return setting.value
