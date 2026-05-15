# Content Factory Sprint 24 Calendar Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add operational readiness states and summary counts to the Content Factory calendar.

**Architecture:** This is a frontend-only change. Pure helpers in `contentFactoryUtils.ts` derive deterministic calendar state and summary data from existing publication fields, and `/content-factory/calendar` renders those signals without new API endpoints.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node test runner, existing Content Factory UI primitives, lucide-react icons.

---

## File Structure

- Modify `frontend/src/lib/contentFactoryUtils.test.ts` for failing state and summary tests.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` for route wiring guards.
- Modify `frontend/src/lib/contentFactoryUtils.ts` to add calendar state and summary helpers.
- Modify `frontend/src/app/content-factory/calendar/page.tsx` to render summary cards, state badges, action copy, and detail links.
- Update `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

## Task 1: Tests First

- [ ] Add a helper test named `calendar operations classify publication planning states`.
- [ ] Assert state keys and labels for overdue, today, ready, missing text, missing UTM, missing fact, published, cancelled, and unscheduled cases.
- [ ] Add a helper test named `calendar summary counts filtered operational signals`.
- [ ] Add a source guard that checks `summarizeContentFactoryCalendar`, `getContentFactoryCalendarPublicationState`, `Нужно действие`, `Готовы к выходу`, `Открыть`, and links to `/content-factory/publications/${publication.id}`.
- [ ] Run the focused test command and verify the new tests fail before implementation:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

## Task 2: Pure Helpers

- [ ] Add `ContentFactoryCalendarPublicationStateKey`, `ContentFactoryCalendarPublicationState`, and `ContentFactoryCalendarSummary` exports.
- [ ] Implement `getContentFactoryCalendarPublicationState(publication, now)`.
- [ ] Implement `summarizeContentFactoryCalendar(publications, now)`.
- [ ] Keep helper logic deterministic, with no API calls and no dependency on browser state.
- [ ] Run the focused helper test and verify it passes.

## Task 3: Calendar UI

- [ ] Import the new helpers in `frontend/src/app/content-factory/calendar/page.tsx`.
- [ ] Add a compact summary strip for today, overdue, ready, action-needed, and no-date counts.
- [ ] Add row-level state badges and short next-action copy.
- [ ] Add an `Открыть` button linking to `/content-factory/publications/${publication.id}`.
- [ ] Keep rows dense, scan-friendly, responsive, and free of overlapping text.

## Task 4: Durable Docs And Verification

- [ ] Make Sprint 24 the top active plan in `docs/PLAN.md`.
- [ ] Add Sprint 24 status notes to `docs/STATUS.md`.
- [ ] Add Sprint 24 automated and manual checks to `docs/TEST_PLAN.md`.
- [ ] Add Sprint 24 manual QA to `docs/BACKLOG.md`.
- [ ] Run full verification:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [ ] Commit, merge to `main`, and push.
