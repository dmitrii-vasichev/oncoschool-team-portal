# Content Factory Sprint 10 Effectiveness Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an objective-aware effectiveness workspace that turns Content Factory publication metric snapshots into a practical operating view.

**Architecture:** Keep Sprint 10 frontend-heavy and derive effectiveness rows from existing Content Factory endpoints. Add pure aggregation/filter helpers, a compact table component, and a new `/content-factory/effectiveness` route linked from internal Content Factory navigation.

**Tech Stack:** Next.js App Router, React client components, existing Content Factory API client, Node test runner, TypeScript.

---

## File Structure

- Modify `frontend/src/lib/contentFactoryUtils.ts`: add effectiveness helper types, builder, summary, filters, and metric-health constants.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`: add RED/GREEN helper coverage.
- Create `frontend/src/components/content-factory/ContentFactoryEffectivenessTable.tsx`: render compact publication effectiveness rows.
- Create `frontend/src/app/content-factory/effectiveness/page.tsx`: load core records, fan out target/metric requests, apply filters, render summary and table.
- Modify `frontend/src/lib/contentFactoryUi.ts`: add `Эффективность` to internal Content Factory sections.
- Modify `frontend/src/components/content-factory/ContentFactoryWorkspaceNav.tsx`: add an icon for the effectiveness section.
- Modify `frontend/src/components/layout/Header.tsx`: add route metadata for `/content-factory/effectiveness`.
- Modify `frontend/src/app/content-factory/help/page.tsx`: include the new section automatically through `CONTENT_FACTORY_SECTIONS`; verify copy remains coherent.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: add source guards for the new route and navigation.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`: make Sprint 10 active and preserve Sprint 9.5 as completed context.

## Tasks

### Task 1: Write Failing Helper Tests

**Files:**
- Modify: `frontend/src/lib/contentFactoryUtils.test.ts`

- [ ] Import `buildContentFactoryEffectivenessRows`, `summarizeContentFactoryEffectiveness`, and `filterContentFactoryEffectivenessRows` from `contentFactoryUtils`.
- [ ] Add a test where two publications use different formats/objectives, one has fresh metrics, one has stale or missing evidence, and target counts are aggregated.
- [ ] Add a summary test for total rows, published rows, rows with evidence, rows without evidence, and stale rows.
- [ ] Add a filter test for search, objective, metric health, and platform.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail because the helper exports do not exist yet.

### Task 2: Implement Effectiveness Helpers

**Files:**
- Modify: `frontend/src/lib/contentFactoryUtils.ts`

- [ ] Add effectiveness helper types.
- [ ] Implement `buildContentFactoryEffectivenessRows`.
- [ ] Implement `summarizeContentFactoryEffectiveness`.
- [ ] Implement `filterContentFactoryEffectivenessRows`.
- [ ] Keep freshness deterministic by accepting `now` and `freshnessDays` in helper input.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: pass.

### Task 3: Write Failing Source Guards

**Files:**
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] Assert that `app/content-factory/effectiveness/page.tsx` exists.
- [ ] Assert the route loads publications, bundles, platforms, formats, segment targets, and metrics.
- [ ] Assert the route uses effectiveness helper functions.
- [ ] Assert `CONTENT_FACTORY_SECTIONS`, the workspace nav, header, and help route include `Эффективность`.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because the route and navigation do not exist yet.

### Task 4: Build the Effectiveness Route and Table

**Files:**
- Create: `frontend/src/components/content-factory/ContentFactoryEffectivenessTable.tsx`
- Create: `frontend/src/app/content-factory/effectiveness/page.tsx`

- [ ] Load `api.getCFPublications({ limit: 500 })`, `api.getCFBundles({ limit: 500 })`, `api.getCFPlatforms()`, and `api.getCFFormats()`.
- [ ] For every publication, load segment targets and metric snapshots with independent fallbacks.
- [ ] Build rows and summary through the pure helpers.
- [ ] Render summary cards, filters, and compact effectiveness rows.
- [ ] Link each row to `/content-factory/publications/{id}` and its campaign to `/content-factory/bundles/{id}`.
- [ ] Show a partial-evidence note if secondary requests fail.
- [ ] Run focused helper and source guard tests.

### Task 5: Add Navigation and Header Metadata

**Files:**
- Modify: `frontend/src/lib/contentFactoryUi.ts`
- Modify: `frontend/src/components/content-factory/ContentFactoryWorkspaceNav.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`

- [ ] Add `/content-factory/effectiveness` with label `Эффективность`.
- [ ] Use a chart/target-style icon in the workspace navigation.
- [ ] Add header metadata with title `Эффективность`.
- [ ] Ensure `/content-factory/effectiveness` is not swallowed by publication, bundle, segment, or retro detail route matching.

### Task 6: Validate and Update Docs

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] Update durable docs with Sprint 10 scope and latest progress.
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
