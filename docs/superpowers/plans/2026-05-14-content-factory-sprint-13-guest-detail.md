# Content Factory Sprint 13 Guest Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Content Factory detail page for one guest or patient story.

**Architecture:** Keep Sprint 13 frontend-only. Add one typed API client read method, one read-only detail display component, one App Router detail route, and source guards that lock the route, links, and Russian user-facing sections.

**Tech Stack:** Next.js App Router, React client components, existing UI primitives, lucide-react, TypeScript, Node test runner.

---

## File Structure

- Modify `frontend/src/lib/api.ts`: add `getCFGuestStory(id)`.
- Modify `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`: assert the single-story API method exists.
- Modify `frontend/src/components/content-factory/ContentFactoryGuestStoryTable.tsx`: link story rows to detail pages.
- Create `frontend/src/components/content-factory/ContentFactoryGuestStoryDetailPanels.tsx`: read-only story context sections.
- Create `frontend/src/app/content-factory/guests/[id]/page.tsx`: detail route, data loading, refresh, edit dialog, page title, not-found state.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: add route, component, and table-link guards.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`: make Sprint 13 active and keep Sprint 12 as completed context.

## Tasks

### Task 1: Write Failing Source Guards

**Files:**
- Modify: `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] Add API guard assertions:

```ts
assert.match(apiSource, /async getCFGuestStory/);
assert.match(apiSource, /\/api\/content-factory\/guests\/\$\{id\}/);
```

- [ ] Add UI source guard assertions:

```ts
assert.equal(sourceExists("app/content-factory/guests/[id]/page.tsx"), true);
assert.equal(
  sourceExists("components/content-factory/ContentFactoryGuestStoryDetailPanels.tsx"),
  true,
);
assert.match(tableSource, /\/content-factory\/guests\/\$\{story\.id\}/);
assert.match(detailRouteSource, /ContentFactoryGuestDetailPage/);
assert.match(detailRouteSource, /api\.getCFGuestStory\(id\)/);
assert.match(detailRouteSource, /ContentFactoryGuestStoryDetailPanels/);
assert.match(detailRouteSource, /ContentFactoryGuestStoryDialog/);
assert.match(detailPanelSource, /История/);
assert.match(detailPanelSource, /Согласие и границы/);
assert.match(detailPanelSource, /Связи/);
```

- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because the API method, detail route, and detail component do not exist yet.

### Task 2: Add API Method And List Link

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/components/content-factory/ContentFactoryGuestStoryTable.tsx`

- [ ] Add:

```ts
async getCFGuestStory(id: string): Promise<CFGuestStory> {
  return this.request<CFGuestStory>(`/api/content-factory/guests/${id}`);
}
```

- [ ] Make the story title link to:

```tsx
<Link href={`/content-factory/guests/${story.id}`}>{story.display_name}</Link>
```

- [ ] Run the focused source guards.

Expected: API and table-link assertions pass; route/component assertions still fail.

### Task 3: Build Read-Only Detail Panels

**Files:**
- Create: `frontend/src/components/content-factory/ContentFactoryGuestStoryDetailPanels.tsx`

- [ ] Implement local date, list, and fallback formatting helpers.
- [ ] Render compact summary cards for stage, due date, consent, anonymity, and gift/follow-up.
- [ ] Render main sections for story brief, source notes, screening notes, factcheck notes, and rejection/pause reason.
- [ ] Render side sections for contact, allowed channels, sensitive topics, legal notes, campaign, publication, and nosology.
- [ ] Use existing guest label maps from `contentFactoryUtils`.
- [ ] Link campaign and publication values to their existing detail routes.
- [ ] Run focused source guards.

Expected: component assertions pass; route assertions still fail.

### Task 4: Build Guest Detail Route

**Files:**
- Create: `frontend/src/app/content-factory/guests/[id]/page.tsx`

- [ ] Use `useParams()` to read `id`.
- [ ] Load the guest story and references with `Promise.all`.
- [ ] Treat reference request failures as empty arrays.
- [ ] Show skeleton while loading.
- [ ] Show not-found state when the story cannot load.
- [ ] Set the page title to the story display name.
- [ ] Render back link, title block, refresh button, edit button, `ContentFactoryGuestStoryDetailPanels`, and `ContentFactoryGuestStoryDialog`.
- [ ] Refresh detail data after saving edits.
- [ ] Run focused source guards.

Expected: focused source guards pass.

### Task 5: Validate, Document, And Commit

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected: all commands pass.

- [ ] Smoke `/content-factory/guests/test-id-shape` locally enough to confirm the route compiles, or use a real guest story id when available.
- [ ] Update durable docs with verification results.
- [ ] Commit Sprint 13.
