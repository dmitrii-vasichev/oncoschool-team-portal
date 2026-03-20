# PRD: Reports Module + Portal Rebranding

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-20 |
| Status | Approved |
| Priority | P0 |

## Problem Statement
Daily GetCourse report (new users, payments, orders) currently runs via n8n — an external service not integrated into the portal. Data arrives in Telegram as plain text only: no visualization, no history, no trends. The portal already has all necessary infrastructure (Telegram bot, scheduler, UI framework) to own this workflow end-to-end.

Additionally, the portal has outgrown its original "Task Manager" name. With content analysis, meetings, broadcasts, and now reports, a rebranding to "Portal" with sidebar reorganization better reflects the product scope.

## Goals
- Automate GetCourse data collection via API, store metrics in DB, visualize on dashboard
- Send daily Telegram notification with metrics + link to dashboard
- Provide configurable collection time and manual recollection capability
- Rebrand from "Task Manager" to "Портал" across the application
- Reorganize sidebar into logical sections (Аналитика, Контент, Управление)

## Non-Goals
- Additional GetCourse metrics beyond the 5 listed
- Other report sources (finance, funnels, advertising) — future work
- Sparkline/charts in Telegram messages
- ENV-based GetCourse credentials (UI-only)
- Configurable retention period in UI (hardcoded 6 months)

## User Scenarios

### Scenario 1: Daily report consumption
**As a** moderator, **I want to** receive a Telegram message every morning with yesterday's metrics and open the dashboard for details, **so that** I can track business performance without logging into GetCourse.

### Scenario 2: Trend analysis
**As a** report viewer, **I want to** see charts with 7/14/30-day trends on the reports dashboard, **so that** I can spot patterns and anomalies in user acquisition and payments.

### Scenario 3: Manual recollection
**As a** report viewer, **I want to** trigger data recollection for a specific date, **so that** I can fix missing or incorrect data without waiting for the next scheduled run.

### Scenario 4: Initial setup
**As an** admin, **I want to** enter GetCourse credentials in settings and configure report time and Telegram recipients, **so that** reports start flowing automatically.

### Scenario 5: Access control
**As an** admin, **I want to** grant report viewing access to specific team members or departments, **so that** only authorized people see business metrics.

## Functional Requirements

### P0 (Must Have)
- [ ] FR-1: GetCourse API integration service — async export flow (request → poll → fetch) for users, payments, deals
- [ ] FR-2: `daily_metrics` table — store 5 metrics per day (users_count, payments_count, payments_sum, orders_count, orders_sum) with source field
- [ ] FR-3: `getcourse_credentials` table — single-row, encrypted API key + base URL (Fernet)
- [ ] FR-4: Scheduled data collection via APScheduler — configurable time (default 05:45 MSK), daily trigger
- [ ] FR-5: Telegram notification — formatted message with metrics + deltas (vs previous day) + inline "Открыть дашборд" button
- [ ] FR-6: Notification recipients via TelegramNotificationTarget with new `type` field (`report:getcourse`)
- [ ] FR-7: REST API — GET /today, GET /range, GET /summary, POST /collect
- [ ] FR-8: Reports dashboard (`/reports`) — KPI cards (5 metrics with delta %), charts (recharts, 7/14/30 days), daily table
- [ ] FR-9: GetCourse connection settings — URL + masked API key fields in `/settings`
- [ ] FR-10: Report schedule settings — time picker for collection time in `/settings`
- [ ] FR-11: Access control — `content_access` with sub_section `reports`, role `viewer`
- [ ] FR-12: First-run experience — banner on `/reports` when GetCourse not configured, link to settings
- [ ] FR-13: Rebranding — "Task Manager" → "Портал" across ~10 locations (sidebar, title, login, FastAPI, bot, README)
- [ ] FR-14: Sidebar reorganization — sections: Dashboard (standalone), Задачи+Встречи, Аналитика, Контент, Управление

### P1 (Should Have)
- [ ] FR-15: Initial backfill — batch collection from 2026-01-01 (~80 days, one-time)
- [ ] FR-16: Automatic cleanup — APScheduler cron job, delete metrics older than 6 months
- [ ] FR-17: Telegram targets UI — split into tabs by type (Встречи | Отчёты)
- [ ] FR-18: Section rename in access control — "Доступ к контенту" → "Доступ к разделам"
- [ ] FR-19: Role labels per sub_section — telegram_analysis: Оператор/Редактор, reports: Просмотр

### P2 (Nice to Have)
- [ ] FR-20: Manual recollect button on dashboard (viewer role)
- [ ] FR-21: Loading/progress indicators during data collection

## Non-Functional Requirements
- **Performance:** GetCourse export flow takes ~15 min (3 exports × ~5 min each). Collection must not block the main event loop.
- **Security:** API key stored encrypted (Fernet). Never exposed in plaintext via API responses.
- **Reliability:** Graceful handling of GetCourse API failures (retry with backoff, log errors, skip notification if collection fails).
- **Data integrity:** UNIQUE constraint on (source, metric_date) prevents duplicate entries.

## Technical Architecture

### Stack
- Backend: FastAPI + SQLAlchemy 2.0 async + APScheduler + httpx (GetCourse API)
- Frontend: Next.js 14 + recharts + shadcn/ui
- Encryption: Fernet (existing `app/utils/encryption.py`)
- Access control: ContentAccessService (existing, extend with `reports` sub_section)

### Chosen Approach

**GetCourse integration** follows the async export pattern:
1. Request export via API (users/payments/deals) → get export_id
2. Poll `/exports/{export_id}` until ready (~5 min per export)
3. Parse results, aggregate metrics, store in `daily_metrics`
4. Three sequential exports × ~5 min = ~15 min total collection time

**Scheduling** reuses APScheduler patterns from ReminderService/MeetingSchedulerService. Report time stored in `app_settings` (key: `report_schedule`). Scheduler checks every minute, triggers collection when time matches.

**Notification** reuses TelegramNotificationTarget with new `type` field to separate meeting vs report recipients. Same bot (BOT_TOKEN).

**Rebranding** is a text-replacement pass across ~10 files — no architectural changes.

### API Design

```
GET  /api/reports/getcourse/today            → yesterday's metrics + delta
GET  /api/reports/getcourse/range?from=&to=  → array of DailyMetric
GET  /api/reports/getcourse/summary?days=30  → aggregation + trends
POST /api/reports/getcourse/collect           → {date: "2026-03-19"} manual trigger

PUT  /api/settings/report-schedule           → {time: "05:45", timezone: "Europe/Moscow"}
GET  /api/settings/getcourse-credentials     → {configured: bool, base_url, updated_at}
PUT  /api/settings/getcourse-credentials     → {base_url, api_key} (encrypted storage)
```

Access: reports endpoints require `reports` viewer access. Settings endpoints require admin.

### Data Model

**New table: `daily_metrics`**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| metric_date | DATE | NOT NULL |
| source | VARCHAR | "getcourse", extensible |
| users_count | INTEGER | |
| payments_count | INTEGER | |
| payments_sum | NUMERIC(12,2) | |
| orders_count | INTEGER | |
| orders_sum | NUMERIC(12,2) | |
| collected_at | TIMESTAMP | When data was fetched |
| collected_by_id | UUID | NULL = automatic, FK → team_members |
| created_at | TIMESTAMP | |
| **Index** | | UNIQUE(source, metric_date) |

**New table: `getcourse_credentials`**

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | PK, default=1 (single-row) |
| base_url | VARCHAR | "https://oncoschoolru.getcourse.ru" |
| api_key_encrypted | VARCHAR | Fernet-encrypted |
| updated_at | TIMESTAMP | |
| updated_by_id | UUID | FK → team_members |

**Modified table: `telegram_notification_targets`**

| Column | Type | Notes |
|--------|------|-------|
| type | VARCHAR | NEW. "meeting" (default) / "report:getcourse". Nullable for migration, backfill existing → "meeting" |

**Modified enum: `ContentSubSection`**
- Add `reports` value

**Modified enum: `ContentRole`**
- Add `viewer` value (below operator)

## Out of Scope
- Additional GetCourse metrics beyond the 5 listed
- Other report sources (finance, funnels, advertising)
- Sparkline/charts in Telegram messages
- Granular notification targets per report type (report:getcourse:daily etc.)
- ENV-based GetCourse credentials
- Configurable retention period in UI (hardcoded 6 months)

## Acceptance Criteria
- [ ] AC-1: GetCourse credentials saved via UI, encrypted in DB, not visible in plaintext
- [ ] AC-2: Daily metrics collected automatically at configured time, stored in daily_metrics
- [ ] AC-3: Telegram notification sent to configured groups with 5 metrics + deltas
- [ ] AC-4: /reports dashboard shows KPI cards, charts (7/14/30d), and daily table
- [ ] AC-5: Manual recollection works for any past date
- [ ] AC-6: Backfill loads data from 2026-01-01 successfully
- [ ] AC-7: Auto-cleanup removes records older than 6 months
- [ ] AC-8: Access controlled via content_access (sub_section=reports, role=viewer)
- [ ] AC-9: "Портал" branding visible in sidebar, page title, login, bot /start
- [ ] AC-10: Sidebar reorganized with named sections (Аналитика, Контент, Управление)

## Risks & Open Questions
- **GetCourse API rate limits:** Export flow may take longer under load; collection time should account for delays (currently 15 min buffer before notification)
- **Export format stability:** Payment sum at column index 7, order sum at index 10 — fragile if GetCourse changes export format. Mitigation: validate column headers.
- No open questions — all decisions finalized in discovery.
