# Content Factory Sprint 15 Guest Attention Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guest story attention queue that shows which guest stories need action and what the next action is.

**Architecture:** Keep Sprint 15 frontend-only. Derive attention state from existing `CFGuestStory` fields in `contentFactoryUtils`, then display it in the guest list and detail page. Do not add backend schema or API changes.

**Tech Stack:** Next.js App Router, React, TypeScript, existing Content Factory API client, Node test runner, Tailwind utility classes, lucide-react icons.

---

### Task 1: Guest Attention Helper Tests

**Files:**
- Modify: `frontend/src/lib/contentFactoryUtils.test.ts`

- [ ] Add tests for `getContentFactoryGuestAttention`, `summarizeContentFactoryGuestStories`, `sortContentFactoryGuestStoriesByAttention`, and `filterContentFactoryGuestStories`.
- [ ] Run `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts`.
- [ ] Verify the tests fail before implementation because the new helper exports do not exist.

### Task 2: Guest Attention Helpers

**Files:**
- Modify: `frontend/src/lib/contentFactoryUtils.ts`

- [ ] Add a `ContentFactoryGuestAttentionReason` union and `ContentFactoryGuestAttention` type.
- [ ] Implement `getContentFactoryGuestAttention(story, now)`.
- [ ] Extend `ContentFactoryGuestStorySummary` with `attentionNeeded`.
- [ ] Extend `ContentFactoryGuestStoryFilters` with `attention`.
- [ ] Implement `sortContentFactoryGuestStoriesByAttention(stories, now)`.
- [ ] Re-run `cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts`.

### Task 3: Guest List UI

**Files:**
- Modify: `frontend/src/app/content-factory/guests/page.tsx`
- Modify: `frontend/src/components/content-factory/ContentFactoryGuestStoryTable.tsx`

- [ ] Add a "Требуют внимания" summary card.
- [ ] Add the attention filter next to existing filters.
- [ ] Sort the filtered guest list by attention priority.
- [ ] Show attention reason badges and next-action text on each row.
- [ ] Keep create/edit flows unchanged.

### Task 4: Guest Detail Attention Panel

**Files:**
- Create: `frontend/src/components/content-factory/ContentFactoryGuestAttentionPanel.tsx`
- Modify: `frontend/src/app/content-factory/guests/[id]/page.tsx`

- [ ] Add a focused detail panel showing the recommended next action.
- [ ] Show all attention reasons when attention is needed.
- [ ] Show a calm non-urgent state when no action is needed.

### Task 5: Source Guards And Verification

**Files:**
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/BACKLOG.md`

- [ ] Add source guards for the attention filter and detail attention panel.
- [ ] Update durable docs with Sprint 15 scope and validation.
- [ ] Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

### Task 6: Commit, Merge, Push

**Files:**
- All Sprint 15 files.

- [ ] Commit design/plan.
- [ ] Commit implementation.
- [ ] Fast-forward merge to `main`.
- [ ] Push `main`.
- [ ] Confirm production health after deployment if backend is affected. Sprint 15 is frontend-only, so backend migration health is not expected to change.
