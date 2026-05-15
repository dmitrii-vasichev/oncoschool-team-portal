# Content Factory Sprint 42 Publication Plan Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe paste/import preview for spreadsheet-like publication plans.

**Architecture:** Keep Sprint 42 frontend-only and reuse the existing publication create API. Add parser/validation helpers in `contentFactoryUtils`, a dedicated import dialog component, and a button on the publications index. The import creates publications row-by-row only after the preview has no validation errors.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, Node test runner.

---

### Task 1: Publication Plan Import Parser

**Files:**
- Modify: `frontend/src/lib/contentFactoryUtils.ts`
- Modify: `frontend/src/lib/contentFactoryUtils.test.ts`

- [x] **Step 1: Write failing parser tests**

Add tests for localized header mapping, defaults, reference matching, notes in UTM, stable date parsing, and validation errors.

- [x] **Step 2: Run focused helper tests and verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: FAIL because `parseContentFactoryPublicationPlanImportRows` does not exist.

- [x] **Step 3: Implement minimal parser**

Add:

- `ContentFactoryPublicationPlanImportPayload`
- `ContentFactoryPublicationPlanImportRow`
- `ContentFactoryPublicationPlanImportPreview`
- `ContentFactoryPublicationPlanImportOptions`
- `parseContentFactoryPublicationPlanImportRows`

Parser behavior:

- detect delimiter from the header line;
- require a header row;
- map common Russian/English column labels;
- match references by id, code, display name, full name, and practical aliases;
- require campaign, platform, format, responsible user, and at least title/body;
- normalize statuses;
- parse `yyyy-mm-dd`, `yyyy-mm-dd hh:mm`, and `dd.mm.yyyy` dates;
- store import notes in `utm.cf_import_note`;
- return valid and invalid rows without throwing.

- [x] **Step 4: Run focused helper tests and verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: PASS.

### Task 2: Publication Plan Import Dialog

**Files:**
- Create: `frontend/src/components/content-factory/ContentFactoryPublicationPlanImportDialog.tsx`
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [x] **Step 1: Write failing source guard**

Assert that the new dialog exists, uses `parseContentFactoryPublicationPlanImportRows`, calls `api.createCFPublicationForBundle`, shows `Импорт плана`, `Готово к созданию`, `С ошибками`, and disables import while errors exist.

- [x] **Step 2: Run source guards and verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because the dialog file and route wiring do not exist.

- [x] **Step 3: Build dialog**

Create a dialog that:

- lets the user choose default campaign, platform, format, and responsible user;
- accepts pasted rows;
- renders preview cards for valid and invalid rows;
- blocks import when any row has errors;
- creates publications sequentially through `api.createCFPublicationForBundle`;
- refreshes the publication list via `onImported`.

- [x] **Step 4: Run source guards and verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

### Task 3: Wire Publications Page And Durable Docs

**Files:**
- Modify: `frontend/src/app/content-factory/publications/page.tsx`
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [x] **Step 1: Add import button and dialog wiring**

Add an `Импорт плана` button next to `Новая публикация`, keep the existing create dialog intact, and refresh list data after import without redirecting.

- [x] **Step 2: Update durable docs**

Set Sprint 42 as the active plan, record RED/GREEN progress, add manual QA, and remove Sprint 42 from the immediate backlog.

### Task 4: Full Verification And Integration

**Files:**
- No file changes expected after this task unless verification finds issues.

- [x] **Step 1: Run full verification**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [x] **Step 2: Commit, merge, and push**

Use:

```bash
git add docs/PLAN.md docs/STATUS.md docs/TEST_PLAN.md docs/BACKLOG.md docs/superpowers/specs/2026-05-15-content-factory-sprint-42-publication-plan-import-design.md docs/superpowers/plans/2026-05-15-content-factory-sprint-42-publication-plan-import.md frontend/src/lib/contentFactoryUtils.ts frontend/src/lib/contentFactoryUtils.test.ts frontend/src/components/content-factory/ContentFactoryPublicationPlanImportDialog.tsx frontend/src/components/content-factory/contentFactorySourceGuards.test.ts frontend/src/app/content-factory/publications/page.tsx
git commit -m "feat(cf): add publication plan import"
git switch main
git merge --ff-only codex/content-factory-sprint-42-publication-plan-import
git push origin main
```
