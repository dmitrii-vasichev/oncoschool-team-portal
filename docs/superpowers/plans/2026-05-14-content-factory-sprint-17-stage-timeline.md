# Content Factory Sprint 17 Guest Stage Timeline Plan

**Goal:** Add a readable stage timeline to the guest story detail page.

**Architecture:** Keep Sprint 17 frontend-only. Add a pure helper in `contentFactoryUtils` that derives timeline items from a guest story and its activity events, then render those items in a focused detail-page panel.

**Design:** `docs/superpowers/specs/2026-05-14-content-factory-sprint-17-stage-timeline-design.md`

## Files

- Modify `frontend/src/lib/contentFactoryUtils.ts`
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`
- Create `frontend/src/components/content-factory/ContentFactoryGuestStageTimelinePanel.tsx`
- Modify `frontend/src/app/content-factory/guests/[id]/page.tsx`
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
- Update durable docs:
  - `docs/PLAN.md`
  - `docs/STATUS.md`
  - `docs/TEST_PLAN.md`
  - `docs/BACKLOG.md`

## Phase 1: Plan And Failing Tests

- [x] Make Sprint 17 the active repository plan.
- [x] Add helper tests for status timeline derivation from `created` and `status_changed` events.
- [x] Add helper tests for legacy fallback when events are missing.
- [x] Add source guards for the new panel and route integration.
- [x] Run focused tests once and confirm they fail for missing helper/panel integration.

## Phase 2: Timeline Helper

- [x] Add timeline item types.
- [x] Add duration label formatting for stage time.
- [x] Build `buildContentFactoryGuestStageTimeline(story, events, now)`.
- [x] Ignore malformed or duplicate status transitions.
- [x] Return current-stage metadata and missing-next-step state.

## Phase 3: UI Panel

- [x] Create `ContentFactoryGuestStageTimelinePanel`.
- [x] Render title, current stage, current duration, next-step date, and missing next-step warning.
- [x] Render a compact vertical timeline with current-stage badge.
- [x] Add the panel to `/content-factory/guests/[id]` between attention and details.

## Phase 4: Verification And Integration

- [x] Run focused frontend tests.
- [x] Run full frontend tests, typecheck, lint, and build.
- [x] Run `git diff --check`.
- [x] Update status docs with final verification.
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
