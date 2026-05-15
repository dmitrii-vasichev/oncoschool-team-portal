# Content Factory Sprint 20 Publication Creation Plan

**Goal:** Add a direct `Новая публикация` flow to `/content-factory/publications`, with campaign selection and redirect to the created publication.

**Architecture:** Keep Sprint 20 frontend-only. Reuse `ContentFactoryPublicationDialog` and the existing `createCFPublicationForBundle` API method. Add an optional campaign selector only when the dialog is used without a fixed `bundleId`.

**Design:** `docs/superpowers/specs/2026-05-15-content-factory-sprint-20-publication-create-design.md`

## Files

- Modify `docs/PLAN.md`
- Modify `docs/STATUS.md`
- Modify `docs/TEST_PLAN.md`
- Modify `docs/BACKLOG.md`
- Modify `frontend/src/components/content-factory/ContentFactoryPublicationDialog.tsx`
- Modify `frontend/src/app/content-factory/publications/page.tsx`
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

## Phase 1: Plan And Failing Guards

- [x] Create Sprint 20 design and implementation plan.
- [x] Add source guards for the publications index create flow.
- [x] Add source guards for the dialog campaign selector.
- [x] Run focused guards once and confirm they fail before implementation.

## Phase 2: Dialog Campaign Selection

- [x] Add optional `bundles` prop to `ContentFactoryPublicationDialog`.
- [x] Add `selectedBundleId` state.
- [x] Show `Кампания` select only for create flows without a fixed `bundleId`.
- [x] Validate campaign selection before create.

## Phase 3: Publications Page Create Flow

- [x] Load rubrics and nosologies on `/content-factory/publications`.
- [x] Add `Новая публикация` button.
- [x] Render `ContentFactoryPublicationDialog` with `bundles`.
- [x] Refresh and redirect to the created publication detail after save.

## Phase 4: Verification And Integration

- [x] Run focused frontend guards.
- [x] Run full frontend tests, typecheck, lint, and build.
- [x] Run `git diff --check`.
- [ ] Commit, merge to `main`, and push.

## Validation Commands

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
