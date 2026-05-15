# Content Factory Sprint 25 Review Queue Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add operational triage signals, summary counts, and clearer next actions to the Content Factory review queue.

**Architecture:** Keep Sprint 25 frontend-only. Extend `contentFactoryUtils.ts` with pure helper functions and consume them from `/content-factory/review`; use source guards to preserve route wiring and readable Russian labels.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Node test runner, lucide-react, Tailwind CSS.

---

## File Map

- Modify `frontend/src/lib/contentFactoryUtils.ts`: add review queue signal and summary types/helpers, and localize queue labels.
- Modify `frontend/src/lib/contentFactoryUtils.test.ts`: add RED tests for queue labels, item signals, and summary counts.
- Modify `frontend/src/app/content-factory/review/page.tsx`: render summary cards, signal pills, next-action blocks, and explicit open affordance.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: guard route/helper wiring and raw-label regressions.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, `docs/BACKLOG.md`: make Sprint 25 the durable current plan and record verification.

## Task 1: Helper Tests

**Files:**

- Modify: `frontend/src/lib/contentFactoryUtils.test.ts`

- [ ] **Step 1: Import the new helpers in the destructuring block**

```ts
  getContentFactoryReviewQueueGroups,
  getContentFactoryReviewQueueItemSignal,
```

```ts
  summarizeContentFactoryReviewQueue,
```

- [ ] **Step 2: Extend the queue grouping test to assert Russian labels**

Use the existing `getContentFactoryReviewQueueGroups groups review statuses` test and add:

```ts
  assert.deepEqual(
    groups.map((group) => [group.key, group.label]),
    [
      ["production", "Производство"],
      ["factcheck", "Фактчек"],
      ["doctor_review", "Проверка врача"],
      ["approval", "Готовы к расписанию"],
      ["scheduling", "В календаре"],
      ["failed", "Ошибки"],
    ],
  );
```

- [ ] **Step 3: Add a failing test for item signals**

```ts
test("getContentFactoryReviewQueueItemSignal describes review next actions", () => {
  const now = new Date("2026-05-15T12:00:00Z");
  const cases = [
    { id: "copy", status: "needs_copy", scheduled_at: null },
    { id: "design", status: "needs_design", scheduled_at: null },
    { id: "fact", status: "factcheck", scheduled_at: null },
    { id: "doctor", status: "doctor_review", scheduled_at: null },
    { id: "approved-missing-date", status: "approved", scheduled_at: null },
    {
      id: "scheduled-overdue",
      status: "scheduled",
      scheduled_at: "2026-05-14T10:00:00Z",
    },
    {
      id: "scheduled",
      status: "scheduled",
      scheduled_at: "2026-05-16T10:00:00Z",
    },
    { id: "failed", status: "failed", scheduled_at: null },
    { id: "cancelled", status: "cancelled", scheduled_at: null },
  ];

  assert.deepEqual(
    cases.map((publication) => {
      const signal = getContentFactoryReviewQueueItemSignal(publication, now);
      return [
        publication.id,
        signal.key,
        signal.label,
        signal.actionLabel,
        signal.urgent,
      ];
    }),
    [
      ["copy", "needs_copy", "Нужен текст", "Дописать текст", false],
      ["design", "needs_design", "Нужен дизайн", "Подготовить визуалы", false],
      ["fact", "factcheck", "Фактчек", "Проверить факты", false],
      ["doctor", "doctor_review", "Проверка врача", "Передать врачу", false],
      [
        "approved-missing-date",
        "needs_schedule",
        "Назначить дату",
        "Поставить в календарь",
        false,
      ],
      [
        "scheduled-overdue",
        "scheduled_overdue",
        "План просрочен",
        "Проверить выпуск",
        true,
      ],
      ["scheduled", "scheduled", "В календаре", "Проверить пакет", false],
      ["failed", "failed", "Ошибка публикации", "Разобрать ошибку", true],
      ["cancelled", "cancelled", "Отменено", "Открыть причину", false],
    ],
  );
});
```

- [ ] **Step 4: Add a failing test for summary counts**

```ts
test("summarizeContentFactoryReviewQueue counts triage buckets", () => {
  const summary = summarizeContentFactoryReviewQueue(
    [
      { status: "draft", scheduled_at: null },
      { status: "needs_copy", scheduled_at: null },
      { status: "factcheck", scheduled_at: null },
      { status: "doctor_review", scheduled_at: null },
      { status: "approved", scheduled_at: null },
      {
        status: "scheduled",
        scheduled_at: "2026-05-14T10:00:00Z",
      },
      { status: "failed", scheduled_at: null },
    ],
    new Date("2026-05-15T12:00:00Z"),
  );

  assert.deepEqual(summary, {
    total: 6,
    production: 1,
    medicalReview: 2,
    scheduling: 2,
    urgent: 2,
    needsAction: 6,
  });
});
```

- [ ] **Step 5: Run focused helper tests to verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: FAIL because `getContentFactoryReviewQueueItemSignal` and `summarizeContentFactoryReviewQueue` are not implemented yet.

## Task 2: Source Guard Tests

**Files:**

- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Strengthen the review queue source guard**

Update the `review queue route groups publications by workflow status` test to assert:

```ts
  const utilsSource = readSource("lib/contentFactoryUtils.ts");

  assert.match(source, /summarizeContentFactoryReviewQueue/);
  assert.match(source, /getContentFactoryReviewQueueItemSignal/);
  assert.match(source, /Сейчас нужно/);
  assert.match(source, /Срочно/);
  assert.match(source, /Открыть/);
  assert.match(utilsSource, /ContentFactoryReviewQueueItemSignal/);
  assert.match(utilsSource, /summarizeContentFactoryReviewQueue/);
  assert.doesNotMatch(utilsSource, /label:\s*"Approval"/);
  assert.doesNotMatch(utilsSource, /label:\s*"Scheduling"/);
  assert.doesNotMatch(utilsSource, /label:\s*"Failed"/);
```

- [ ] **Step 2: Run focused source guard tests to verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: FAIL because the route and utilities do not yet expose the new triage wiring.

## Task 3: Utility Implementation

**Files:**

- Modify: `frontend/src/lib/contentFactoryUtils.ts`

- [ ] **Step 1: Add exported signal and summary types near review queue types**

```ts
export type ContentFactoryReviewQueueSignalTone =
  | "warning"
  | "info"
  | "success"
  | "critical"
  | "muted";

export type ContentFactoryReviewQueueSignalKey =
  | "needs_copy"
  | "needs_design"
  | "factcheck"
  | "doctor_review"
  | "needs_schedule"
  | "approved"
  | "scheduled_overdue"
  | "scheduled"
  | "failed"
  | "cancelled"
  | "open";

export type ContentFactoryReviewQueueItemSignal = {
  key: ContentFactoryReviewQueueSignalKey;
  label: string;
  actionLabel: string;
  description: string;
  tone: ContentFactoryReviewQueueSignalTone;
  urgent: boolean;
  needsAction: boolean;
};

export type ContentFactoryReviewQueueSummary = {
  total: number;
  production: number;
  medicalReview: number;
  scheduling: number;
  urgent: number;
  needsAction: number;
};
```

- [ ] **Step 2: Localize `REVIEW_QUEUE_META` labels**

Use:

```ts
  { key: "factcheck", label: "Фактчек", statuses: ["factcheck"] },
  { key: "approval", label: "Готовы к расписанию", statuses: ["approved"] },
  { key: "scheduling", label: "В календаре", statuses: ["scheduled"] },
  { key: "failed", label: "Ошибки", statuses: ["failed"] },
  { key: "cancelled", label: "Отменены", statuses: ["cancelled"] },
```

- [ ] **Step 3: Implement `getContentFactoryReviewQueueItemSignal`**

Use `dateTime(publication.scheduled_at)` and `now.getTime()` to detect overdue scheduled items. Return the exact labels and actions from the tests.

- [ ] **Step 4: Implement `summarizeContentFactoryReviewQueue`**

Iterate publications, include only statuses present in the review queues, derive each signal, and increment the six summary fields.

- [ ] **Step 5: Run helper tests to verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts
```

Expected: PASS.

## Task 4: Review Page UI

**Files:**

- Modify: `frontend/src/app/content-factory/review/page.tsx`

- [ ] **Step 1: Import new helpers and icons**

Add:

```ts
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
```

Add helper imports:

```ts
  getContentFactoryReviewQueueItemSignal,
  summarizeContentFactoryReviewQueue,
```

- [ ] **Step 2: Add small UI helpers**

Add `ReviewSummaryCard`, `ReviewSignalPill`, and `reviewSignalToneClassName` above the page component.

- [ ] **Step 3: Derive the summary in the page component**

```ts
  const queueSummary = useMemo(
    () => summarizeContentFactoryReviewQueue(publications),
    [publications],
  );
```

- [ ] **Step 4: Render the summary strip after the header**

Render cards for `В очереди`, `Производство`, `Фактчек и врач`, `Расписание`, and `Срочно`.

- [ ] **Step 5: Render row-level triage**

Inside `queue.publications.map`, derive:

```ts
const signal = getContentFactoryReviewQueueItemSignal(publication);
```

Render `<ReviewSignalPill signal={signal} />`, the `Сейчас нужно` block, and a compact `Открыть` affordance.

- [ ] **Step 6: Run source guards to verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

## Task 5: Full Verification And Docs

**Files:**

- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Run focused combined verification**

```bash
cd frontend && node --test --experimental-strip-types src/lib/contentFactoryUtils.test.ts src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full frontend verification**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected: PASS for every command.

- [ ] **Step 3: Update durable docs**

Make Sprint 25 the top active plan in `docs/PLAN.md`, add a top status entry in `docs/STATUS.md`, add automated/manual checks to `docs/TEST_PLAN.md`, and add manual QA to `docs/BACKLOG.md`.

- [ ] **Step 4: Commit, merge, and push**

```bash
git add docs frontend
git commit -m "feat(cf): add review queue triage"
git switch main
git merge --ff-only codex/content-factory-sprint-25-review-triage
git push origin main
```

