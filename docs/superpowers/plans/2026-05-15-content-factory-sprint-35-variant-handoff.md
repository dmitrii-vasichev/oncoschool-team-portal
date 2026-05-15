# Content Factory Sprint 35 Variant Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click copy package for all saved and current publication adaptations.

**Architecture:** This is a frontend-only sprint. A pure helper in `contentFactoryUtils.ts` builds a deterministic handoff package from the current publication and saved variants; `ContentFactoryPublicationVariants` renders one secondary copy action in the existing coverage block.

**Tech Stack:** Next.js, React, TypeScript, Node test runner, existing Content Factory UI utilities.

---

## Files

- Modify `frontend/src/lib/contentFactoryUtils.ts`: add `buildContentFactoryPublicationVariantHandoff`.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`: add helper tests for ready and empty handoff states.
- Modify `frontend/src/components/content-factory/ContentFactoryPublicationVariants.tsx`: render and handle `Скопировать готовые`.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: guard helper and UI wiring.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md`: record Sprint 35.

## Tasks

### Task 1: Write failing tests

- [ ] Add helper tests proving only ready variants are copied in channel order.
- [ ] Add helper tests proving no-ready state disables handoff.
- [ ] Add source guards for `buildContentFactoryPublicationVariantHandoff` and `Скопировать готовые`.
- [ ] Run focused frontend tests and confirm they fail because the helper and UI action do not exist yet.

### Task 2: Implement handoff helper

- [ ] Add typed input and output structures near the existing variant coverage types.
- [ ] Reuse `getContentFactoryPublicationVariantCoverage` to identify ready, missing, and stale channels.
- [ ] Build copy text with publication title, version, ready count, skipped channels, channel sections, notes, and UTM.
- [ ] Return `canCopy: false` and an empty copy text when no current saved variants exist.

### Task 3: Render handoff action

- [ ] Compute the handoff package in `ContentFactoryPublicationVariants`.
- [ ] Add `handleCopyReadyVariants`.
- [ ] Place `Скопировать готовые` inside the coverage block.
- [ ] Disable the action when `handoff.canCopy` is false.

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
