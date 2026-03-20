# Phase R1: DB + Models + GetCourse Service

**Date:** 2026-03-20
**PRD:** docs/prd-reports-and-rebranding.md
**Covers:** FR-1, FR-2, FR-3, FR-6, FR-11
**Issues:** #60, #61, #62, #63, #64, #65, #66, #67
**Project Board:** #14 (Oncoschool Portal)

## Task Dependency Order

```
R1.1 (enums) → R1.2 (daily_metrics model) → R1.4 (migration)
                R1.3 (getcourse_credentials model) ↗
                R1.5 (notification targets type) ↗
R1.1 → R1.6 (GetCourseService) → R1.7 (ReportRepository) → R1.8 (tests)
```

---

## R1.1 — Extend ContentSubSection and ContentRole enums

**Description:** Add `reports` to ContentSubSection and `viewer` to ContentRole enums in models.py.

**Files:**
- `app/db/models.py` — add enum values

**Implementation:**
- `ContentSubSection`: add `reports = "reports"`
- `ContentRole`: add `viewer = "viewer"` (below operator, above editor — lowest access level)

**Acceptance Criteria:**
- Enums have new values
- Existing values unchanged
- No migration needed (enums use `native_enum=False, create_constraint=False` — stored as VARCHAR)

**Verification:** `python3 -c "from app.db.models import ContentSubSection, ContentRole; print(ContentSubSection.reports, ContentRole.viewer)"`

---

## R1.2 — Create DailyMetric model

**Description:** SQLAlchemy model for `daily_metrics` table — stores 5 metrics per day per source.

**Files:**
- `app/db/models.py` — add DailyMetric class

**Implementation:**
```python
class DailyMetric(Base):
    __tablename__ = "daily_metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="getcourse")
    users_count: Mapped[int] = mapped_column(Integer, default=0)
    payments_count: Mapped[int] = mapped_column(Integer, default=0)
    payments_sum: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    orders_count: Mapped[int] = mapped_column(Integer, default=0)
    orders_sum: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    collected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    collected_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("team_members.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("source", "metric_date", name="uq_daily_metrics_source_date"),)

    collected_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[collected_by_id])
```

**Acceptance Criteria:**
- Model matches PRD data model exactly (5 metrics, source, collected_by FK)
- UNIQUE constraint on (source, metric_date)
- collected_by_id nullable (NULL = automatic collection)

**Verification:** Model imports without error

---

## R1.3 — Create GetCourseCredentials model

**Description:** Single-row table for encrypted GetCourse API credentials.

**Files:**
- `app/db/models.py` — add GetCourseCredentials class

**Implementation:**
```python
class GetCourseCredentials(Base):
    __tablename__ = "getcourse_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    base_url: Mapped[str] = mapped_column(String(500), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(String(1000), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("team_members.id"), nullable=True)

    updated_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[updated_by_id])
```

**Acceptance Criteria:**
- Single-row pattern (id=1 default)
- API key stored encrypted (VARCHAR, not plaintext)
- FK to team_members for audit trail

**Verification:** Model imports without error

---

## R1.4 — Alembic migration for new tables

**Description:** Create migration for daily_metrics, getcourse_credentials tables.

**Files:**
- `alembic/versions/022_reports_module.py` — new migration

**Implementation:**
- `op.create_table("daily_metrics", ...)` with all columns + unique constraint
- `op.create_table("getcourse_credentials", ...)` with all columns
- Downgrade: `op.drop_table()` for both

**Acceptance Criteria:**
- `alembic upgrade head` succeeds
- Both tables exist in DB
- UNIQUE constraint on daily_metrics(source, metric_date) works
- Downgrade drops both tables cleanly

**Verification:** `cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

---

## R1.5 — Add type column to telegram_notification_targets

**Description:** Add `type` VARCHAR column to distinguish meeting vs report notification targets.

**Files:**
- `app/db/models.py` — add `type` field to TelegramNotificationTarget
- `alembic/versions/022_reports_module.py` — include in same migration (or separate 023)
- `app/db/schemas.py` — add `type` to TelegramTargetCreate and TelegramTargetResponse
- `app/db/repositories.py` — add `get_active_by_type()` method

**Implementation:**
- Model: `type: Mapped[str | None] = mapped_column(String(50), nullable=True, default="meeting")`
- Migration: `op.add_column(...)` + `UPDATE SET type='meeting' WHERE type IS NULL`
- Schema: add `type: str | None = "meeting"` to Create, `type: str | None` to Response
- Repository: `async def get_active_by_type(session, target_type: str) -> list[TelegramNotificationTarget]`

**Acceptance Criteria:**
- Existing targets get `type='meeting'` via backfill
- New targets default to "meeting"
- Can filter by type in repository
- API schemas include type field

**Verification:** Migration applies, existing targets have type="meeting"

---

## R1.6 — GetCourseService: async export flow

**Description:** Core service for GetCourse API integration — request export, poll until ready, fetch and aggregate results.

**Files:**
- `app/services/getcourse_service.py` — NEW

**Implementation:**
- `GetCourseService` class
- Constructor: no args (loads credentials from DB at runtime)
- Methods:
  - `async def _get_credentials(session) -> GetCourseCredentials | None`
  - `async def _request_export(base_url, api_key, export_type, date_from, date_to) -> int` — returns export_id
  - `async def _poll_export(base_url, api_key, export_id, timeout=600) -> list[dict]` — poll with backoff, return rows
  - `async def _count_users(rows) -> int` — count unique users registered on target date
  - `async def _sum_payments(rows) -> tuple[int, Decimal]` — count + sum for payments
  - `async def _sum_orders(rows) -> tuple[int, Decimal]` — count + sum for deals/orders
  - `async def collect_metrics(session, target_date, collected_by=None) -> DailyMetric` — orchestrate 3 exports, aggregate, upsert into daily_metrics
- HTTP client: `httpx.AsyncClient` (reuse project pattern from ZoomService)
- Error handling: retry with exponential backoff (3 attempts per export), log failures
- GetCourse API:
  - POST `{base_url}/pl/api/account/users` with params `{key, exported_at[from], exported_at[to]}` — user export
  - POST `{base_url}/pl/api/account/payments` — payment export
  - POST `{base_url}/pl/api/account/deals` — deals/orders export
  - Response: `{success: true, info: {export_id: 123}}`
  - GET `{base_url}/pl/api/account/exports/{export_id}` — poll status
  - Response when ready: `{success: true, info: {status: "exported", items: [...]}}`

**Acceptance Criteria:**
- Service handles full export flow (request → poll → aggregate)
- Graceful error handling (API failures, timeouts)
- Uses existing encryption utility for API key decryption
- Upserts daily_metrics (update if exists for same source+date)
- Does not block event loop (all async)

**Verification:** Unit test with mocked httpx responses

---

## R1.7 — ReportRepository

**Description:** Repository for daily_metrics and getcourse_credentials CRUD.

**Files:**
- `app/db/repositories.py` — add DailyMetricRepository, GetCourseCredentialsRepository

**Implementation:**

**DailyMetricRepository:**
- `async def get_by_date(session, source, metric_date) -> DailyMetric | None`
- `async def get_range(session, source, date_from, date_to) -> list[DailyMetric]`
- `async def get_latest(session, source) -> DailyMetric | None`
- `async def upsert(session, source, metric_date, **metrics) -> DailyMetric` — insert or update
- `async def delete_older_than(session, source, before_date) -> int` — cleanup, return count

**GetCourseCredentialsRepository:**
- `async def get(session) -> GetCourseCredentials | None` — get single row (id=1)
- `async def upsert(session, base_url, api_key_encrypted, updated_by_id) -> GetCourseCredentials`

**Acceptance Criteria:**
- Follows existing repository patterns (instance methods, session as first param, flush not commit)
- Upsert handles both insert and update for daily_metrics
- Range query orders by metric_date ASC

**Verification:** Import without error, unit tests

---

## R1.8 — Tests for Phase R1

**Description:** Basic tests for models, repository, and GetCourseService.

**Files:**
- `tests/test_reports.py` — NEW

**Implementation:**
- Test DailyMetric model creation and unique constraint
- Test GetCourseCredentials single-row upsert
- Test GetCourseService._count_users / _sum_payments / _sum_orders (pure logic, no HTTP)
- Test GetCourseService.collect_metrics with mocked httpx (mock export flow)
- Test TelegramNotificationTarget type field default and filtering
- Test ContentSubSection.reports and ContentRole.viewer enum values

**Acceptance Criteria:**
- All tests pass
- Core service logic covered (aggregation functions)
- HTTP calls mocked (no real API calls)

**Verification:** `cd backend && python3 -m pytest tests/test_reports.py -v`

---

## Summary

| Task | Estimated | Dependencies |
|------|-----------|--------------|
| R1.1 — Extend enums | 5 min | none |
| R1.2 — DailyMetric model | 10 min | R1.1 |
| R1.3 — GetCourseCredentials model | 10 min | none |
| R1.4 — Alembic migration | 15 min | R1.2, R1.3 |
| R1.5 — Notification targets type | 15 min | R1.4 |
| R1.6 — GetCourseService | 30 min | R1.2, R1.3 |
| R1.7 — ReportRepository | 15 min | R1.2, R1.3 |
| R1.8 — Tests | 20 min | R1.6, R1.7 |
| **Total** | **~2 hours** | |
