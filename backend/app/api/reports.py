"""REST API endpoints for the reports module."""

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_admin
from app.api.deps import require_content_operator
from app.db.database import async_session, get_session
from app.db.models import ContentSubSection, TeamMember
from app.db.repositories import AppSettingsRepository, DailyMetricRepository
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
    pause_seconds = max(data.pause_minutes, 5) * 60
    try:
        metric = await _getcourse_service.collect_metrics(
            async_session, data.date, collected_by_id=member.id,
            pause_seconds=pause_seconds,
        )
        status = "completed"
        return CollectResponse(status=status, metric=DailyMetricResponse.model_validate(metric))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


BACKFILL_STALE_SECONDS = 300  # 5 minutes without heartbeat = stale


def _detect_stale_backfill(value: dict) -> dict:
    """If backfill is 'running' but heartbeat is stale, mark as failed."""
    if value.get("status") != "running":
        return value

    heartbeat = value.get("last_heartbeat")
    if not heartbeat:
        # No heartbeat field — legacy entry, check started_at instead
        heartbeat = value.get("started_at")
    if not heartbeat:
        return value

    try:
        hb_dt = datetime.fromisoformat(heartbeat)
        if hb_dt.tzinfo is None:
            hb_dt = hb_dt.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - hb_dt).total_seconds()
    except (ValueError, TypeError):
        return value

    if age > BACKFILL_STALE_SECONDS:
        value = {**value}
        value["status"] = "failed"
        value["error"] = (
            f"Процесс перестал отвечать (последний heartbeat {int(age)}с назад). "
            "Возможно, сервер был перезапущен. Попробуйте запустить заново."
        )
        return value

    return value


@router.post("/backfill", response_model=BackfillResponse)
async def backfill(
    data: BackfillRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Start backfill for a date range. Admin only. Runs in background."""
    if data.date_from > data.date_to:
        raise HTTPException(status_code=400, detail="date_from must be <= date_to")

    # Concurrency check: reject if another backfill is actively running
    repo = AppSettingsRepository()
    existing = await repo.get(session, "backfill_progress")
    if existing and isinstance(existing.value, dict):
        status_data = _detect_stale_backfill(existing.value)
        if status_data.get("status") == "running":
            raise HTTPException(
                status_code=409,
                detail="Загрузка уже выполняется. Дождитесь завершения или сбросьте статус.",
            )

    total_dates = (data.date_to - data.date_from).days + 1

    pause_seconds = max(data.pause_minutes, 5) * 60
    scheduler = _get_report_scheduler(request)
    background_tasks.add_task(
        scheduler.run_backfill, data.date_from, data.date_to, member.id,
        pause_seconds=pause_seconds,
    )

    return BackfillResponse(status="started", total_dates=total_dates)


@router.get("/backfill/status")
async def backfill_status(
    session: AsyncSession = Depends(get_session),
    member: TeamMember = Depends(_require_reports_viewer),
):
    """Get current backfill status from app_settings (with stale detection)."""
    repo = AppSettingsRepository()
    setting = await repo.get(session, "backfill_progress")
    if not setting or not isinstance(setting.value, dict):
        return {"status": "idle"}
    return _detect_stale_backfill(setting.value)


@router.post("/backfill/cancel")
async def backfill_cancel(
    request: Request,
    session: AsyncSession = Depends(get_session),
    member: TeamMember = Depends(require_admin),
):
    """Cancel a running backfill. Admin only.

    Two modes:
    1. In-memory cancel — if the backfill is running in this process, signal it to stop.
    2. DB fallback — if the process was restarted (or backfill started before deployment),
       reset the DB status directly to 'cancelled'.
    """
    scheduler = _get_report_scheduler(request)
    cancelled = scheduler.cancel_backfill()

    if not cancelled:
        # Fallback: reset DB status if it's "running" (orphaned backfill)
        repo = AppSettingsRepository()
        existing = await repo.get(session, "backfill_progress")
        if existing and isinstance(existing.value, dict) and existing.value.get("status") == "running":
            await repo.set(
                session,
                "backfill_progress",
                {
                    **existing.value,
                    "status": "cancelled",
                    "error": "Отменено пользователем",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            await session.commit()
            logger.info("Backfill DB-cancelled by admin %s (orphaned process)", member.id)
            return {"status": "cancelled"}

        raise HTTPException(status_code=409, detail="Нет активной загрузки для отмены")

    logger.info("Backfill cancel requested by admin %s", member.id)
    return {"status": "cancelling"}


@router.post("/backfill/reset")
async def backfill_reset(
    session: AsyncSession = Depends(get_session),
    member: TeamMember = Depends(require_admin),
):
    """Reset stuck backfill status. Admin only."""
    repo = AppSettingsRepository()
    existing = await repo.get(session, "backfill_progress")
    if not existing or not isinstance(existing.value, dict):
        return {"status": "idle"}

    prev_status = existing.value.get("status", "idle")
    await repo.set(
        session,
        "backfill_progress",
        {
            "status": "idle",
            "reset_at": datetime.now(timezone.utc).isoformat(),
            "reset_by_id": str(member.id),
            "previous_status": prev_status,
        },
    )
    await session.commit()

    logger.info("Backfill status reset by admin %s (was: %s)", member.id, prev_status)
    return {"status": "idle", "previous_status": prev_status}
