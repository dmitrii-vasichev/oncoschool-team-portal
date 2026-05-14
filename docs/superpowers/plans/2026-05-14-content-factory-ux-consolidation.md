# Content Factory UX Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Content Factory navigation and language so the module feels like one understandable Russian-language workspace.

**Architecture:** Keep backend contracts unchanged. Add shared frontend UI metadata for section names/help content, render an internal Content Factory navigation bar from the module layout, simplify the global sidebar, add a help route, and make the retrospective dialog store the same backend JSON shape through friendlier plain-text fields.

**Tech Stack:** Next.js App Router, React client components, existing shadcn UI primitives, Node test runner, TypeScript.

---

## File Structure

- Create `frontend/src/lib/contentFactoryUi.ts`: Russian section metadata, help content, route matching helpers.
- Create `frontend/src/components/content-factory/ContentFactoryWorkspaceNav.tsx`: internal Content Factory navigation and help entry.
- Create `frontend/src/app/content-factory/help/page.tsx`: full help page.
- Modify `frontend/src/app/content-factory/layout.tsx`: wrap guarded content with internal navigation.
- Modify `frontend/src/components/layout/Sidebar.tsx`: keep only one global Content Factory item.
- Modify `frontend/src/components/layout/Header.tsx`: use Russian route names and avoid treating `/segments/analytics` as a segment detail page.
- Modify `frontend/src/lib/contentFactoryUtils.ts`: Russian labels for statuses, retro types, reference table labels, and segment roles.
- Modify `frontend/src/components/content-factory/ContentFactoryRetroDialog.tsx`: replace raw JSON labels with readable line-based fields.
- Modify `frontend/src/app/content-factory/retros/[id]/page.tsx`: render retrospective sections with friendly Russian labels.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: add RED/GREEN guards for the UX consolidation.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`: update label assertions.
- Modify durable docs: `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, `docs/BACKLOG.md`.

## Tasks

### Task 1: Write UX Source Guards

- [ ] Update source guard tests to require one global `Контент-фабрика` sidebar item and reject separate global `CF Bundles`, `CF Segments`, `CF Segment Analytics`, `CF Review`, `CF Retros`, and `CF References` labels.
- [ ] Add tests for `ContentFactoryWorkspaceNav`, `/content-factory/help`, and Russian header metadata.
- [ ] Add tests that the retrospective dialog contains friendly labels and no raw snake_case labels.
- [ ] Run `cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts`.
- [ ] Expected result: fail until the UI is implemented.

### Task 2: Implement Navigation Consolidation

- [ ] Add `frontend/src/lib/contentFactoryUi.ts` with Russian section metadata.
- [ ] Add `ContentFactoryWorkspaceNav` with horizontal scroll-safe tabs.
- [ ] Wrap Content Factory layout content with the internal nav.
- [ ] Simplify global sidebar to one Content Factory entry.
- [ ] Update header route metadata to Russian labels.
- [ ] Re-run the source guard test.

### Task 3: Add Help Page

- [ ] Create `/content-factory/help`.
- [ ] Explain the workflow, sections, manual data, deferred integrations, and key terms.
- [ ] Link help from internal nav.
- [ ] Re-run source guard test.

### Task 4: Localize Labels And Retrospective UI

- [ ] Update shared Content Factory labels to Russian wording.
- [ ] Replace retrospective JSON fields with readable plain-text fields.
- [ ] Convert plain text lines to existing backend JSON-compatible payloads on save.
- [ ] Render retrospective detail sections with Russian labels and readable values.
- [ ] Update utility tests for label expectations.

### Task 5: Validate And Update Docs

- [ ] Update durable repo docs with Sprint 9.5 status.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts src/lib/contentFactoryUtils.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [ ] Smoke `/content-factory/help` and one existing Content Factory route locally.
