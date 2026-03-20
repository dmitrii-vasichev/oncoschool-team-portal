# Phase R3: Frontend — Dashboard + Settings

**Date:** 2026-03-20
**PRD:** docs/prd-reports-and-rebranding.md
**Covers:** FR-8, FR-9, FR-10, FR-12, FR-17 (P1), FR-20 (P2)
**Depends on:** Phase R2 (PR #77 merged)
**Project Board:** #14 (Oncoschool Portal)

## Task Dependency Order

```
R3.1 (Types + API client) ──┬──→ R3.2 (Hook + Sidebar)
                             │
                             ├──→ R3.3 (Reports dashboard page)
                             │         └──→ R3.7 (First-run banner + recollect)
                             │
                             ├──→ R3.4 (GetCourse credentials settings)
                             │
                             ├──→ R3.5 (Report schedule settings)
                             │
                             └──→ R3.6 (Telegram targets tabs)

R3.8 (Tests) ← all above
```

---

## R3.1 — TypeScript types + API client methods

**Description:** Add all report-related TypeScript types and API client methods to match backend schemas and endpoints.

**Files:**
- `frontend/src/lib/types.ts` — add report types
- `frontend/src/lib/api.ts` — add report API methods

**Implementation:**

**Types** (matching backend `DailyMetricResponse`, `DailyMetricWithDelta`, `ReportSummaryResponse`, etc.):
```typescript
// Reports
export interface DailyMetric {
  id: string;
  metric_date: string;
  source: string;
  users_count: number;
  payments_count: number;
  payments_sum: number;
  orders_count: number;
  orders_sum: number;
  collected_at: string;
  collected_by_id: string | null;
}

export interface DailyMetricWithDelta extends DailyMetric {
  delta_users: number | null;
  delta_payments_count: number | null;
  delta_payments_sum: number | null;
  delta_orders_count: number | null;
  delta_orders_sum: number | null;
}

export interface ReportSummary {
  days: number;
  date_from: string;
  date_to: string;
  total_users: number;
  total_payments_count: number;
  total_payments_sum: number;
  total_orders_count: number;
  total_orders_sum: number;
  avg_users_per_day: number;
  avg_payments_sum_per_day: number;
  avg_orders_sum_per_day: number;
  metrics: DailyMetric[];
}

export interface CollectResponse {
  status: "started" | "completed" | "already_exists";
  metric: DailyMetric | null;
}

export interface ReportSchedule {
  time: string;      // "HH:MM"
  timezone: string;
  enabled: boolean;
}

export interface GetCourseCredentials {
  configured: boolean;
  base_url: string | null;
  updated_at: string | null;
}
```

Also update `TelegramNotificationTarget` to include the `type` field:
```typescript
export interface TelegramNotificationTarget {
  // ... existing fields
  type: string | null;  // "meeting" | "report:getcourse"
}
```

Update `ContentSubSection` to include `"reports"`:
```typescript
export type ContentSubSection = "telegram_analysis" | "reports";
```

**API methods** (section `// ==================== Reports ====================`):
- `getReportToday()` → GET `/api/reports/getcourse/today` → `DailyMetricWithDelta`
- `getReportRange(dateFrom?, dateTo?)` → GET `/api/reports/getcourse/range` → `DailyMetric[]`
- `getReportSummary(days?)` → GET `/api/reports/getcourse/summary` → `ReportSummary`
- `collectReport(date)` → POST `/api/reports/getcourse/collect` → `CollectResponse`
- `getGetCourseCredentials()` → GET `/api/settings/getcourse-credentials` → `GetCourseCredentials`
- `updateGetCourseCredentials(data)` → PUT `/api/settings/getcourse-credentials` → `GetCourseCredentials`
- `getReportSchedule()` → GET `/api/settings/report-schedule` → `ReportSchedule`
- `updateReportSchedule(data)` → PUT `/api/settings/report-schedule` → `ReportSchedule`

**Acceptance Criteria:**
- All types match backend Pydantic schemas
- All 8 API methods defined and correctly typed
- `TelegramNotificationTarget.type` field added
- `ContentSubSection` includes `"reports"`
- `npm run build` passes

**Verification:** `cd frontend && npm run build`

---

## R3.2 — useReports hook + Sidebar navigation

**Description:** Create data-fetching hook for reports and add `/reports` to sidebar navigation with content-access gating.

**Files:**
- `frontend/src/hooks/useReports.ts` — NEW
- `frontend/src/components/layout/Sidebar.tsx` — add reports nav item
- `frontend/src/hooks/useContentAccess.ts` — extend to check `reports` sub-section

**Implementation:**

**`useReports` hook:**
- Follows existing hook pattern (useState + useCallback + useEffect)
- `useReports(days: number = 30)` — fetches summary for `days` period
- Returns `{ summary, today, loading, error, refetch }`
- Calls `api.getReportSummary(days)` + `api.getReportToday()` in parallel
- Handles 404 on `/today` gracefully (no data yet = null)

**Sidebar:**
- Add nav item for `/reports` with `FileBarChart` icon (from lucide-react), section `"analytics"` or new section `"analytics"`
- Place it after "Аналитика" in main section
- Gated by `contentAccess: true` — visible only to users with `reports` access
- Update `contentItems` filter to also check `hasAccess("reports")`

**Alternatively**, since reports use the same `contentAccess` pattern as telegram-analysis, add a new nav item:
```typescript
{
  href: "/reports",
  label: "Отчёты",
  icon: FileBarChart,
  section: "analytics",
  contentAccess: "reports",  // needs NavItem interface update
}
```

Since the current NavItem has `contentAccess?: boolean`, extend it to `contentAccess?: boolean | ContentSubSection` or add a `contentSubSection` field. Or simpler: add `reportsAccess?: boolean` flag and filter accordingly.

**`useContentAccess` update:**
- Extend to also probe `/api/reports/getcourse/today` for non-admin users to detect reports access
- Or better: admins see all, non-admins check if they have grants with `sub_section="reports"`

**Acceptance Criteria:**
- `/reports` appears in sidebar for users with reports access (and admins)
- `useReports` hook fetches summary + today's metric
- Hook handles errors and loading states
- `npm run build` passes

**Verification:** Navigate to `/reports`, see loading state, check sidebar

---

## R3.3 — Reports dashboard page

**Description:** Full reports dashboard with KPI cards, recharts line/area charts, and daily metrics table.

**Files:**
- `frontend/src/app/reports/page.tsx` — NEW: main dashboard page

**Implementation:**

**Layout:** Single page with period selector (7 / 14 / 30 days tabs) at top.

**KPI Cards row** (5 cards):
1. 👤 Новые пользователи — `users_count` + delta % badge
2. 💳 Кол-во платежей — `payments_count` + delta %
3. 💰 Сумма платежей — `payments_sum` ₽ + delta %
4. 📦 Кол-во заказов — `orders_count` + delta %
5. 🛒 Сумма заказов — `orders_sum` ₽ + delta %

Delta badges: green with ↑ for positive, red with ↓ for negative, gray → for zero. Delta values come from `/today` endpoint. Cards show yesterday's absolute value and delta vs day-before.

**Charts section** (recharts):
- **Users chart:** AreaChart with gradient fill — daily users_count for selected period
- **Payments chart:** ComposedChart — bar for payments_count, line for payments_sum
- **Orders chart:** ComposedChart — bar for orders_count, line for orders_sum
- Shared tooltip, responsive container, date on X axis
- Period selector affects all charts (7/14/30 days → re-fetch summary)

**Summary row:** 3 cards below charts:
- Avg users/day, Avg payments sum/day, Avg orders sum/day

**Daily table:**
- Columns: Дата, Пользователи, Платежи (кол-во), Платежи (сумма), Заказы (кол-во), Заказы (сумма)
- Sorted by date descending (newest first)
- Data from `summary.metrics`
- Money formatted with `toLocaleString("ru-RU")` + " ₽"

**Design approach:**
- Follow existing project aesthetic (Tailwind, shadcn/ui components)
- Card component matching analytics page `StatCard` pattern
- Charts colors from existing `CHART_*` constants pattern

**Acceptance Criteria:**
- Page renders with all 5 KPI cards
- Period selector (7/14/30) re-fetches data
- 3 recharts charts render correctly
- Daily table shows all metrics
- Responsive layout (cards wrap on mobile)
- Loading skeleton while fetching
- Error state if API fails

**Verification:** Open `/reports`, verify all sections render, switch period selector

---

## R3.4 — GetCourse credentials settings section

**Description:** Admin-only section in `/settings` page for configuring GetCourse API connection.

**Files:**
- `frontend/src/components/settings/GetCourseSection.tsx` — NEW
- `frontend/src/app/settings/page.tsx` — import and add section

**Implementation:**

**`GetCourseSection` component** (admin-only):
- Header: "GetCourse" with Database icon
- Description text: "Подключение к API GetCourse для автоматического сбора отчётов"
- Status indicator: green badge "Подключено" / yellow "Не настроено"
- Form fields:
  - **URL GetCourse** — text input, placeholder `https://yourschool.getcourse.ru`
  - **API-ключ** — password input (masked), placeholder "Вставьте API-ключ"
- Save button → calls `api.updateGetCourseCredentials({ base_url, api_key })`
- On load: fetches `api.getGetCourseCredentials()` → pre-fills base_url, shows status
- API key field is always empty (never returned from backend) — placeholder hint "Оставьте пустым, чтобы не менять" (but backend requires it — so show existing masked state or require re-entry)
- Actually, backend's PUT requires both fields. On UI: if already configured, show base_url pre-filled and api_key empty with hint. User must re-enter API key to update.

**Add to settings page:**
- Insert `{isAdmin && <GetCourseSection />}` after AIFeatureConfigSection

**Acceptance Criteria:**
- Section only visible to admin
- Shows "Подключено" / "Не настроено" status
- Form saves credentials via API
- API key never shown in plaintext
- Toast on success/error

**Verification:** Open `/settings` as admin, fill in credentials, save

---

## R3.5 — Report schedule settings section

**Description:** Admin-only section in `/settings` for configuring report collection time.

**Files:**
- `frontend/src/components/settings/ReportScheduleSection.tsx` — NEW
- `frontend/src/app/settings/page.tsx` — import and add section

**Implementation:**

**`ReportScheduleSection` component** (admin-only):
- Header: "Расписание отчётов" with Clock icon
- Description: "Время автоматического сбора данных GetCourse"
- Fields:
  - **Time picker** — reuse existing `TimePicker` component (already in shared)
  - **Timezone** — read-only display "Europe/Moscow" (not configurable in UI, hardcoded)
  - **Enabled** — Switch toggle
- Save button → calls `api.updateReportSchedule({ time, timezone, enabled })`
- On load: fetches `api.getReportSchedule()` → pre-fills time, enabled
- Show info text: "Данные собираются автоматически каждый день в указанное время"

**Add to settings page:**
- Insert `{isAdmin && <ReportScheduleSection />}` after GetCourseSection

**Acceptance Criteria:**
- Section only visible to admin
- Time picker works (HH:MM format)
- Enable/disable toggle works
- Save updates schedule via API
- Toast on success/error

**Verification:** Open `/settings`, change time, toggle enabled, save

---

## R3.6 — Telegram targets tabs (Meetings | Reports)

**Description:** Split the existing `TelegramTargetsSection` in settings into tabs: Встречи (meeting) and Отчёты (report:getcourse).

**Files:**
- `frontend/src/app/settings/page.tsx` — modify `TelegramTargetsSection`

**Implementation:**

- Add Tabs component (shadcn/ui) with 2 tabs: "Встречи" and "Отчёты"
- Each tab shows targets filtered by `type`:
  - "Встречи" → targets with `type === "meeting"` or `type === null`
  - "Отчёты" → targets with `type === "report:getcourse"`
- Create/edit dialog: add `type` select field (hidden default based on active tab)
- When creating a target from "Отчёты" tab, auto-set type to `"report:getcourse"`
- When creating from "Встречи" tab, auto-set type to `"meeting"`
- Update backend API calls to include `type` in create/update requests
- Check backend schema: ensure `TelegramTargetCreateRequest` accepts `type` field

**Backend check needed:** Verify that `POST /api/settings/telegram-targets` accepts and stores `type`. If not, add it (small backend fix within scope of this task).

**Acceptance Criteria:**
- Tabs switch between meeting and report targets
- New targets created with correct type
- Existing targets with `type=null` appear under "Встречи"
- Tab counts shown in tab labels (e.g., "Встречи (3)")

**Verification:** Open `/settings`, switch tabs, create target in each tab

---

## R3.7 — First-run banner + manual recollect button

**Description:** Show a banner on `/reports` when GetCourse is not configured, and add a manual recollect button.

**Files:**
- `frontend/src/app/reports/page.tsx` — add banner + recollect button

**Implementation:**

**First-run banner (FR-12):**
- If `getGetCourseCredentials().configured === false` → show full-width banner
- Banner text: "GetCourse не настроен. Настройте подключение в разделе Настройки."
- Link button → navigates to `/settings`
- Banner replaces the entire dashboard content (no charts/cards shown without data)
- Use Alert component (shadcn/ui) with `variant="default"` and Info icon

**Manual recollect button (FR-20):**
- Button "Обновить данные" with RefreshCw icon in the page header area
- Opens a date picker dialog (or uses yesterday's date by default)
- Calls `api.collectReport(date)` → shows loading spinner
- On success: refetch dashboard data, show toast "Данные за {date} обновлены"
- On error: show toast with error message
- Note: collection takes ~15 minutes (3 GetCourse exports). Show warning text.
- Actually for manual single-date collection it may be faster. Show "Сбор данных может занять до 15 минут" info.

**Acceptance Criteria:**
- Banner shows when GetCourse not configured, with link to settings
- Banner hides when configured
- Recollect button triggers collection and shows result
- Loading state during collection
- Appropriate toasts

**Verification:** Test with unconfigured GetCourse (see banner), then with configured (see dashboard + recollect)

---

## R3.8 — Build verification + integration check

**Description:** Verify the complete build, fix any TypeScript errors, ensure all pages render.

**Files:**
- Various — fix any issues found during build

**Implementation:**
- Run `npm run build` — fix all TypeScript/ESLint errors
- Run `npm run lint` — fix warnings
- Manual check: navigate all pages in dev mode
- Verify `/reports` renders with mock/empty data gracefully
- Verify `/settings` new sections render
- Verify sidebar shows `/reports` for authorized users
- Check mobile responsiveness on `/reports`

**Acceptance Criteria:**
- `npm run build` passes with zero errors
- `npm run lint` passes
- All existing pages still work
- New pages render correctly
- No console errors in browser

**Verification:** `cd frontend && npm run lint && npm run build`

---

## Summary

| Task | Estimated | Dependencies |
|------|-----------|--------------|
| R3.1 — Types + API client | 15 min | none |
| R3.2 — useReports hook + Sidebar | 15 min | R3.1 |
| R3.3 — Reports dashboard page | 40 min | R3.1, R3.2 |
| R3.4 — GetCourse credentials settings | 20 min | R3.1 |
| R3.5 — Report schedule settings | 15 min | R3.1 |
| R3.6 — Telegram targets tabs | 20 min | R3.1 |
| R3.7 — First-run banner + recollect | 15 min | R3.3 |
| R3.8 — Build verification | 10 min | all above |
| **Total** | **~2.5 hours** | |
