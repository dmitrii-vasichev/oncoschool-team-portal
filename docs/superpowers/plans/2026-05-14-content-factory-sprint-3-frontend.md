# Content Factory Sprint 3 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Content Factory frontend slice: access guard, navigation, dashboard, and calendar backed by the existing Sprint 1/2 API plus one publication-list bridge endpoint.

**Architecture:** The backend remains the source of truth for permissions and Content Factory records. Sprint 3 adds a small backend bridge for frontend-friendly publication queries, then adds typed frontend API methods, route protection, derived dashboard/calendar helpers, and two portal pages under `/content-factory`.

**Tech Stack:** FastAPI, SQLAlchemy async services, Pydantic schemas, pytest, Next.js App Router, React, TypeScript, Tailwind, lucide-react, Node test runner.

---

## File Structure

Backend:

- Modify `backend/app/api/auth.py` to include `has_content_factory_access` in `/api/auth/me`.
- Modify `backend/app/services/content_factory/publication_service.py` to add a filtered cross-bundle list method.
- Modify `backend/app/api/content_factory/publications.py` to expose `GET /api/content-factory/publications`.
- Modify `backend/tests/test_content_factory_publications_api.py` to cover the new list endpoint.
- Create `backend/tests/test_auth_me_content_factory.py` for the `/api/auth/me` access flag.

Frontend:

- Modify `frontend/src/lib/types.ts` with Content Factory enums, models, request types, and `TeamMember.has_content_factory_access`.
- Modify `frontend/src/lib/api.ts` with Content Factory API methods.
- Modify `frontend/src/lib/permissions.ts` with `canAccessContentFactory`.
- Create `frontend/src/lib/contentFactoryUtils.ts` for labels, grouping, and dashboard/calendar derivations.
- Create `frontend/src/lib/contentFactoryUtils.test.ts` for pure helper behavior.
- Create `frontend/src/components/content-factory/ContentFactoryGuard.tsx`.
- Create `frontend/src/components/content-factory/ContentFactoryStatusBadge.tsx`.
- Create `frontend/src/components/content-factory/ContentFactoryFilters.tsx`.
- Create `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`.
- Modify `frontend/src/components/layout/Sidebar.tsx` and `frontend/src/components/layout/Header.tsx`.
- Create `frontend/src/app/content-factory/layout.tsx`.
- Create `frontend/src/app/content-factory/dashboard/page.tsx`.
- Create `frontend/src/app/content-factory/calendar/page.tsx`.

Docs:

- Update `docs/PLAN.md`, `docs/STATUS.md`, and `docs/TEST_PLAN.md` after implementation.

---

## Task 1: Backend Bridge And Current User Contract

**Files:**

- Modify: `backend/app/api/auth.py`
- Modify: `backend/app/services/content_factory/publication_service.py`
- Modify: `backend/app/api/content_factory/publications.py`
- Test: `backend/tests/test_auth_me_content_factory.py`
- Test: `backend/tests/test_content_factory_publications_api.py`

- [x] **Step 1: Write a failing `/api/auth/me` contract test**

Create `backend/tests/test_auth_me_content_factory.py`:

```python
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.api.auth import get_me


@pytest.mark.asyncio
async def test_get_me_includes_content_factory_access_flag():
    member = SimpleNamespace(
        id=uuid.uuid4(),
        telegram_id=123,
        telegram_username="cf_user",
        full_name="CF User",
        name_variants=[],
        role="member",
        is_test=False,
        is_active=True,
        has_content_factory_access=True,
        position=None,
        department_id=None,
        extra_department_ids=[],
        avatar_url=None,
        email=None,
        birthday=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    result = await get_me(member=member)

    assert result["has_content_factory_access"] is True
```

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_auth_me_content_factory.py -q
```

Expected: fail because `has_content_factory_access` is missing.

- [x] **Step 2: Implement `/api/auth/me` flag**

In `backend/app/api/auth.py`, add:

```python
"has_content_factory_access": member.has_content_factory_access,
```

near the existing `is_active` and role fields.

- [x] **Step 3: Verify `/api/auth/me` contract**

Run the same command.

Expected: pass.

- [x] **Step 4: Write failing publication list endpoint test**

Append to `backend/tests/test_content_factory_publications_api.py`:

```python
@pytest.mark.asyncio
async def test_list_publications_passes_filters(monkeypatch):
    bundle_id = uuid.uuid4()
    platform_id = uuid.uuid4()
    responsible_id = uuid.uuid4()
    pubs = [make_pub(bundle_id=bundle_id, platform_id=platform_id, responsible_id=responsible_id)]
    monkeypatch.setattr(
        pubs_api.publication_service,
        "list",
        AsyncMock(return_value=pubs),
    )

    result = await pubs_api.list_publications(
        member=cf_member(),
        session=AsyncMock(),
        bundle_id=bundle_id,
        status="scheduled",
        platform_id=platform_id,
        format_id=None,
        responsible_id=responsible_id,
        scheduled_from=None,
        scheduled_to=None,
        limit=100,
        offset=0,
    )

    assert result == pubs
    pubs_api.publication_service.list.assert_awaited_once()
```

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_content_factory_publications_api.py::test_list_publications_passes_filters -q
```

Expected: fail because `list_publications` does not exist yet.

- [x] **Step 5: Implement service and endpoint**

In `backend/app/services/content_factory/publication_service.py`, add a `list` method using optional filters:

```python
@staticmethod
async def list(
    session: AsyncSession,
    *,
    bundle_id: uuid.UUID | None = None,
    status: str | None = None,
    platform_id: uuid.UUID | None = None,
    format_id: uuid.UUID | None = None,
    responsible_id: uuid.UUID | None = None,
    scheduled_from: datetime | None = None,
    scheduled_to: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[CFPublication]:
    stmt = select(CFPublication)
    if bundle_id:
        stmt = stmt.where(CFPublication.bundle_id == bundle_id)
    if status:
        stmt = stmt.where(CFPublication.status == status)
    if platform_id:
        stmt = stmt.where(CFPublication.platform_id == platform_id)
    if format_id:
        stmt = stmt.where(CFPublication.format_id == format_id)
    if responsible_id:
        stmt = stmt.where(CFPublication.responsible_id == responsible_id)
    if scheduled_from:
        stmt = stmt.where(CFPublication.scheduled_at >= scheduled_from)
    if scheduled_to:
        stmt = stmt.where(CFPublication.scheduled_at <= scheduled_to)
    stmt = stmt.order_by(CFPublication.scheduled_at.asc().nullslast(), CFPublication.created_at.desc())
    stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    return list(result.scalars().all())
```

Import `datetime` from `datetime` in that service file.

In `backend/app/api/content_factory/publications.py`, add:

```python
@pubs_router.get("", response_model=list[CFPublicationResponse])
async def list_publications(
    member: TeamMember = Depends(require_cf_access),
    session: AsyncSession = Depends(get_session),
    bundle_id: uuid.UUID | None = None,
    status: str | None = None,
    platform_id: uuid.UUID | None = None,
    format_id: uuid.UUID | None = None,
    responsible_id: uuid.UUID | None = None,
    scheduled_from: datetime | None = None,
    scheduled_to: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return await publication_service.list(
        session,
        bundle_id=bundle_id,
        status=status,
        platform_id=platform_id,
        format_id=format_id,
        responsible_id=responsible_id,
        scheduled_from=scheduled_from,
        scheduled_to=scheduled_to,
        limit=limit,
        offset=offset,
    )
```

Import `datetime` and `Query`.

- [x] **Step 6: Verify backend bridge**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_auth_me_content_factory.py tests/test_content_factory_publications_api.py -q
```

Expected: pass.

---

## Task 2: Frontend Types, API, And Pure Helpers

**Files:**

- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/permissions.ts`
- Create: `frontend/src/lib/contentFactoryUtils.ts`
- Test: `frontend/src/lib/contentFactoryUtils.test.ts`

- [x] **Step 1: Write failing helper tests**

Create `frontend/src/lib/contentFactoryUtils.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  CF_BUNDLE_STATUS_LABELS,
  CF_PUBLICATION_STATUS_LABELS,
  canAccessContentFactory,
  groupPublicationsByDate,
  summarizeContentFactoryDashboard,
} from "./contentFactoryUtils.ts";

test("content factory labels expose production wording", () => {
  assert.equal(CF_BUNDLE_STATUS_LABELS.production, "В производстве");
  assert.equal(CF_PUBLICATION_STATUS_LABELS.doctor_review, "Проверка врача");
});

test("content factory access allows admins and flagged active members", () => {
  assert.equal(canAccessContentFactory({ role: "admin", is_active: true }), true);
  assert.equal(
    canAccessContentFactory({
      role: "member",
      is_active: true,
      has_content_factory_access: true,
    }),
    true,
  );
  assert.equal(
    canAccessContentFactory({
      role: "member",
      is_active: true,
      has_content_factory_access: false,
    }),
    false,
  );
});

test("groupPublicationsByDate keeps unscheduled items separate", () => {
  const groups = groupPublicationsByDate([
    { id: "1", scheduled_at: "2026-05-20T10:00:00Z" },
    { id: "2", scheduled_at: null },
  ]);

  assert.equal(groups[0].dateKey, "2026-05-20");
  assert.equal(groups[1].dateKey, "unscheduled");
});

test("dashboard summary counts scheduled upcoming and overdue production items", () => {
  const summary = summarizeContentFactoryDashboard({
    now: new Date("2026-05-14T12:00:00Z"),
    bundles: [
      { id: "b1", status: "planning" },
      { id: "b2", status: "production" },
    ],
    publications: [
      { id: "p1", status: "scheduled", scheduled_at: "2026-05-15T12:00:00Z" },
      { id: "p2", status: "needs_design", scheduled_at: "2026-05-13T12:00:00Z" },
      { id: "p3", status: "published", scheduled_at: "2026-05-12T12:00:00Z" },
    ],
  });

  assert.equal(summary.bundleStatusCounts.planning, 1);
  assert.equal(summary.upcomingPublications.length, 1);
  assert.equal(summary.overdueProductionItems.length, 1);
  assert.equal(summary.recentlyPublished.length, 1);
});
```

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail because the helper module does not exist.

- [x] **Step 2: Add Content Factory types and helpers**

In `frontend/src/lib/types.ts`, add Content Factory enum types and interfaces matching backend schemas. Include `has_content_factory_access: boolean` on `TeamMember`.

Create `frontend/src/lib/contentFactoryUtils.ts` with:

- `CF_BUNDLE_STATUS_LABELS`
- `CF_PUBLICATION_STATUS_LABELS`
- `CF_PRODUCT_STREAM_LABELS`
- `canAccessContentFactory`
- `groupPublicationsByDate`
- `summarizeContentFactoryDashboard`
- small filter helpers for status/platform/format/responsible/bundle

- [x] **Step 3: Add API methods**

In `frontend/src/lib/api.ts`, import the new types and add methods:

- `getCFPlatforms`
- `getCFFormats`
- `getCFRubrics`
- `getCFNosologies`
- `getCFFunnelTemplates`
- `getCFBundles`
- `createCFBundle`
- `updateCFBundle`
- `getCFPublications`
- `getCFPublicationsForBundle`
- `getCFPublication`
- `updateCFPublication`
- `getCFSegments`
- `getCFMetrics`
- `getCFRetros`

Keep Sprint 3 pages read-mostly: only include create/update methods needed by existing backend contracts, but do not expose full editing UI yet.

- [x] **Step 4: Wire frontend permission service**

In `frontend/src/lib/permissions.ts`, add:

```ts
static canAccessContentFactory(member: TeamMember): boolean {
  if (!member.is_active) return false;
  return PermissionService.isAdmin(member) || member.has_content_factory_access;
}
```

- [x] **Step 5: Verify helpers**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: pass.

---

## Task 3: Route Guard, Navigation, And Source Guards

**Files:**

- Create: `frontend/src/components/content-factory/ContentFactoryGuard.tsx`
- Create: `frontend/src/app/content-factory/layout.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Test: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
- Modify: `frontend/package.json`

- [x] **Step 1: Write source guard tests**

Create `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const srcDir = join(process.cwd(), "src");

function readSource(path: string): string {
  return readFileSync(join(srcDir, path), "utf8");
}

test("sidebar exposes content factory navigation", () => {
  const source = readSource("components/layout/Sidebar.tsx");

  assert.match(source, /href:\s*"\/content-factory\/dashboard"/);
  assert.match(source, /label:\s*"Content Factory"/);
});

test("header knows content factory dashboard and calendar routes", () => {
  const source = readSource("components/layout/Header.tsx");

  assert.match(source, /\/content-factory\/dashboard/);
  assert.match(source, /\/content-factory\/calendar/);
});

test("content factory layout uses dedicated access guard", () => {
  const source = readSource("app/content-factory/layout.tsx");

  assert.match(source, /ContentFactoryGuard/);
  assert.doesNotMatch(source, /useContentAccess/);
});

test("dashboard and calendar routes exist", () => {
  assert.match(readSource("app/content-factory/dashboard/page.tsx"), /ContentFactoryDashboardPage/);
  assert.match(readSource("app/content-factory/calendar/page.tsx"), /ContentFactoryCalendarPage/);
});
```

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because route files and nav entries do not exist.

- [x] **Step 2: Implement access guard and layout**

`ContentFactoryGuard` should:

- use `useCurrentUser`;
- show a small loading state while auth loads;
- redirect unauthenticated or unauthorized users to `/`;
- allow active admins and flagged active members.

`frontend/src/app/content-factory/layout.tsx` should wrap `children` in `ContentFactoryGuard`.

- [x] **Step 3: Add navigation and header metadata**

In `Sidebar.tsx`, add one content-section item:

- href: `/content-factory/dashboard`
- label: `Content Factory`
- icon: `Factory` or `CalendarDays`
- visible when `PermissionService.canAccessContentFactory(user)` is true

In `Header.tsx`, add metadata for:

- `/content-factory/dashboard`
- `/content-factory/calendar`

- [x] **Step 4: Add tests to npm test**

In `frontend/package.json`, append:

```json
"src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts"
```

to the `test` script.

- [x] **Step 5: Verify guard and nav source checks**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
```

Expected: pass.

---

## Task 4: Content Factory Dashboard Page

**Files:**

- Create: `frontend/src/components/content-factory/ContentFactoryStatusBadge.tsx`
- Create: `frontend/src/app/content-factory/dashboard/page.tsx`
- Modify: `frontend/src/lib/contentFactoryUtils.ts`
- Test: `frontend/src/lib/contentFactoryUtils.test.ts`

- [x] **Step 1: Extend helper tests for dashboard sorting**

Add a test ensuring upcoming publications are sorted ascending by `scheduled_at`, and recently published items are sorted descending by `actual_published_at` or `scheduled_at`.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail until helper sorting is implemented.

- [x] **Step 2: Implement status badge component**

Create a compact badge component that accepts:

- `kind: "bundle" | "publication"`
- `status: string`

Use existing badge/card styling patterns and avoid oversized visual treatment.

- [x] **Step 3: Implement dashboard page**

`ContentFactoryDashboardPage` should fetch:

- bundles via `api.getCFBundles({ limit: 500 })`;
- publications via `api.getCFPublications({ limit: 500 })`;
- platforms and formats for display labels;
- team members for responsible/owner names.

UI should include:

- compact top actions linking to Calendar;
- status count cards for bundles and publications;
- upcoming scheduled publications list;
- overdue production items list;
- recently published list;
- empty states when no data exists.

Do not add a marketing hero or explanatory feature text. This is an operational screen.

- [x] **Step 4: Verify dashboard helpers and build**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
cd frontend && npx tsc --noEmit
```

Expected: pass.

---

## Task 5: Content Factory Calendar Page

**Files:**

- Create: `frontend/src/components/content-factory/ContentFactoryFilters.tsx`
- Create: `frontend/src/app/content-factory/calendar/page.tsx`
- Modify: `frontend/src/lib/contentFactoryUtils.ts`
- Test: `frontend/src/lib/contentFactoryUtils.test.ts`

- [x] **Step 1: Extend helper tests for calendar grouping**

Add tests for:

- date groups sorted ascending;
- unscheduled group placed last;
- status/platform/format/responsible/bundle filters.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail until filtering/grouping is implemented.

- [x] **Step 2: Implement shared filters component**

Create `ContentFactoryFilters` with:

- status select;
- platform select;
- format select;
- responsible select;
- bundle select;
- reset button.

Use existing `Select`, `Button`, and compact filter styling from Projects/Ideas.

- [x] **Step 3: Implement calendar page**

`ContentFactoryCalendarPage` should fetch:

- publications;
- bundles;
- platforms;
- formats;
- team members.

Render:

- a compact header with link back to dashboard;
- filters;
- date sections;
- publication rows/cards with time, status, platform, format, title, bundle, and responsible user;
- unscheduled section at the end;
- empty filtered state.

Use stable dimensions for badges and controls so filters do not shift the layout.

- [x] **Step 4: Verify calendar helpers and TypeScript**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
cd frontend && npx tsc --noEmit
```

Expected: pass.

---

## Task 6: Verification And Documentation

**Files:**

- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`

- [x] **Step 1: Run focused backend tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_auth_me_content_factory.py tests/test_content_factory_publications_api.py -q
```

Expected: pass.

- [x] **Step 2: Run focused frontend tests**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: pass.

- [x] **Step 3: Run frontend baseline**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: all pass.

- [x] **Step 4: Run repository hygiene**

Run:

```bash
git diff --check
```

Expected: pass.

- [x] **Step 5: Update docs**

Update:

- `docs/PLAN.md`: mark Sprint 3 implemented only after verification passes.
- `docs/STATUS.md`: record decisions, implementation notes, warnings, and verification results.
- `docs/TEST_PLAN.md`: add Sprint 3 automated and manual checks.

Manual checks to record:

- Admin sees Content Factory navigation.
- Active flagged member sees Content Factory navigation.
- Unflagged member does not see Content Factory navigation and is redirected away from `/content-factory`.
- Dashboard shows bundle and publication summaries.
- Calendar groups scheduled publications by date and unscheduled publications last.
- Filters narrow the calendar without revealing unauthorized data.

---

## Self-Review

- Spec coverage: covers research-backed Sprint 3 scope from `docs/content-factory-design.md`: frontend access, dashboard, calendar, typed API, and publication list bridge.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation placeholders remain in this plan.
- Type consistency: backend uses existing `CFPublicationResponse`; frontend type names should use `CF*` prefixes to avoid collision with legacy content module types.
- Scope check: full bundle/publication editing, metrics UI, retros, UTM factory, patient/guest CRM, and auto-publishing are intentionally deferred to later sprints.
