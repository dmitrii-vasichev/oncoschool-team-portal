# Content Factory Sprint 19 Publications Index Plan

**Goal:** Add a first-class `Публикации` section that lists all Content Factory publications with search, filters, summary counts, and links to detail pages.

**Architecture:** Keep Sprint 19 frontend-only. Reuse the existing publication list endpoint and reference endpoints, add pure helper functions for index behavior, then render a dedicated route.

**Design:** `docs/superpowers/specs/2026-05-14-content-factory-sprint-19-publications-index-design.md`

## Files

- Modify `docs/PLAN.md`
- Modify `docs/STATUS.md`
- Modify `docs/TEST_PLAN.md`
- Modify `docs/BACKLOG.md`
- Modify `frontend/src/lib/contentFactoryUi.ts`
- Modify `frontend/src/components/content-factory/ContentFactoryWorkspaceNav.tsx`
- Modify `frontend/src/components/layout/Header.tsx`
- Modify `frontend/src/lib/contentFactoryUtils.ts`
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`
- Create `frontend/src/app/content-factory/publications/page.tsx`
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

## Phase 1: Plan And Failing Tests

- [x] Create Sprint 19 design and implementation plan.
- [x] Add helper tests for publication index summary, search, and sorting.
- [x] Add source guards for navigation, header metadata, and route integration.
- [x] Run focused tests once and confirm they fail for missing helper/page integration.

## Phase 2: Helpers And Navigation

- [x] Add `summarizeContentFactoryPublicationIndex`.
- [x] Add `filterContentFactoryPublicationIndex`.
- [x] Add `sortContentFactoryPublicationsForIndex`.
- [x] Add `Публикации` to workspace navigation and header metadata.

## Phase 3: Publications Page

- [x] Create `/content-factory/publications`.
- [x] Load publications, campaigns, platforms, formats, and team members.
- [x] Render summary counts, search, structured filters, result count, empty state, and publication rows.
- [x] Link every row to the publication detail page.

## Phase 4: Verification And Integration

- [x] Run focused frontend tests.
- [x] Run full frontend tests, typecheck, lint, and build.
- [x] Run `git diff --check`.
- [x] Commit, merge to `main`, and push.

Latest verification:

- `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts` passed: 72 tests.
- `cd frontend && npm test` passed: 163 tests.
- `cd frontend && npx tsc --noEmit` passed.
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed, including `/content-factory/publications`.
- `git diff --check` passed.

## Validation Commands

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
