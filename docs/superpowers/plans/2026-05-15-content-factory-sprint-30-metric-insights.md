# Content Factory Sprint 30 Metric Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a publication-level metric insights panel that summarizes imported/manual metric snapshots on the publication detail page.

**Architecture:** Keep the sprint frontend-only. Add a pure helper in `contentFactoryUtils.ts`, a focused React component for rendering the summary, and wire it into the existing publication detail route before the metric history log.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, lucide-react, Node test runner.

---

## File Structure

- Modify `frontend/src/lib/contentFactoryUtils.ts` with metric insight types and `getContentFactoryPublicationMetricInsights`.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts` with helper tests.
- Create `frontend/src/components/content-factory/ContentFactoryMetricInsights.tsx`.
- Modify `frontend/src/app/content-factory/publications/[id]/page.tsx` to render the new component above `ContentFactoryMetricHistory`.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` to guard route/component wiring.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

## Task 1: Helper Tests

- [ ] Add failing helper tests for grouped latest/best values, window coverage, next action, and empty state in `frontend/src/lib/contentFactoryUtils.test.ts`.
- [ ] Run `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts` and confirm RED because the helper is missing.

## Task 2: Helper Implementation

- [ ] Add `ContentFactoryPublicationMetricInsights` types and implement `getContentFactoryPublicationMetricInsights(metrics)`.
- [ ] Sort metrics by `captured_at` descending, group by trimmed `metric_name`, and use `Метрика без названия` as fallback.
- [ ] Pick highest numeric `metric_value` as each group's best numeric value.
- [ ] Use `formatContentFactoryMetricValue` and existing metric window/source/confidence labels.
- [ ] Compute standard window coverage for `3h`, `24h`, `72h`, `7d`, and `final`.
- [ ] Compute next action from missing `24h`, `7d`, `final`, and low-confidence evidence.
- [ ] Run `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts` and confirm GREEN.

## Task 3: Component And Route Wiring

- [ ] Add failing source guard in `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` for `ContentFactoryMetricInsights`, `Сводка метрик`, helper usage, and publication detail wiring.
- [ ] Run `cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts` and confirm RED.
- [ ] Create `frontend/src/components/content-factory/ContentFactoryMetricInsights.tsx`.
- [ ] Render title, summary strip, metric group rows, window coverage chips, and empty state.
- [ ] Modify `frontend/src/app/content-factory/publications/[id]/page.tsx` to render `<ContentFactoryMetricInsights metrics={metrics} />` above `<ContentFactoryMetricHistory ... />`.
- [ ] Run `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts` and confirm GREEN.

## Task 4: Verification And Docs

- [ ] Run full frontend verification:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [ ] Update durable docs with verification results.
- [ ] Commit, merge to `main`, and push.
- [ ] Mark Sprint 30 as pushed in docs, commit, and push the final docs update.

## Self-Review

- Spec coverage: the plan covers helper logic, UI, route wiring, tests, docs, and verification.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: function and component names match the design.
