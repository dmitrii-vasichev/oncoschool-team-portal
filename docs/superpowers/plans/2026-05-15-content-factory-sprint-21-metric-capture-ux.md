# Content Factory Sprint 21 Metric Capture UX Plan

**Goal:** Make manual metric capture readable and faster by replacing raw enum values with shared user-facing labels and metric-name presets.

**Design:** `docs/superpowers/specs/2026-05-15-content-factory-sprint-21-metric-capture-ux-design.md`

## Files

- Modify `docs/PLAN.md`
- Modify `docs/STATUS.md`
- Modify `docs/TEST_PLAN.md`
- Modify `docs/BACKLOG.md`
- Modify `frontend/src/lib/contentFactoryUtils.ts`
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`
- Modify `frontend/src/components/content-factory/ContentFactoryMetricDialog.tsx`
- Modify `frontend/src/components/content-factory/ContentFactoryMetricHistory.tsx`
- Modify `frontend/src/components/content-factory/ContentFactoryEffectivenessTable.tsx`
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

## Phase 1: Plan And Failing Guards

- [x] Create Sprint 21 design and implementation plan.
- [x] Add helper tests for metric window, source, confidence labels, and presets.
- [x] Add source guards for metric dialog/history/effectiveness surfaces.
- [x] Run focused tests once and confirm they fail before implementation.

## Phase 2: Shared Metric Labels

- [x] Add `CF_METRIC_WINDOW_LABELS`.
- [x] Add `CF_METRIC_SOURCE_LABELS`.
- [x] Add `CF_CONFIDENCE_LABELS`.
- [x] Add `CONTENT_FACTORY_METRIC_PRESETS`.

## Phase 3: Metric Capture UI

- [x] Use shared labels in `ContentFactoryMetricDialog` selects.
- [x] Add quick metric-name preset buttons.
- [x] Use shared labels in metric history rows.
- [x] Use shared labels in effectiveness latest-metric badges.

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
