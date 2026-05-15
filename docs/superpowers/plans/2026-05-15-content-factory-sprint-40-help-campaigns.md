# Content Factory Sprint 40 Help For Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add detailed practical help for campaigns, review queue, audience registry, and audience analytics.

**Architecture:** Keep Sprint 40 frontend-only. Extend the existing static `/content-factory/help` route with structured arrays and rendered sections. Add a source-guard test that locks the user-facing concepts.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, Node test runner.

---

### Task 1: Guard Sprint 40 Help Content

**Files:**
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test near the existing help tests:

```ts
test("content factory help explains campaigns review queue and audiences", () => {
  const source = readSource("app/content-factory/help/page.tsx");

  assert.match(source, /Кампании, проверка и аудитории/);
  assert.match(source, /Кампания связывает смысл, сроки и публикации/);
  assert.match(source, /Очередь проверки показывает, где застрял материал/);
  assert.match(source, /Аудитории помогают не писать в пустоту/);
  assert.match(source, /Аналитика аудиторий показывает использование сегментов/);
  assert.match(source, /медицинск/i);
  assert.match(source, /GetCourse/);
  assert.match(source, /целевая, исключение, контрольная и ретаргетинг/);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because the help page does not yet contain the Sprint 40 campaigns/review/audience section.

### Task 2: Add Campaign, Review, And Audience Help Sections

**Files:**
- Modify: `frontend/src/app/content-factory/help/page.tsx`

- [ ] **Step 1: Add structured content arrays**

Add arrays for:

- `CAMPAIGN_REVIEW_AUDIENCE_HELP`
- `CAMPAIGN_REVIEW_AUDIENCE_FLOW`
- `CAMPAIGN_REVIEW_AUDIENCE_NOTES`

- [ ] **Step 2: Render the section**

Render a new section after the publication planning section and before the section directory. The section should include:

- heading `Кампании, проверка и аудитории`;
- four practical cards;
- a campaign planning flow;
- common confusion notes.

- [ ] **Step 3: Run focused test and verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

### Task 3: Update Durable Docs

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Update active plan**

Set `docs/PLAN.md` to Sprint 40 with design, plan, definition of done, and validation commands.

- [ ] **Step 2: Update status, test plan, and backlog**

Record RED/GREEN progress, add Sprint 40 manual QA, and remove Sprint 40 from the immediate backlog.

### Task 4: Full Verification And Integration

**Files:**
- No file changes expected after this task unless verification finds issues.

- [ ] **Step 1: Run full verification**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [ ] **Step 2: Commit, merge, and push**

Use:

```bash
git add docs/PLAN.md docs/STATUS.md docs/TEST_PLAN.md docs/BACKLOG.md docs/superpowers/specs/2026-05-15-content-factory-sprint-40-help-campaigns-design.md docs/superpowers/plans/2026-05-15-content-factory-sprint-40-help-campaigns.md frontend/src/app/content-factory/help/page.tsx frontend/src/components/content-factory/contentFactorySourceGuards.test.ts
git commit -m "feat(cf): add campaign review audience help"
git switch main
git merge --ff-only codex/content-factory-sprint-40-help-campaigns
git push origin main
```
