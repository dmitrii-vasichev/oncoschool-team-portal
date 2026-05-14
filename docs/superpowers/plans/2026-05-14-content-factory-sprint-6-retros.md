# Content Factory Sprint 6 Retrospective Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Content Factory retrospective workspace on top of the existing backend retro endpoints.

**Architecture:** Sprint 6 is frontend-heavy. Existing backend `cf_retro_note` persistence and `/api/content-factory/retros` endpoints are reused; the frontend adds typed API methods, helper functions, list/detail routes, a JSON-backed create/edit dialog, and navigation.

**Tech Stack:** FastAPI existing endpoints, Next.js App Router, React, TypeScript, Tailwind, local shadcn-style UI primitives, lucide-react, Node test runner.

---

## File Structure

Frontend:

- Modify `frontend/src/lib/api.ts` with `getCFRetro`, `createCFRetro`, and `updateCFRetro`.
- Modify `frontend/src/lib/contentFactoryUtils.ts` with retro helper labels and formatters.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts` with retro helper coverage.
- Modify `frontend/src/lib/contentFactoryApiSourceGuards.test.ts` with retro API method guards.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` with retro route/component guards.
- Create `frontend/src/components/content-factory/ContentFactoryRetroDialog.tsx`.
- Create `frontend/src/app/content-factory/retros/page.tsx`.
- Create `frontend/src/app/content-factory/retros/[id]/page.tsx`.
- Modify `frontend/src/components/layout/Header.tsx` and `frontend/src/components/layout/Sidebar.tsx` for retro navigation.

Docs:

- Update `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

---

## Task 1: API Surface And Pure Helpers

**Files:**

- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/contentFactoryUtils.ts`
- Test: `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`
- Test: `frontend/src/lib/contentFactoryUtils.test.ts`

- [ ] **Step 1: Write failing API source guards**

Add assertions for:

```typescript
assert.match(source, /async getCFRetro/);
assert.match(source, /async createCFRetro/);
assert.match(source, /async updateCFRetro/);
assert.match(source, /\/api\/content-factory\/retros\/\$\{id\}/);
assert.match(source, /\/api\/content-factory\/retros",/);
```

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts
```

Expected: fail because the frontend API only has `getCFRetros`.

- [ ] **Step 2: Write failing pure helper tests**

Add tests for:

- `CF_RETRO_TYPE_LABELS` exposing weekly, monthly, bundle, and ad-hoc labels.
- `formatContentFactoryRetroPeriod` rendering period start/end.
- `getContentFactoryRetroTitle` rendering type plus period.
- `summarizeContentFactoryRetroSections` counting best-by-objective keys, broken items, learning keys, decision keys, and action items.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail because Sprint 6 helpers are missing.

- [ ] **Step 3: Implement API methods and helpers**

Add API methods:

```typescript
getCFRetro(id: string): Promise<CFRetroNote>
createCFRetro(data: CFRetroNoteCreateRequest): Promise<CFRetroNote>
updateCFRetro(id: string, data: CFRetroNoteUpdateRequest): Promise<CFRetroNote>
```

Add helpers:

- `CF_RETRO_TYPE_LABELS`
- `formatContentFactoryRetroPeriod`
- `getContentFactoryRetroTitle`
- `summarizeContentFactoryRetroSections`

- [ ] **Step 4: Verify API/helper tests**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts
```

Expected: pass.

---

## Task 2: Retro Dialog

**Files:**

- Create: `frontend/src/components/content-factory/ContentFactoryRetroDialog.tsx`
- Test: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Write failing dialog source guard**

Assert that `ContentFactoryRetroDialog.tsx` exists and includes:

```typescript
api.createCFRetro
api.updateCFRetro
best_by_objective
learnings
decisions
actions
```

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because the dialog does not exist.

- [ ] **Step 2: Implement JSON-backed retro dialog**

Build create/edit dialog with:

- Period start and end date inputs for create mode.
- Retro type select for create mode.
- Bundle select with `none` option for create mode.
- Facilitator select for create mode.
- JSON text areas for `best_by_objective`, `broken`, `learnings`, `decisions`, and `actions`.
- Notes textarea.
- Inline JSON validation errors.
- `api.createCFRetro` in create mode.
- `api.updateCFRetro` in edit mode.

- [ ] **Step 3: Verify dialog source guard**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: dialog assertions pass while route assertions may still fail until Task 3.

---

## Task 3: Retro List And Detail Routes

**Files:**

- Create: `frontend/src/app/content-factory/retros/page.tsx`
- Create: `frontend/src/app/content-factory/retros/[id]/page.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Test: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Write failing route source guards**

Assert that:

- `/content-factory/retros` route exists and uses `api.getCFRetros`, `ContentFactoryRetroDialog`, `getContentFactoryRetroTitle`, and links to `/content-factory/retros/${retro.id}`.
- `/content-factory/retros/[id]` route exists and uses `api.getCFRetro`, `ContentFactoryRetroDialog`, and `summarizeContentFactoryRetroSections`.
- Header and sidebar expose `/content-factory/retros`.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because the routes and navigation are missing.

- [ ] **Step 2: Implement retro list route**

Load retros, bundles, and members. Add type filter, create dialog, cards with period/type/bundle/facilitator/counts, and detail links.

- [ ] **Step 3: Implement retro detail route**

Load retro, bundles, and members. Render period/type/facilitator/bundle metadata, structured sections, notes, and edit dialog.

- [ ] **Step 4: Add navigation metadata**

Add `/content-factory/retros` to sidebar and header route metadata.

- [ ] **Step 5: Verify route source guards**

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

- [ ] **Step 1: Run focused frontend verification**

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

- [ ] **Step 2: Run full frontend verification**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

- [ ] **Step 3: Run repository hygiene**

```bash
git diff --check
```

- [ ] **Step 4: Update docs**

Update active plan, status, test plan, and backlog so Sprint 6 is recorded and the next backlog item is reference-table admin CRUD.

---

## Self-Review

- Spec coverage: The plan covers retro list, detail, create/edit dialog, helper/API tests, navigation, and docs.
- Placeholder scan: No placeholder markers are present.
- Type consistency: API method names and request/response types match the existing frontend `CFRetro*` types.
