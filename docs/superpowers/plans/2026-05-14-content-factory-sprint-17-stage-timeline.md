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

- [ ] Make Sprint 17 the active repository plan.
- [ ] Add helper tests for status timeline derivation from `created` and `status_changed` events.
- [ ] Add helper tests for legacy fallback when events are missing.
- [ ] Add source guards for the new panel and route integration.
- [ ] Run focused tests once and confirm they fail for missing helper/panel integration.

## Phase 2: Timeline Helper

- [ ] Add timeline item types.
- [ ] Add duration label formatting for stage time.
- [ ] Build `buildContentFactoryGuestStageTimeline(story, events, now)`.
- [ ] Ignore malformed or duplicate status transitions.
- [ ] Return current-stage metadata and missing-next-step state.

## Phase 3: UI Panel

- [ ] Create `ContentFactoryGuestStageTimelinePanel`.
- [ ] Render title, current stage, current duration, next-step date, and missing next-step warning.
- [ ] Render a compact vertical timeline with current-stage badge.
- [ ] Add the panel to `/content-factory/guests/[id]` between attention and details.

## Phase 4: Verification And Integration

- [ ] Run focused frontend tests.
- [ ] Run full frontend tests, typecheck, lint, and build.
- [ ] Run `git diff --check`.
- [ ] Update status docs with final verification.
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
