# Phase R2: Scheduling + Notifications + REST API

**Date:** 2026-03-20
**PRD:** docs/prd-reports-and-rebranding.md
**Covers:** FR-4, FR-5, FR-7, FR-15, FR-16
**Depends on:** Phase R1 (PR #68 merged)

## Task Dependency Order

```
R2.1 (Pydantic schemas) ──┬──→ R2.3 (REST API endpoints)
                           │
R2.2 (ReportSchedulerService) → R2.4 (Telegram notification)
                           │
R2.5 (backfill command)  (independent, uses GetCourseService)
R2.6 (auto-cleanup job)  (independent, uses DailyMetricRepository)
R2.7 (register in main.py) ← R2.2, R2.3, R2.4
R2.8 (tests) ← all above
```

---

## R2.1 — Pydantic schemas for reports API

**Description:** Create request/response schemas for all report-related API endpoints.

**Files:**
- `app/db/schemas.py` — add report schemas

**Implementation:**
```python
class DailyMetricResponse(BaseModel):
    id: uuid.UUID
    metric_date: date
    source: str
    users_count: int
    payments_count: int
    payments_sum: Decimal
    orders_count: int
    orders_sum: Decimal
    collected_at: datetime
    collected_by_id: uuid.UUID | None = None

    class Config:
        from_attributes = True

class DailyMetricWithDelta(DailyMetricResponse):
    """Single metric with delta vs previous day."""
    delta_users: int | None = None          # absolute change
    delta_payments_count: int | None = None
    delta_payments_sum: Decimal | None = None
    delta_orders_count: int | None = None
    delta_orders_sum: Decimal | None = None

class ReportSummaryResponse(BaseModel):
    """Aggregated summary for a period."""
    days: int
    date_from: date
    date_to: date
    total_users: int
    total_payments_count: int
    total_payments_sum: Decimal
    total_orders_count: int
    total_orders_sum: Decimal
    avg_users_per_day: float
    avg_payments_sum_per_day: float
    avg_orders_sum_per_day: float
    metrics: list[DailyMetricResponse]   # daily breakdown

class CollectRequest(BaseModel):
    date: date  # target date to collect

class CollectResponse(BaseModel):
    status: str  # "started" | "completed" | "already_exists"
    metric: DailyMetricResponse | None = None

class ReportScheduleResponse(BaseModel):
    time: str           # "05:45"
    timezone: str       # "Europe/Moscow"
    enabled: bool

class ReportScheduleUpdate(BaseModel):
    time: str           # "HH:MM" format
    timezone: str = "Europe/Moscow"
    enabled: bool = True

class GetCourseCredentialsResponse(BaseModel):
    configured: bool
    base_url: str | None = None
    updated_at: datetime | None = None

class GetCourseCredentialsUpdate(BaseModel):
    base_url: str
    api_key: str        # plaintext, will be encrypted before storage
```

**Acceptance Criteria:**
- All schemas defined, importable
- DailyMetricResponse has `from_attributes = True` for ORM mapping
- CollectRequest validates date field
- No plaintext API key in response schemas

**Verification:** `python3 -c "from app.db.schemas import DailyMetricResponse, ReportSummaryResponse, CollectRequest"`

---

## R2.2 — ReportSchedulerService (APScheduler)

**Description:** Service that runs daily data collection at a configurable time. Follows existing patterns from ReminderService/MeetingSchedulerService.

**Files:**
- `app/services/report_scheduler_service.py` — NEW

**Implementation:**
- `ReportSchedulerService` class
- Constructor: `(bot: Bot, session_maker: async_sessionmaker)`
- `async def start()`:
  - Load schedule settings from `app_settings` (key: `report_schedule`)
  - Default: `{time: "05:45", timezone: "Europe/Moscow", enabled: true}`
  - Add `interval` job (every minute) → `_check_and_collect()`
  - Add `cron` job (daily at 03:00 UTC) → `_cleanup_old_metrics()` (FR-16)
- `async def stop()`: `scheduler.shutdown(wait=False)`
- `async def _check_and_collect()`:
  - Load schedule from `app_settings`
  - If not enabled → skip
  - Compare current time (in configured timezone) with schedule time
  - If match (hour + minute) and not already collected today → trigger collection
  - Call `GetCourseService().collect_metrics(session, yesterday_date)`
  - On success → send Telegram notification (FR-5, delegates to `_send_report_notification`)
  - On failure → log error, optionally notify admins
  - Track "collected today" in-memory flag to prevent duplicate runs
- `async def _send_report_notification(session, metric: DailyMetric)`:
  - Load previous day metric for delta calculation
  - Format message with 5 metrics + deltas (↑/↓ arrows)
  - Add inline button "📊 Открыть дашборд" with URL to /reports
  - Get targets via `TelegramTargetRepository.get_active_by_type("report:getcourse")`
  - Send to each target chat (with thread_id if configured)
- `async def _cleanup_old_metrics(session)`:
  - Calculate cutoff date (today - 180 days)
  - Call `DailyMetricRepository.delete_older_than(session, "getcourse", cutoff)`
  - Log count of deleted records
- `async def reschedule()` — reload settings and restart jobs (called after settings update)

**Acceptance Criteria:**
- Collects data daily at configured time
- Does not double-collect (in-memory tracking)
- Sends Telegram notification with metrics + deltas after successful collection
- Cleanup removes records older than 6 months
- Graceful on errors (logs, does not crash scheduler)

**Verification:** Unit test with mocked dependencies

---

## R2.3 — REST API endpoints for reports

**Description:** Full REST API for the reports module — today's metric, date range, summary, manual collection, credentials, and schedule settings.

**Files:**
- `app/api/reports.py` — NEW: report endpoints
- `app/api/settings.py` — MODIFY: add GetCourse credentials and schedule endpoints

**Implementation:**

**`app/api/reports.py`** (router prefix: `/api/reports/getcourse`):

```python
router = APIRouter(prefix="/reports/getcourse", tags=["reports"])

# GET /api/reports/getcourse/today
# Returns yesterday's metrics with delta vs day before
# Access: require reports viewer (ContentAccessService)

# GET /api/reports/getcourse/range?date_from=&date_to=
# Returns list of DailyMetricResponse for date range
# Default: last 30 days
# Access: require reports viewer

# GET /api/reports/getcourse/summary?days=30
# Returns ReportSummaryResponse with aggregated totals + averages + daily breakdown
# Access: require reports viewer

# POST /api/reports/getcourse/collect
# Body: CollectRequest {date: "2026-03-19"}
# Triggers manual collection for specific date
# Access: require reports viewer (report access holders can recollect)
# Returns CollectResponse with status + collected metric
```

**Access control pattern:**
- Create `require_reports_viewer` dependency using `ContentAccessService`
- Check `sub_section="reports"`, `role="viewer"` (or higher)
- Admin always has access

**`app/api/settings.py`** (add to existing file):

```python
# PUT /api/settings/getcourse-credentials
# Body: GetCourseCredentialsUpdate {base_url, api_key}
# Encrypts API key, upserts in DB
# Access: require_admin

# GET /api/settings/getcourse-credentials
# Returns: GetCourseCredentialsResponse {configured, base_url, updated_at}
# Never returns API key
# Access: require_admin

# GET /api/settings/report-schedule
# Returns: ReportScheduleResponse {time, timezone, enabled}
# Access: require_admin

# PUT /api/settings/report-schedule
# Body: ReportScheduleUpdate {time, timezone, enabled}
# Saves to app_settings, calls scheduler.reschedule()
# Access: require_admin
```

**Acceptance Criteria:**
- All 7 endpoints work (4 reports + 3 settings)
- Access control: reports endpoints require `reports` viewer; settings require admin
- GET /today returns deltas (calculated server-side)
- POST /collect runs synchronously and returns result
- Credentials API never exposes plaintext API key
- Schedule update triggers scheduler reschedule

**Verification:** `curl` or test requests to all endpoints

---

## R2.4 — Telegram notification message formatting

**Description:** Format the daily report notification message with metrics, deltas, and dashboard link button.

**Files:**
- `app/services/report_scheduler_service.py` — `_send_report_notification()` method (part of R2.2)
- `app/services/notification_service.py` — add `notify_report_collected()` method

**Implementation:**

Add `notify_report_collected(session, metric, prev_metric)` to `NotificationService`:
- Formats message:
```
📊 Отчёт GetCourse за {date}

👤 Новые пользователи: {users_count} {delta_arrow}
💳 Платежи: {payments_count} на {payments_sum}₽ {delta_arrow}
📦 Заказы: {orders_count} на {orders_sum}₽ {delta_arrow}

{delta_details_line}
```
- Delta arrows: ↑ green for positive, ↓ red for negative, → for zero
- Inline keyboard: one button "📊 Открыть дашборд" → `{FRONTEND_URL}/reports`
- Uses `TelegramTargetRepository.get_active_by_type("report:getcourse")` for targets
- Sends to each target (chat_id + optional thread_id)

**Acceptance Criteria:**
- Message contains all 5 metrics with deltas
- Dashboard link button works
- Sends to all active report targets
- Handles case when no previous metric (no deltas shown)

**Verification:** Manual test or unit test with mocked bot

---

## R2.5 — Backfill command (FR-15)

**Description:** One-time batch collection from 2026-01-01 to yesterday. Runs as an API endpoint (admin-only) and optionally as a management command.

**Files:**
- `app/api/reports.py` — add backfill endpoint

**Implementation:**

```python
# POST /api/reports/getcourse/backfill
# Body: {date_from: "2026-01-01", date_to: "2026-03-19"}
# Access: require_admin
# Runs collection sequentially for each date (to respect API rate limits)
# Returns: {total_dates: N, collected: N, skipped: N, failed: N}
```

- Iterate dates from `date_from` to `date_to`
- Skip dates where metric already exists (check via `DailyMetricRepository.get_by_date`)
- Call `GetCourseService.collect_metrics()` for each missing date
- Sleep 2 seconds between dates to avoid rate limiting
- Return summary of results
- This is a long-running operation (~80 dates × 15 min = could take hours)
  - Run in background task (`BackgroundTasks` from FastAPI)
  - Return immediately with `status: "started"`
  - Track progress in `app_settings` key `backfill_progress`

**Acceptance Criteria:**
- Backfill creates DailyMetric records for each date in range
- Skips already-collected dates
- Handles errors gracefully (continues to next date on failure)
- Returns/tracks progress

**Verification:** Test with small date range (3 days)

---

## R2.6 — Auto-cleanup job (FR-16)

**Description:** Automatic deletion of metrics older than 6 months, running daily via APScheduler.

**Files:**
- `app/services/report_scheduler_service.py` — `_cleanup_old_metrics()` (part of R2.2)

**Implementation:**
- Cron job at 03:00 UTC daily
- Calculate cutoff: `date.today() - timedelta(days=180)`
- Call `DailyMetricRepository.delete_older_than(session, "getcourse", cutoff)`
- Log: `f"Cleanup: deleted {count} metrics older than {cutoff}"`

**Acceptance Criteria:**
- Runs daily at 03:00 UTC
- Deletes only records older than 180 days
- Logs deletion count
- Does not fail if no records to delete

**Verification:** Unit test with mocked repository

---

## R2.7 — Registration in main.py

**Description:** Wire up the reports API router and ReportSchedulerService in `app/main.py`.

**Files:**
- `app/main.py` — register router + start/stop scheduler
- `app/api/router.py` — include reports router

**Implementation:**
- Import `reports_router` from `app.api.reports`
- Add to `api_router.include_router(reports_router)`
- Create `ReportSchedulerService(bot, session_maker)` in `main()`
- `await report_scheduler.start()` after reminder service start
- `report_scheduler.stop()` in `finally` block
- Pass `report_scheduler` reference to settings endpoints (for reschedule)

**Acceptance Criteria:**
- Reports API visible in `/docs`
- Scheduler starts and runs
- Clean shutdown on app exit

**Verification:** Start app, check `/docs` for new endpoints

---

## R2.8 — Tests for Phase R2

**Description:** Tests for scheduler, API endpoints, notification formatting, and backfill logic.

**Files:**
- `tests/test_reports.py` — EXTEND with R2 tests

**Implementation:**
- **Scheduler tests:**
  - `test_check_and_collect_triggers_at_configured_time` — mock time, verify collection called
  - `test_check_and_collect_skips_when_disabled` — enabled=false → no collection
  - `test_check_and_collect_no_double_run` — second call in same minute → skip
- **Notification tests:**
  - `test_format_report_message_with_deltas` — verify message format
  - `test_format_report_message_no_previous` — no deltas when first day
  - `test_notification_sends_to_report_targets` — verify target filtering
- **API tests:**
  - `test_get_today_returns_delta` — mock DB, verify delta calculation
  - `test_get_range_default_30_days` — no params → last 30 days
  - `test_summary_aggregation` — verify totals/averages
  - `test_collect_manual_trigger` — verify collection called
  - `test_credentials_never_expose_key` — GET returns configured:true, no key
- **Backfill tests:**
  - `test_backfill_skips_existing` — dates with metrics → skip
  - `test_backfill_handles_errors` — failed date → continue
- **Cleanup tests:**
  - `test_cleanup_deletes_old_records` — verify cutoff date logic

**Acceptance Criteria:**
- All tests pass
- Core logic paths covered (scheduler trigger, notification format, API responses, backfill skip, cleanup)
- No real HTTP or DB calls (all mocked)

**Verification:** `cd backend && python3 -m pytest tests/test_reports.py -v`

---

## Summary

| Task | Estimated | Dependencies |
|------|-----------|--------------|
| R2.1 — Pydantic schemas | 10 min | none |
| R2.2 — ReportSchedulerService | 30 min | R2.1 |
| R2.3 — REST API endpoints | 25 min | R2.1 |
| R2.4 — Telegram notification | 15 min | R2.2 |
| R2.5 — Backfill endpoint | 15 min | R2.3 |
| R2.6 — Auto-cleanup job | 5 min | R2.2 |
| R2.7 — Register in main.py | 10 min | R2.2, R2.3 |
| R2.8 — Tests | 25 min | all above |
| **Total** | **~2.5 hours** | |
