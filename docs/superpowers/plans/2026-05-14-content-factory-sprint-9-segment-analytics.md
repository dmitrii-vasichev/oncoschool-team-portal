# Content Factory Sprint 9 Segment Usage Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a segment usage analytics workspace that shows where Content Factory segments are used across publications and bundles.

**Architecture:** Keep the sprint frontend-heavy and derive analytics from existing Content Factory endpoints. Add pure aggregation/filter helpers, a compact analytics table component, and a new `/content-factory/segments/analytics` route linked from segment navigation.

**Tech Stack:** Next.js App Router, React client components, existing Content Factory API client, Node test runner, TypeScript.

---

## File Structure

- Modify `frontend/src/lib/contentFactoryUtils.ts`: add segment usage analytics types, builder, summary, and filters.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`: add RED/GREEN helper coverage.
- Create `frontend/src/components/content-factory/ContentFactorySegmentUsageTable.tsx`: render compact segment analytics rows.
- Create `frontend/src/app/content-factory/segments/analytics/page.tsx`: load data, fan out secondary target/metric requests, apply filters, render summary and table.
- Modify `frontend/src/app/content-factory/segments/page.tsx`: add an `Analytics` action.
- Modify `frontend/src/components/layout/Sidebar.tsx`: add segment analytics navigation.
- Modify `frontend/src/components/layout/Header.tsx`: add segment analytics route metadata and breadcrumb handling.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: add source guards for the new route and navigation.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`: make Sprint 9 active and mark Sprint 8 merged.

## Tasks

### Task 1: Write Failing Helper Tests

**Files:**
- Modify: `frontend/src/lib/contentFactoryUtils.test.ts`

- [ ] Add tests that import `buildContentFactorySegmentUsageRows`, `summarizeContentFactorySegmentUsage`, and `filterContentFactorySegmentUsageRows`.
- [ ] Test a segment used by two publications across two bundles with target and exclusion roles, one published publication, two metric snapshots, and expected latest activity.
- [ ] Test that an active segment with no target links is counted as unused.
- [ ] Test search, `used`, `unused`, and role filters.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail because the helper exports do not exist yet.

### Task 2: Implement Segment Usage Helpers

**Files:**
- Modify: `frontend/src/lib/contentFactoryUtils.ts`

- [ ] Add the analytics helper types.
- [ ] Implement `buildContentFactorySegmentUsageRows`.
- [ ] Implement `summarizeContentFactorySegmentUsage`.
- [ ] Implement `filterContentFactorySegmentUsageRows`.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: pass.

### Task 3: Write Failing Source Guards

**Files:**
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] Assert that `app/content-factory/segments/analytics/page.tsx` exists.
- [ ] Assert the route loads segments, publications, bundles, publication segment targets, and metrics.
- [ ] Assert the route uses segment usage helper functions.
- [ ] Assert sidebar/header and the segment registry link to `/content-factory/segments/analytics`.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because the route and navigation do not exist yet.

### Task 4: Build Analytics Table Component and Route

**Files:**
- Create: `frontend/src/components/content-factory/ContentFactorySegmentUsageTable.tsx`
- Create: `frontend/src/app/content-factory/segments/analytics/page.tsx`

- [ ] Load `api.getCFSegments({ only_active: false })`, `api.getCFPublications({ limit: 500 })`, `api.getCFBundles({ limit: 500 })`, and team members.
- [ ] For every publication, load segment targets and metric snapshots with independent fallbacks.
- [ ] Build usage rows and summary through the pure helpers.
- [ ] Render summary cards, filters, and compact segment usage rows.
- [ ] Link each segment row to `/content-factory/segments/{id}` and recent publications to `/content-factory/publications/{id}`.
- [ ] Run focused helper and source guard tests.

### Task 5: Add Navigation and Registry Entry Point

**Files:**
- Modify: `frontend/src/app/content-factory/segments/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`

- [ ] Add an `Analytics` action to the segment registry toolbar.
- [ ] Add sidebar navigation item `CF Segment Analytics`.
- [ ] Add header route metadata for `/content-factory/segments/analytics`.
- [ ] Ensure the generic segment detail breadcrumb does not swallow the analytics route.

### Task 6: Validate and Update Docs

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] Update durable docs with Sprint 9 scope and latest progress.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected: all commands pass.
