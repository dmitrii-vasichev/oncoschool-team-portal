# Content Factory Sprint 36 Readiness Adaptations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adaptation readiness to the publication operations checklist.

**Architecture:** This is a frontend-only sprint. `getContentFactoryPublicationReadiness` receives optional variant coverage and returns one extra checklist item; `ContentFactoryPublicationOperationsPanel` derives coverage from saved variants passed by the publication detail route.

**Tech Stack:** Next.js, React, TypeScript, Node test runner, existing Content Factory UI utilities.

---

## Files

- Modify `frontend/src/lib/contentFactoryUtils.ts`: add `adaptations` readiness key and optional coverage handling.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`: add helper tests.
- Modify `frontend/src/components/content-factory/ContentFactoryPublicationOperationsPanel.tsx`: accept saved variants and pass coverage into readiness.
- Modify `frontend/src/app/content-factory/publications/[id]/page.tsx`: pass `variants` to the operations panel.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: guard route wiring and readable labels.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`: record Sprint 36.

## Tasks

### Task 1: Write failing tests

- [ ] Add helper test proving the checklist remains unchanged without coverage.
- [ ] Add helper test proving all-ready coverage inserts a ready `Адаптации` item.
- [ ] Add helper test proving missing/stale coverage inserts a missing `Адаптации` item.
- [ ] Add source guards for route wiring and operation panel coverage usage.
- [ ] Run focused frontend tests and confirm they fail before implementation.

### Task 2: Implement helper support

- [ ] Add `adaptations` to `ContentFactoryPublicationReadinessKey`.
- [ ] Add an optional coverage parameter to `getContentFactoryPublicationReadiness`.
- [ ] Insert the adaptation item after `UTM-метки` only when coverage is supplied.
- [ ] Use existing readiness badge statuses and Russian descriptions.

### Task 3: Wire the UI

- [ ] Add `savedVariants` prop to `ContentFactoryPublicationOperationsPanel`.
- [ ] Compute variant coverage with `getContentFactoryPublicationVariantCoverage`.
- [ ] Pass coverage into `getContentFactoryPublicationReadiness`.
- [ ] Pass `variants` from publication detail page into the operations panel.

### Task 4: Verify and finish

- [ ] Run focused frontend tests.
- [ ] Run full frontend tests.
- [ ] Run TypeScript, lint, build, and `git diff --check`.
- [ ] Update durable docs with verification results.

## Validation Commands

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```
