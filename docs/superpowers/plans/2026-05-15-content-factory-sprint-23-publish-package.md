# Content Factory Sprint 23 Publish Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a copy-ready manual publishing package to the publication detail page.

**Architecture:** This is a frontend-only slice. A pure helper in `contentFactoryUtils.ts` builds deterministic display rows and clipboard text, and a new publication detail component renders the package with a copy action.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node test runner, existing shadcn-style UI primitives, existing toast system, lucide-react icons.

---

## File Structure

- Modify `frontend/src/lib/contentFactoryUtils.test.ts` to add a failing helper test.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` to add route/component guards.
- Modify `frontend/src/lib/contentFactoryUtils.ts` to add `buildContentFactoryPublishPackage` and exported types.
- Create `frontend/src/components/content-factory/ContentFactoryPublicationPublishPackage.tsx` for the package panel.
- Modify `frontend/src/app/content-factory/publications/[id]/page.tsx` to pass publication, platform, format, bundle, segments, and targets into the panel.
- Update `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

## Task 1: Tests First

- [ ] Add a test named `publication publish package composes a copy-ready handoff` to `frontend/src/lib/contentFactoryUtils.test.ts`.
- [ ] Assert that the helper returns rows for `Канал`, `Формат`, `Кампания`, `План`, `Аудитории`, `UTM-метки`, `Текст`, and `Медиа`.
- [ ] Assert that `copyText` contains the body text, media reference, UTM JSON, and segment name.
- [ ] Add a source guard that checks `ContentFactoryPublicationPublishPackage.tsx`, `Пакет для публикации`, `Скопировать пакет`, `navigator.clipboard.writeText`, and route wiring.
- [ ] Run the focused command and verify the new tests fail because the helper/component do not exist yet:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

## Task 2: Pure Helper

- [ ] Add `ContentFactoryPublishPackageRow` and `ContentFactoryPublishPackage` types to `frontend/src/lib/contentFactoryUtils.ts`.
- [ ] Add `buildContentFactoryPublishPackage(input)` with minimal publication/reference input types.
- [ ] Format the planned time with `ru-RU` date/time formatting and fall back to `Без даты`.
- [ ] Format media, UTM, and audience lists without exposing raw object values unless the field itself is structured UTM JSON.
- [ ] Run the focused helper test and verify it passes.

## Task 3: UI Panel

- [ ] Create `ContentFactoryPublicationPublishPackage.tsx`.
- [ ] Render a compact card with the title `Пакет для публикации`, short explanatory text, summary rows, body preview, media preview, UTM preview, and `Скопировать пакет` button.
- [ ] Use the existing toast system for copy success and failure.
- [ ] Keep the panel readable on narrow screens with wrapping, max-height previews, and no nested cards.

## Task 4: Route Wiring

- [ ] Import the new component in `frontend/src/app/content-factory/publications/[id]/page.tsx`.
- [ ] Derive `format` next to `platform`.
- [ ] Render the package panel in the main publication detail column after the text panel and before media/materials.
- [ ] Pass `publication`, `platform`, `format`, `bundle`, `segments`, and `segmentTargets`.
- [ ] Run focused source guards and fix any wiring drift.

## Task 5: Durable Docs And Verification

- [ ] Make Sprint 23 the top active plan in `docs/PLAN.md`.
- [ ] Add Sprint 23 status notes to `docs/STATUS.md`.
- [ ] Add Sprint 23 automated and manual checks to `docs/TEST_PLAN.md`.
- [ ] Add Sprint 23 manual QA to `docs/BACKLOG.md`.
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
