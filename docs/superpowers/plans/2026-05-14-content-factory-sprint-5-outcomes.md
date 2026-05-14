# Content Factory Sprint 5 Outcomes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Content Factory publications to segment targeting, UTM discipline, manual metric evidence, and review queues without introducing brittle publishing integrations.

**Architecture:** Sprint 5 is a frontend-heavy layer over the Sprint 1/2 backend foundation. Existing REST endpoints already support external segments, publication segment targets, metric snapshots, and publication status filters; this sprint adds typed frontend client methods, pure helper functions, publication-detail panels, and a review queue page.

**Tech Stack:** FastAPI existing endpoints, Next.js App Router, React, TypeScript, Tailwind, shadcn-style local UI primitives, lucide-react, Node test runner.

---

## File Structure

Frontend:

- Modify `frontend/src/lib/types.ts` with `CFExternalSegmentCreateRequest`.
- Modify `frontend/src/lib/api.ts` with segment target, segment creation/refresh/snapshot, and metric recording methods.
- Modify `frontend/src/lib/contentFactoryUtils.ts` with UTM, metric, review queue, and segment target helpers.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts` with pure helper coverage.
- Modify `frontend/src/lib/contentFactoryApiSourceGuards.test.ts` with API method source guards.
- Create `frontend/src/components/content-factory/ContentFactorySegmentTargetsPanel.tsx`.
- Create `frontend/src/components/content-factory/ContentFactoryMetricDialog.tsx`.
- Create `frontend/src/components/content-factory/ContentFactoryMetricHistory.tsx`.
- Create `frontend/src/components/content-factory/ContentFactoryUtmHelper.tsx`.
- Modify `frontend/src/app/content-factory/publications/[id]/page.tsx` to load and render segments, segment targets, metrics, and the UTM helper.
- Create `frontend/src/app/content-factory/review/page.tsx`.
- Modify `frontend/src/components/layout/Header.tsx` and `frontend/src/components/layout/Sidebar.tsx` for review queue navigation.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` with Sprint 5 route/component source guards.

Docs:

- Update `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

---

## Task 1: API Surface And Pure Helpers

**Files:**

- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/contentFactoryUtils.ts`
- Test: `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`
- Test: `frontend/src/lib/contentFactoryUtils.test.ts`

- [x] **Step 1: Write failing API source guards**

Add assertions for:

```typescript
assert.match(source, /async createCFSegment/);
assert.match(source, /async refreshCFSegment/);
assert.match(source, /async getCFSegmentSnapshots/);
assert.match(source, /async getCFPublicationSegmentTargets/);
assert.match(source, /async addCFPublicationSegmentTarget/);
assert.match(source, /async removeCFPublicationSegmentTarget/);
assert.match(source, /async recordCFMetric/);
assert.match(source, /\/api\/content-factory\/segments\/\$\{segmentId\}\/snapshots/);
assert.match(source, /\/api\/content-factory\/publications\/\$\{publicationId\}\/segment-targets/);
assert.match(source, /\/api\/content-factory\/publications\/\$\{publicationId\}\/metrics/);
```

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts
```

Expected: fail because Sprint 5 frontend API methods are missing.

- [x] **Step 2: Write failing pure helper tests**

Add tests for:

- `buildContentFactoryUtm` composing source, medium, campaign, content, term, and CTA fields from publication/bundle context.
- `formatContentFactoryMetricValue` rendering numeric and text metric values.
- `getContentFactoryReviewQueueGroups` grouping publications into production, factcheck, doctor review, approval, scheduling, failed, and cancelled queues.
- `getAvailableContentFactorySegments` excluding already selected segment targets.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail because Sprint 5 helpers are missing.

- [x] **Step 3: Implement API methods and helpers**

Add `CFExternalSegmentCreateRequest` to `frontend/src/lib/types.ts`.

Add API methods:

```typescript
createCFSegment(data: CFExternalSegmentCreateRequest): Promise<CFExternalSegment>
refreshCFSegment(segmentId: string, data: CFSegmentRefreshRequest): Promise<CFExternalSegment>
getCFSegmentSnapshots(segmentId: string): Promise<CFSegmentSnapshot[]>
getCFPublicationSegmentTargets(publicationId: string): Promise<CFPublicationSegmentTarget[]>
addCFPublicationSegmentTarget(publicationId: string, data: CFPublicationSegmentTargetCreateRequest): Promise<CFPublicationSegmentTarget>
removeCFPublicationSegmentTarget(publicationId: string, externalSegmentId: string): Promise<void>
recordCFMetric(publicationId: string, data: CFMetricSnapshotCreateRequest): Promise<CFMetricSnapshot>
```

Add helpers in `contentFactoryUtils.ts`:

- `buildContentFactoryUtm`
- `formatContentFactoryMetricValue`
- `getContentFactoryReviewQueueGroups`
- `getAvailableContentFactorySegments`

- [x] **Step 4: Verify API/helper tests**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts
```

Expected: pass.

---

## Task 2: Publication Outcomes Panels

**Files:**

- Create: `frontend/src/components/content-factory/ContentFactorySegmentTargetsPanel.tsx`
- Create: `frontend/src/components/content-factory/ContentFactoryMetricDialog.tsx`
- Create: `frontend/src/components/content-factory/ContentFactoryMetricHistory.tsx`
- Create: `frontend/src/components/content-factory/ContentFactoryUtmHelper.tsx`
- Modify: `frontend/src/app/content-factory/publications/[id]/page.tsx`
- Test: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [x] **Step 1: Write failing source guards**

Assert that the publication detail route loads:

```typescript
api.getCFSegments
api.getCFPublicationSegmentTargets
api.getCFMetrics
ContentFactorySegmentTargetsPanel
ContentFactoryMetricHistory
ContentFactoryUtmHelper
```

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because the panels are missing.

- [x] **Step 2: Implement segment target panel**

Build a compact panel that lists selected segment targets with role, expected count, and actual count. It must allow adding an available segment with role and expected count, and removing an existing target.

- [x] **Step 3: Implement manual metric dialog and history**

Build a dialog for window, metric name, value, text value, source method, confidence, and note. Render metric history ordered by captured time with confidence/source labels.

- [x] **Step 4: Implement UTM helper**

Build a helper that derives a recommended UTM object from bundle/publication/platform/format/segment/CTA context and can apply it through `api.updateCFPublication`.

- [x] **Step 5: Wire publication detail**

Load segments, segment targets, and metrics alongside publication metadata. Render the panels and refetch after mutations.

- [x] **Step 6: Verify source guards**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: pass.

---

## Task 3: Review Queues

**Files:**

- Create: `frontend/src/app/content-factory/review/page.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Test: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [x] **Step 1: Write failing source guards**

Assert that `/content-factory/review` exists, uses `api.getCFPublications`, `getContentFactoryReviewQueueGroups`, and links to publication detail pages.

- [x] **Step 2: Implement review queue page**

Load publications, bundles, platforms, formats, and members. Group queue cards into production, factcheck, doctor review, approval, scheduling, failed, and cancelled work. Each card links to `/content-factory/publications/{id}`.

- [x] **Step 3: Add navigation metadata**

Add sidebar and header metadata for `/content-factory/review`.

- [x] **Step 4: Verify review source guards**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: pass.

---

## Task 4: Full Verification And Docs

**Files:**

- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [x] **Step 1: Run focused frontend verification**

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

- [x] **Step 2: Run full frontend verification**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

- [x] **Step 3: Run repository hygiene**

```bash
git diff --check
```

- [x] **Step 4: Update docs**

Update active plan, status, test plan, and backlog so Sprint 5 is recorded and Sprint 6 is next.

---

## Self-Review

- Spec coverage: The plan covers segment targeting, UTM helper, manual metric capture/history, and review queues. API publishing integrations remain deferred.
- Placeholder scan: No placeholder markers are present.
- Type consistency: API method names use existing `CF` naming and match backend route paths.
