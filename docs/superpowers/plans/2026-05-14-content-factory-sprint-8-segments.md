# Content Factory Sprint 8 Segment Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Content Factory segment registry and detail workspace using the existing backend segment endpoints.

**Architecture:** Sprint 8 is frontend-heavy. Existing `/api/content-factory/segments` endpoints provide list, create, detail, refresh, and snapshots. The frontend adds helper functions, one create dialog, one refresh dialog, a reusable snapshot panel, registry/detail routes, and navigation.

**Tech Stack:** FastAPI existing endpoints, Next.js App Router, React, TypeScript, Tailwind, local shadcn-style UI primitives, lucide-react, Node test runner.

---

## File Structure

Frontend:

- Modify `frontend/src/lib/api.ts` with `getCFSegment`.
- Modify `frontend/src/lib/contentFactoryUtils.ts` with segment filters, labels, count formatting, and snapshot comparison helpers.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts` with segment helper coverage.
- Modify `frontend/src/lib/contentFactoryApiSourceGuards.test.ts` with segment detail API guard.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` with segment route/component guards.
- Create `frontend/src/components/content-factory/ContentFactorySegmentDialog.tsx`.
- Create `frontend/src/components/content-factory/ContentFactorySegmentRefreshDialog.tsx`.
- Create `frontend/src/components/content-factory/ContentFactorySegmentSnapshotList.tsx`.
- Create `frontend/src/app/content-factory/segments/page.tsx`.
- Create `frontend/src/app/content-factory/segments/[id]/page.tsx`.
- Modify `frontend/src/components/layout/Header.tsx` and `frontend/src/components/layout/Sidebar.tsx` for segment navigation.

Docs:

- Update `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

---

## Task 1: API Source Guard And Segment Helper Tests

**Files:**

- Test: `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`
- Test: `frontend/src/lib/contentFactoryUtils.test.ts`

- [x] **Step 1: Write failing API source guard**

Add assertions for:

```typescript
assert.match(source, /async getCFSegment/);
assert.match(source, /\/api\/content-factory\/segments\/\$\{id\}/);
```

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts
```

Expected: fail because `getCFSegment` is missing.

- [x] **Step 2: Write failing pure helper tests**

Add tests for:

- `formatContentFactorySegmentCount` rendering integer counts with Russian grouping.
- `filterContentFactorySegments` applying search, active, and source filters together.
- `summarizeContentFactorySegments` counting total, active, inactive, and population total.
- `compareContentFactorySegmentSnapshots` returning latest, previous, absolute delta, and percentage delta.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail because Sprint 8 helpers are missing.

---

## Task 2: API Method And Helpers

**Files:**

- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/contentFactoryUtils.ts`

- [x] **Step 1: Add `getCFSegment`**

Add:

```typescript
async getCFSegment(id: string): Promise<CFExternalSegment> {
  return this.request<CFExternalSegment>(`/api/content-factory/segments/${id}`);
}
```

- [x] **Step 2: Add segment helper types and functions**

Implement:

- `CF_SEGMENT_SOURCE_LABELS`
- `formatContentFactorySegmentCount`
- `filterContentFactorySegments`
- `summarizeContentFactorySegments`
- `compareContentFactorySegmentSnapshots`

- [x] **Step 3: Verify focused helper/API tests**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts
```

Expected: pass.

---

## Task 3: Segment Components And Routes

**Files:**

- Create: `frontend/src/components/content-factory/ContentFactorySegmentDialog.tsx`
- Create: `frontend/src/components/content-factory/ContentFactorySegmentRefreshDialog.tsx`
- Create: `frontend/src/components/content-factory/ContentFactorySegmentSnapshotList.tsx`
- Create: `frontend/src/app/content-factory/segments/page.tsx`
- Create: `frontend/src/app/content-factory/segments/[id]/page.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Test: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [x] **Step 1: Write failing route/component source guards**

Assert that:

- `/content-factory/segments` route exists and uses `api.getCFSegments`, `ContentFactorySegmentDialog`, `ContentFactorySegmentRefreshDialog`, `filterContentFactorySegments`, and links to `/content-factory/segments/${segment.id}`.
- `/content-factory/segments/[id]` route exists and uses `api.getCFSegment`, `api.getCFSegmentSnapshots`, `ContentFactorySegmentRefreshDialog`, and `ContentFactorySegmentSnapshotList`.
- `ContentFactorySegmentDialog` uses `api.createCFSegment`.
- `ContentFactorySegmentRefreshDialog` uses `api.refreshCFSegment`.
- Header and sidebar expose `/content-factory/segments`.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because Sprint 8 components and routes are missing.

- [x] **Step 2: Implement create dialog**

Build a compact dialog for source, external ID, URL, name, description, population count, active switch, and owner.

- [x] **Step 3: Implement refresh dialog**

Build a compact numeric dialog for updating population count and recording a new snapshot.

- [x] **Step 4: Implement snapshot list**

Render latest/previous snapshot comparison and chronological snapshot rows.

- [x] **Step 5: Implement segment registry route**

Load all segments with `only_active=false`, load team members for owner labels, add filters, create dialog, row refresh actions, and detail links.

- [x] **Step 6: Implement segment detail route**

Load segment, snapshots, and members. Render metadata, snapshot comparison, history, and refresh action.

- [x] **Step 7: Add navigation metadata**

Add `/content-factory/segments` to sidebar and header route metadata.

- [x] **Step 8: Verify component source guards**

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

- [x] **Step 1: Run focused Content Factory frontend suite**

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

- [x] **Step 2: Run full frontend verification**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [x] **Step 3: Run local route smoke**

```bash
cd frontend && npm run dev -- --hostname 127.0.0.1 --port 3007
curl -s -o /tmp/cf-segments-smoke.html -w "%{http_code}\n" http://127.0.0.1:3007/content-factory/segments
```

Expected: HTTP 200 and the route compiles.

- [x] **Step 4: Update durable docs**

Record implemented scope, verification results, decisions, and follow-up items.

- [ ] **Step 5: Prepare PR**

Commit, push, open PR, wait for checks, merge when green, and smoke production endpoints.
