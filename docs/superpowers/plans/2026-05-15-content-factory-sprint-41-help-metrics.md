# Content Factory Sprint 41 Help For Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add detailed practical help for metric capture, effectiveness analytics, retrospectives, and reference data.

**Architecture:** Keep Sprint 41 frontend-only. Extend the existing static `/content-factory/help` route with structured arrays and one rendered section. Add a source-guard test that locks the user-facing concepts.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, Node test runner.

---

### Task 1: Guard Sprint 41 Help Content

**Files:**
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test near the existing help tests:

```ts
test("content factory help explains metrics effectiveness retrospectives and references", () => {
  const source = readSource("app/content-factory/help/page.tsx");

  assert.match(source, /Метрики, эффективность, ретроспективы и справочники/);
  assert.match(source, /Метрики фиксируют evidence, а не просто числа/);
  assert.match(source, /Эффективность показывает, где есть уверенные выводы/);
  assert.match(source, /Ретроспектива превращает результат в следующее решение/);
  assert.match(source, /Справочники держат язык системы единым/);
  assert.match(source, /источник/i);
  assert.match(source, /довер/i);
  assert.match(source, /3 часа, 24 часа, 72 часа, 7 дней/);
  assert.match(source, /не меняйте справочник/i);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because the help page does not yet contain the Sprint 41 metrics/effectiveness/retrospectives/references section.

### Task 2: Add Metrics, Effectiveness, Retrospective, And Reference Help

**Files:**
- Modify: `frontend/src/app/content-factory/help/page.tsx`

- [ ] **Step 1: Add icon imports**

Add `Database`, `Gauge`, and `History` from `lucide-react`.

- [ ] **Step 2: Add structured content arrays**

Add arrays for:

- `METRICS_LEARNING_HELP`
- `METRICS_LEARNING_FLOW`
- `METRICS_LEARNING_NOTES`

- [ ] **Step 3: Render the section**

Render a new section after the campaign/review/audience section and before the section directory. The section should include:

- heading `Метрики, эффективность, ретроспективы и справочники`;
- four practical cards;
- evidence-to-learning flow;
- common confusion notes.

- [ ] **Step 4: Run focused test and verify GREEN**

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

Set `docs/PLAN.md` to Sprint 41 with design, plan, definition of done, and validation commands.

- [ ] **Step 2: Update status, test plan, and backlog**

Record RED/GREEN progress, add Sprint 41 manual QA, and remove Sprint 41 from the immediate backlog.

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
git add docs/PLAN.md docs/STATUS.md docs/TEST_PLAN.md docs/BACKLOG.md docs/superpowers/specs/2026-05-15-content-factory-sprint-41-help-metrics-design.md docs/superpowers/plans/2026-05-15-content-factory-sprint-41-help-metrics.md frontend/src/app/content-factory/help/page.tsx frontend/src/components/content-factory/contentFactorySourceGuards.test.ts
git commit -m "feat(cf): add metrics learning help"
git switch main
git merge --ff-only codex/content-factory-sprint-41-help-metrics
git push origin main
```
