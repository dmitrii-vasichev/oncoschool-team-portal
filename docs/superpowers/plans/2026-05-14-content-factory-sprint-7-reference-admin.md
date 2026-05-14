# Content Factory Sprint 7 Reference Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frontend reference-table admin workspace for Content Factory platforms, formats, rubrics, nosologies, and funnel templates.

**Architecture:** Sprint 7 is frontend-heavy. Existing backend reference CRUD endpoints are reused. The frontend adds typed API methods, reference-table helpers, a reusable table, a reusable dialog, the `/content-factory/references` route, and navigation.

**Tech Stack:** FastAPI existing endpoints, Next.js App Router, React, TypeScript, Tailwind, local shadcn-style UI primitives, lucide-react, Node test runner.

---

## File Structure

Frontend:

- Modify `frontend/src/lib/types.ts` with reference create/update request types.
- Modify `frontend/src/lib/api.ts` with list options plus create/update/delete methods for the five reference tables.
- Modify `frontend/src/lib/contentFactoryUtils.ts` with reference-table labels and record helpers.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts` with reference helper coverage.
- Modify `frontend/src/lib/contentFactoryApiSourceGuards.test.ts` with reference API method guards.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` with reference route/component guards.
- Create `frontend/src/components/content-factory/ContentFactoryReferenceDialog.tsx`.
- Create `frontend/src/components/content-factory/ContentFactoryReferenceTable.tsx`.
- Create `frontend/src/app/content-factory/references/page.tsx`.
- Modify `frontend/src/components/layout/Header.tsx` and `frontend/src/components/layout/Sidebar.tsx` for navigation.

Docs:

- Update `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

---

## Task 1: API Source Guards And Helper Tests

**Files:**

- Test: `frontend/src/lib/contentFactoryApiSourceGuards.test.ts`
- Test: `frontend/src/lib/contentFactoryUtils.test.ts`

- [x] **Step 1: Write failing API source guards**

Add assertions for:

```typescript
assert.match(source, /async createCFPlatform/);
assert.match(source, /async updateCFPlatform/);
assert.match(source, /async deleteCFPlatform/);
assert.match(source, /async createCFFormat/);
assert.match(source, /async updateCFFormat/);
assert.match(source, /async deleteCFFormat/);
assert.match(source, /async createCFRubric/);
assert.match(source, /async updateCFRubric/);
assert.match(source, /async deleteCFRubric/);
assert.match(source, /async createCFNosology/);
assert.match(source, /async updateCFNosology/);
assert.match(source, /async deleteCFNosology/);
assert.match(source, /async createCFFunnelTemplate/);
assert.match(source, /async updateCFFunnelTemplate/);
assert.match(source, /async deleteCFFunnelTemplate/);
assert.match(source, /only_active/);
```

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryApiSourceGuards.test.ts
```

Expected: fail because reference write methods and inactive reads are missing.

- [x] **Step 2: Write failing pure helper tests**

Add tests for:

- `CF_REFERENCE_TABLE_LABELS` exposing the five table labels.
- `getContentFactoryReferenceLabel` returning display names for reference records.
- `summarizeContentFactoryReferenceRecords` counting total, active, and inactive records.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: fail because Sprint 7 helpers are missing.

---

## Task 2: API Methods, Types, And Helpers

**Files:**

- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/contentFactoryUtils.ts`

- [x] **Step 1: Add reference request types**

Add create and update request types for:

- `CFPlatform`
- `CFFormat`
- `CFRubric`
- `CFNosology`
- `CFFunnelTemplate`

- [x] **Step 2: Add list options and mutation methods**

Update list methods to support `only_active=false` where needed. Add create/update/delete methods for each reference table.

- [x] **Step 3: Add reference helpers**

Implement reference table labels, record labels, and summary counts.

- [x] **Step 4: Verify focused helper/API tests**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/lib/contentFactoryApiSourceGuards.test.ts
```

Expected: pass.

---

## Task 3: Reference Components And Route

**Files:**

- Create: `frontend/src/components/content-factory/ContentFactoryReferenceDialog.tsx`
- Create: `frontend/src/components/content-factory/ContentFactoryReferenceTable.tsx`
- Create: `frontend/src/app/content-factory/references/page.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Test: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [x] **Step 1: Write failing component and route source guards**

Assert that:

- `/content-factory/references/page.tsx` exists.
- The page loads all five reference lists with `only_active: false`.
- The page uses `PermissionService.isAdmin`.
- The page uses `ContentFactoryReferenceDialog` and `ContentFactoryReferenceTable`.
- The dialog uses create/update API methods and validates `capabilities` plus `template_publications`.
- The table exposes admin edit/delete actions.
- Header and sidebar expose `/content-factory/references`.

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because the components, route, and navigation are missing.

- [x] **Step 2: Implement reference table component**

Build a compact, reusable table with:

- Code and display label columns.
- Active/inactive status.
- Table-specific details.
- Admin-only edit and delete actions.
- Empty state.

- [x] **Step 3: Implement reference dialog**

Build a reusable create/edit dialog with conditional fields per table:

- Create-only `code`.
- Label/name fields.
- Active switch.
- Display order where supported.
- Medical-review switch for formats.
- JSON text areas for `capabilities` and `template_publications`.
- Inline validation errors.

- [x] **Step 4: Implement references route**

Load platforms, formats, rubrics, nosologies, and funnel templates with inactive records included. Add tabs, admin-only create action, edit flow, delete confirmation, toast handling, and read-only state for non-admin users.

- [x] **Step 5: Add navigation metadata**

Add `/content-factory/references` to the sidebar and header route metadata.

- [x] **Step 6: Verify component source guards**

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

- [x] **Step 2: Run full frontend suite**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [x] **Step 3: Update durable docs**

Record implemented scope, verification results, decisions, and follow-up items.

- [ ] **Step 4: Prepare PR**

Commit, push, open PR, wait for checks, merge when green, and smoke production for `/api/auth/config` plus unauthenticated route behavior.
