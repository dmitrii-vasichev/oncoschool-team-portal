# Content Factory Sprint 12 Guest Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first frontend workspace for Content Factory guest and patient story CRM records.

**Architecture:** Keep the UI frontend-only on top of Sprint 11 endpoints. Add typed API methods, pure helper labels/filtering/summaries, a reusable create/edit dialog, and a compact `/content-factory/guests` route linked from Content Factory navigation and help.

**Tech Stack:** Next.js App Router, React client components, existing UI primitives, lucide-react, TypeScript, Node test runner.

---

## File Structure

- Modify `frontend/src/lib/types.ts`: add guest story enum types, model, request types, and list params.
- Modify `frontend/src/lib/api.ts`: import guest types and add list/create/update methods.
- Modify `frontend/src/lib/contentFactoryUtils.ts`: add guest labels, summary, filtering, and due helpers.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`: add helper coverage.
- Create `frontend/src/components/content-factory/ContentFactoryGuestStoryDialog.tsx`: create/edit dialog with Russian labels and newline arrays.
- Create `frontend/src/components/content-factory/ContentFactoryGuestStoryTable.tsx`: compact story rows and edit actions.
- Create `frontend/src/app/content-factory/guests/page.tsx`: load guests and references, render summary/filter/table/dialog.
- Modify `frontend/src/lib/contentFactoryUi.ts`: add `Гости и истории`.
- Modify `frontend/src/components/content-factory/ContentFactoryWorkspaceNav.tsx`: add route icon.
- Modify `frontend/src/components/layout/Header.tsx`: add route metadata.
- Modify `frontend/src/app/content-factory/help/page.tsx`: workflow/glossary should mention guest stories through copy or section cards.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: add source guards.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`: make Sprint 12 active.

## Tasks

### Task 1: Write Failing Helper And Source Tests

**Files:**
- Modify: `frontend/src/lib/contentFactoryUtils.test.ts`
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] Import new guest helper exports from `contentFactoryUtils`.
- [ ] Add helper tests for status labels, active detection, follow-up due, summary, and combined filters.
- [ ] Add source guard tests for the guest route, dialog, API usage, navigation, header, and help.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because guest helper exports and route files do not exist yet.

### Task 2: Add Types, API Methods, And Helpers

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/contentFactoryUtils.ts`

- [ ] Add frontend types that mirror Sprint 11 backend schemas.
- [ ] Add `api.getCFGuestStories`, `api.createCFGuestStory`, and `api.updateCFGuestStory`.
- [ ] Add label maps for role, source, status, consent, anonymity, and gift status.
- [ ] Add `isContentFactoryGuestStoryActive`, `isContentFactoryGuestFollowUpDue`, `summarizeContentFactoryGuestStories`, and `filterContentFactoryGuestStories`.
- [ ] Run the helper/source tests.

Expected: helper tests pass; source guards still fail until UI files exist.

### Task 3: Build Guest Dialog And Table

**Files:**
- Create: `frontend/src/components/content-factory/ContentFactoryGuestStoryDialog.tsx`
- Create: `frontend/src/components/content-factory/ContentFactoryGuestStoryTable.tsx`

- [ ] Build a create/edit dialog with Russian field groups.
- [ ] Convert newline-separated allowed channels and sensitive topics into arrays.
- [ ] Validate display name and owner.
- [ ] Call create or update API based on editing mode.
- [ ] Build compact story rows with status, consent, due dates, owner, campaign/publication links, and edit action.
- [ ] Run source guards.

Expected: source guards still fail until the route and navigation are wired.

### Task 4: Build Route And Navigation

**Files:**
- Create: `frontend/src/app/content-factory/guests/page.tsx`
- Modify: `frontend/src/lib/contentFactoryUi.ts`
- Modify: `frontend/src/components/content-factory/ContentFactoryWorkspaceNav.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/app/content-factory/help/page.tsx`

- [ ] Load `api.getCFGuestStories({ limit: 500 })`, `api.getTeam()`, `api.getCFBundles({ limit: 500 })`, `api.getCFPublications({ limit: 500 })`, and `api.getCFNosologies({ only_active: false })`.
- [ ] Render summary cards, filters, empty state, table, and dialog.
- [ ] Add `Гости и истории` to internal navigation, header, and help.
- [ ] Run helper and source guard tests.

Expected: focused tests pass.

### Task 5: Validate, Document, And Commit

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

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

- [ ] Smoke `/content-factory/guests` locally after build/dev server is available.
- [ ] Update docs with verification results.
- [ ] Commit Sprint 12.
