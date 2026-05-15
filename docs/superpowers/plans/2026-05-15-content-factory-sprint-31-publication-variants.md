# Content Factory Sprint 31 Publication Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frontend-only publication adaptations panel that produces copy-ready channel variants from the current publication text.

**Architecture:** Keep variants deterministic and client-side. Add a pure helper to build variant data, add a focused component for channel selection/preview/copy, and wire it into the existing publication detail route near the publish package.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind, lucide-react, Node test runner.

---

## File Structure

- Modify `frontend/src/lib/contentFactoryUtils.ts` with variant types and `buildContentFactoryPublicationVariants`.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts` with helper tests.
- Create `frontend/src/components/content-factory/ContentFactoryPublicationVariants.tsx`.
- Modify `frontend/src/app/content-factory/publications/[id]/page.tsx` to render the panel below `ContentFactoryPublicationPublishPackage`.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts` to guard component and route wiring.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`.

## Task 1: Helper Tests

- [x] Add failing tests in `frontend/src/lib/contentFactoryUtils.test.ts` for six copy-ready variants, UTM inclusion, and missing-body warnings.
- [x] Run `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts` and confirm RED because `buildContentFactoryPublicationVariants` is missing.

## Task 2: Helper Implementation

- [x] Add variant types and `buildContentFactoryPublicationVariants(input)`.
- [x] Produce variants for Telegram, VK, email, push, Max, and Dzen.
- [x] Keep all variants deterministic and based only on current publication fields.
- [x] Include UTM JSON in `copyText` when present.
- [x] Return readable missing-body warnings.
- [x] Run `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts` and confirm GREEN.

## Task 3: Component And Route Wiring

- [x] Add failing source guard in `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`.
- [x] Run `cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts` and confirm RED.
- [x] Create `frontend/src/components/content-factory/ContentFactoryPublicationVariants.tsx`.
- [x] Render channel selector, preview, metadata, warnings, and `Скопировать адаптацию`.
- [x] Wire `<ContentFactoryPublicationVariants publication={publication} platform={platform} format={format} bundle={bundle} />` below the publish package on the publication detail page.
- [x] Run `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts` and confirm GREEN.

## Task 4: Verification And Docs

- [x] Run full frontend verification:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [x] Update durable docs with verification results.
- [x] Commit, merge to `main`, and push.
- [x] Mark Sprint 31 as pushed in docs, commit, and push the final docs update.

## Self-Review

- Spec coverage: the plan covers helper logic, UI, route wiring, tests, docs, and verification.
- Placeholder scan: no placeholder tasks remain.
- Type consistency: helper and component names match the design.
