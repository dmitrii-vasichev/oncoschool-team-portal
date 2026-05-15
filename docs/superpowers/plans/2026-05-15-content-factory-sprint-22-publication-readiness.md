# Content Factory Sprint 22 Publication Readiness Plan

**Goal:** Add a publication readiness checklist to the publication operations panel so users can see what is ready, what is missing, and what is due after publication.

**Design:** `docs/superpowers/specs/2026-05-15-content-factory-sprint-22-publication-readiness-design.md`

## Files

- Modify `docs/PLAN.md`
- Modify `docs/STATUS.md`
- Modify `docs/TEST_PLAN.md`
- Modify `docs/BACKLOG.md`
- Modify `frontend/src/lib/contentFactoryUtils.ts`
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`
- Modify `frontend/src/app/content-factory/publications/[id]/page.tsx`
- Modify `frontend/src/components/content-factory/ContentFactoryPublicationOperationsPanel.tsx`
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

## Phase 1: Plan And Failing Guards

- [x] Create Sprint 22 design and implementation plan.
- [x] Add helper tests for publication readiness checklist derivation.
- [x] Add source guards for the operations panel and publication detail route wiring.
- [x] Run focused tests once and confirm they fail before implementation.

## Phase 2: Readiness Helper

- [x] Add `getContentFactoryPublicationReadiness`.
- [x] Detect missing text, schedule, UTM, audience target, publication fact, and metric evidence.
- [x] Return stable item keys, labels, statuses, and helper copy.

## Phase 3: Operations Panel UI

- [x] Pass segment targets into `ContentFactoryPublicationOperationsPanel`.
- [x] Render `Чек-лист готовности` in the operations panel.
- [x] Keep the existing publication fact and metric actions unchanged.

## Phase 4: Verification And Integration

- [x] Run focused frontend tests.
- [x] Run full frontend tests, typecheck, lint, and build.
- [x] Run `git diff --check`.
- [ ] Commit, merge to `main`, and push.

## Validation Commands

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
