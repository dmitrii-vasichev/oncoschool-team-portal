# Dashboard Task Block Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dashboard task blocks compact by default while allowing each block to expand inline and show every loaded task represented by that block.

**Architecture:** Add pure dashboard task helpers for ordering and preview slicing, then wire those helpers into the existing dashboard page through a reusable local task-block renderer. Keep the first implementation frontend-only, using the existing `/api/tasks` endpoint with `per_page=200` and explicit truncation copy if an API response reports more tasks than were loaded.

**Tech Stack:** Next.js 14 App Router, React 18 client components, TypeScript, Node test runner, existing task API client.

---

## File Structure

- Modify `frontend/src/lib/dashboardTaskUtils.ts`
  - Owns dashboard-specific task date parsing, ordering, completed-week filtering, and preview slicing.
  - Stays framework-free so it can be tested with `node --test --experimental-strip-types`.
- Modify `frontend/src/lib/dashboardTaskUtils.test.ts`
  - Covers active, overdue, completed-week, and preview helper behavior.
- Modify `frontend/src/app/page.tsx`
  - Uses sorted task arrays.
  - Tracks per-block expanded state.
  - Renders all three task cards through one local reusable block component.
  - Removes the generic `All tasks` link from the completed-week block.
- Modify `frontend/src/app/dashboardCompletedWeekCard.test.ts`
  - Updates source-level guard assertions from permanent five-item slicing to expandable block behavior.
- Modify `docs/PLAN.md`
  - Makes this feature the active repo plan and keeps previous active plan as prior context.
- Modify `docs/STATUS.md`
  - Records that the dashboard task expansion plan has been created and is ready for execution.

---

## Task 1: Add Dashboard Task Ordering and Preview Helpers

**Files:**
- Modify: `frontend/src/lib/dashboardTaskUtils.ts`
- Modify: `frontend/src/lib/dashboardTaskUtils.test.ts`

- [ ] **Step 1: Write failing tests for ordering and preview helpers**

Replace `frontend/src/lib/dashboardTaskUtils.test.ts` with this expanded test suite:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  completedSinceParam,
  filterTasksCompletedSince,
  getDashboardTaskPreview,
  sortDashboardActiveTasks,
  sortDashboardCompletedTasks,
  sortDashboardOverdueTasks,
} from "./dashboardTaskUtils.ts";

type TaskFixture = {
  id: string;
  status: string;
  priority: string;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function task(overrides: Partial<TaskFixture> & { id: string }): TaskFixture {
  return {
    status: "new",
    priority: "normal",
    deadline: null,
    completed_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
    ...overrides,
  };
}

test("completedSinceParam keeps the seven-day cutoff tied to the current time", () => {
  const now = new Date("2026-05-08T12:00:00.000Z");

  assert.equal(completedSinceParam(now), "2026-05-01T12:00:00.000Z");
});

test("filterTasksCompletedSince drops old or incomplete done tasks from API responses", () => {
  const completedSince = new Date("2026-05-01T12:00:00.000Z");
  const tasks = [
    task({ id: "feb", status: "done", completed_at: "2026-02-23T10:00:00.000Z" }),
    task({ id: "recent", status: "done", completed_at: "2026-05-06T10:00:00.000Z" }),
    task({ id: "boundary", status: "done", completed_at: "2026-05-01T12:00:00.000Z" }),
    task({ id: "open", status: "review", completed_at: "2026-05-06T10:00:00.000Z" }),
    task({ id: "missing", status: "done", completed_at: null }),
    task({ id: "invalid", status: "done", completed_at: "not-a-date" }),
  ];

  assert.deepEqual(
    filterTasksCompletedSince(tasks, completedSince).map((item) => item.id),
    ["recent", "boundary"],
  );
});

test("sortDashboardActiveTasks prioritizes urgent overdue and nearest deadlines", () => {
  const today = new Date("2026-05-08T12:00:00.000Z");
  const tasks = [
    task({ id: "newest-generic", created_at: "2026-05-08T11:00:00.000Z" }),
    task({ id: "normal-nearest", deadline: "2026-05-09", created_at: "2026-05-01T11:00:00.000Z" }),
    task({ id: "urgent-future", priority: "urgent", deadline: "2026-05-10", created_at: "2026-05-01T12:00:00.000Z" }),
    task({ id: "urgent-overdue", priority: "urgent", deadline: "2026-05-06", created_at: "2026-05-01T13:00:00.000Z" }),
    task({ id: "normal-overdue", deadline: "2026-05-05", created_at: "2026-05-01T14:00:00.000Z" }),
  ];

  assert.deepEqual(
    sortDashboardActiveTasks(tasks, today).map((item) => item.id),
    ["urgent-overdue", "urgent-future", "normal-overdue", "normal-nearest", "newest-generic"],
  );
});

test("sortDashboardOverdueTasks prioritizes urgent tasks then oldest missed deadline", () => {
  const tasks = [
    task({ id: "normal-newer-miss", deadline: "2026-05-07", created_at: "2026-05-03T10:00:00.000Z" }),
    task({ id: "urgent-newer-miss", priority: "urgent", deadline: "2026-05-06", created_at: "2026-05-02T10:00:00.000Z" }),
    task({ id: "normal-oldest-miss", deadline: "2026-05-01", created_at: "2026-05-04T10:00:00.000Z" }),
    task({ id: "urgent-oldest-miss", priority: "urgent", deadline: "2026-05-02", created_at: "2026-05-01T10:00:00.000Z" }),
  ];

  assert.deepEqual(
    sortDashboardOverdueTasks(tasks).map((item) => item.id),
    ["urgent-oldest-miss", "urgent-newer-miss", "normal-oldest-miss", "normal-newer-miss"],
  );
});

test("sortDashboardCompletedTasks keeps most recently completed first with updated fallback", () => {
  const tasks = [
    task({ id: "older-completion", status: "done", completed_at: "2026-05-04T10:00:00.000Z" }),
    task({
      id: "same-completion-newer-update",
      status: "done",
      completed_at: "2026-05-06T10:00:00.000Z",
      updated_at: "2026-05-06T12:00:00.000Z",
    }),
    task({
      id: "same-completion-older-update",
      status: "done",
      completed_at: "2026-05-06T10:00:00.000Z",
      updated_at: "2026-05-06T11:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    sortDashboardCompletedTasks(tasks).map((item) => item.id),
    ["same-completion-newer-update", "same-completion-older-update", "older-completion"],
  );
});

test("getDashboardTaskPreview returns five items when collapsed and every loaded item when expanded", () => {
  const tasks = Array.from({ length: 8 }, (_, index) =>
    task({ id: `task-${index + 1}` }),
  );

  assert.deepEqual(
    getDashboardTaskPreview(tasks, false).map((item) => item.id),
    ["task-1", "task-2", "task-3", "task-4", "task-5"],
  );
  assert.deepEqual(
    getDashboardTaskPreview(tasks, true).map((item) => item.id),
    ["task-1", "task-2", "task-3", "task-4", "task-5", "task-6", "task-7", "task-8"],
  );
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/dashboardTaskUtils.test.ts
```

Expected: FAIL because `getDashboardTaskPreview`, `sortDashboardActiveTasks`, `sortDashboardCompletedTasks`, and `sortDashboardOverdueTasks` are not exported yet.

- [ ] **Step 3: Implement the helper functions**

Replace `frontend/src/lib/dashboardTaskUtils.ts` with:

```ts
import { isTaskUrgent } from "./taskUrgency.ts";

export const DASHBOARD_TASK_PREVIEW_LIMIT = 5;

type DashboardTaskLike = {
  status: string;
  priority?: unknown;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CompletedTaskLike = Pick<
  DashboardTaskLike,
  "status" | "completed_at" | "updated_at"
>;

export function completedSinceParam(now = new Date()): string {
  const completedSince = new Date(now);
  completedSince.setDate(completedSince.getDate() - 7);
  return completedSince.toISOString();
}

function dateTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function localDateTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function completedAtTime(task: CompletedTaskLike): number | null {
  if (task.status !== "done" || !task.completed_at) return null;
  return dateTime(task.completed_at);
}

function urgencyRank(task: Pick<DashboardTaskLike, "priority">): number {
  return isTaskUrgent(task.priority) ? 0 : 1;
}

function isTaskOverdueForSort(
  task: Pick<DashboardTaskLike, "deadline" | "status">,
  today = new Date(),
): boolean {
  if (!task.deadline || task.status === "done" || task.status === "cancelled") {
    return false;
  }
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const deadlineTime = localDateTime(task.deadline);
  return deadlineTime !== null && deadlineTime < todayStart.getTime();
}

function newestCreatedFallback<T extends Pick<DashboardTaskLike, "created_at">>(
  a: T,
  b: T,
): number {
  return (dateTime(b.created_at) ?? 0) - (dateTime(a.created_at) ?? 0);
}

export function filterTasksCompletedSince<T extends CompletedTaskLike>(
  tasks: T[],
  completedSince: Date | string,
): T[] {
  const completedSinceTime = new Date(completedSince).getTime();
  if (Number.isNaN(completedSinceTime)) return [];

  return sortDashboardCompletedTasks(
    tasks.filter((task) => {
      const completedAt = completedAtTime(task);
      return completedAt !== null && completedAt >= completedSinceTime;
    }),
  );
}

export function sortDashboardActiveTasks<T extends DashboardTaskLike>(
  tasks: T[],
  today = new Date(),
): T[] {
  return [...tasks].sort((a, b) => {
    const urgentCompare = urgencyRank(a) - urgencyRank(b);
    if (urgentCompare !== 0) return urgentCompare;

    const overdueCompare =
      Number(!isTaskOverdueForSort(a, today)) -
      Number(!isTaskOverdueForSort(b, today));
    if (overdueCompare !== 0) return overdueCompare;

    const deadlineA = localDateTime(a.deadline);
    const deadlineB = localDateTime(b.deadline);
    if (deadlineA !== null && deadlineB !== null && deadlineA !== deadlineB) {
      return deadlineA - deadlineB;
    }
    if (deadlineA !== null && deadlineB === null) return -1;
    if (deadlineA === null && deadlineB !== null) return 1;

    return newestCreatedFallback(a, b);
  });
}

export function sortDashboardOverdueTasks<T extends DashboardTaskLike>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const urgentCompare = urgencyRank(a) - urgencyRank(b);
    if (urgentCompare !== 0) return urgentCompare;

    const deadlineA = localDateTime(a.deadline);
    const deadlineB = localDateTime(b.deadline);
    if (deadlineA !== null && deadlineB !== null && deadlineA !== deadlineB) {
      return deadlineA - deadlineB;
    }
    if (deadlineA !== null && deadlineB === null) return -1;
    if (deadlineA === null && deadlineB !== null) return 1;

    return newestCreatedFallback(a, b);
  });
}

export function sortDashboardCompletedTasks<T extends CompletedTaskLike>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const completedCompare =
      (completedAtTime(b) ?? 0) - (completedAtTime(a) ?? 0);
    if (completedCompare !== 0) return completedCompare;
    return (dateTime(b.updated_at) ?? 0) - (dateTime(a.updated_at) ?? 0);
  });
}

export function getDashboardTaskPreview<T>(
  tasks: T[],
  expanded: boolean,
  limit = DASHBOARD_TASK_PREVIEW_LIMIT,
): T[] {
  return expanded ? tasks : tasks.slice(0, limit);
}
```

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/dashboardTaskUtils.test.ts
```

Expected: PASS for all `dashboardTaskUtils` tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/dashboardTaskUtils.ts frontend/src/lib/dashboardTaskUtils.test.ts
git commit -m "Add dashboard task ordering helpers"
```

---

## Task 2: Add Expandable Dashboard Task Blocks

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Import the new helpers**

In `frontend/src/app/page.tsx`, extend the dashboard utils import:

```ts
import {
  DASHBOARD_TASK_PREVIEW_LIMIT,
  completedSinceParam,
  filterTasksCompletedSince,
  getDashboardTaskPreview,
  sortDashboardActiveTasks,
  sortDashboardOverdueTasks,
} from "@/lib/dashboardTaskUtils";
```

- [ ] **Step 2: Add task block types and preview component**

After `SectionHeader`, add this local component:

```tsx
type DashboardTaskBlockKey = "active" | "overdue" | "completed";

function DashboardTaskBlock({
  blockKey,
  title,
  icon,
  iconColor,
  badges,
  tasks,
  expanded,
  onExpandedChange,
  emptyContent,
  itemVariant,
  showAssignee,
  orderingHint,
  truncated,
  linkHref,
  linkLabel,
}: {
  blockKey: DashboardTaskBlockKey;
  title: string;
  icon: React.ElementType;
  iconColor?: string;
  badges?: BadgeInfo[];
  tasks: Task[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  emptyContent: React.ReactNode;
  itemVariant: "default" | "overdue" | "completed";
  showAssignee: boolean;
  orderingHint: string;
  truncated?: boolean;
  linkHref?: string;
  linkLabel?: string;
}) {
  const visibleTasks = getDashboardTaskPreview(tasks, expanded);
  const hiddenCount = Math.max(0, tasks.length - DASHBOARD_TASK_PREVIEW_LIMIT);
  const listId = `dashboard-${blockKey}-tasks`;
  const canExpand = tasks.length > DASHBOARD_TASK_PREVIEW_LIMIT;

  return (
    <>
      <SectionHeader
        title={title}
        icon={icon}
        iconColor={iconColor}
        badges={badges}
        linkHref={linkHref}
        linkLabel={linkLabel}
      />
      {tasks.length === 0 ? (
        emptyContent
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{orderingHint}</p>
          <div id={listId} className="space-y-2">
            {visibleTasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                variant={itemVariant === "default" && isOverdue(task) ? "overdue" : itemVariant}
                showAssignee={showAssignee}
              />
            ))}
          </div>
          {truncated && (
            <p className="text-xs text-muted-foreground">
              Показаны первые {tasks.length}; в списке может быть больше задач.
            </p>
          )}
          {canExpand && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => onExpandedChange(!expanded)}
              className="w-full rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {expanded ? "Свернуть" : `Показать ещё ${hiddenCount}`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Add expansion state in `DashboardPage`**

Near the other `useState` declarations in `DashboardPage`, add:

```tsx
const [expandedTaskBlocks, setExpandedTaskBlocks] = useState<
  Record<DashboardTaskBlockKey, boolean>
>({
  active: false,
  overdue: false,
  completed: false,
});
```

Then add this helper before the `return`:

```tsx
const setTaskBlockExpanded = (
  blockKey: DashboardTaskBlockKey,
  expanded: boolean,
) => {
  setExpandedTaskBlocks((current) => ({
    ...current,
    [blockKey]: expanded,
  }));
};
```

- [ ] **Step 4: Increase dashboard task API page size and sort loaded lists**

In `fetchData`, change each dashboard task `per_page` from `"50"` to `"200"` for:

```ts
getMyTasks
getDepartmentTasks
getMyCompletedWeekTasks
getDepartmentCompletedWeekTasks
```

Then replace the task state setters with sorted values:

```tsx
const sortedMyTasks = sortDashboardActiveTasks(myTaskItems);
const sortedDepartmentTasks = sortDashboardActiveTasks(departmentTaskItems);
const sortedMyOverdueTasks = sortDashboardOverdueTasks(sortedMyTasks.filter(isOverdue));
const sortedDepartmentOverdueTasks = sortDashboardOverdueTasks(
  sortedDepartmentTasks.filter(isOverdue),
);

setMyTasks(sortedMyTasks);
setMyOverdueTasks(sortedMyOverdueTasks);
setDepartmentTasks(sortedDepartmentTasks);
setDepartmentOverdueTasks(sortedDepartmentOverdueTasks);
setMyCompletedWeekTasks(myCompletedWeekItems);
setDepartmentCompletedWeekTasks(departmentCompletedWeekItems);
```

Do not sort completed-week items again in `page.tsx`; `filterTasksCompletedSince` already returns `sortDashboardCompletedTasks`.

- [ ] **Step 5: Replace the active task card contents**

Inside the active task card wrapper, replace the current `SectionHeader` plus conditional list with:

```tsx
<DashboardTaskBlock
  blockKey="active"
  title={taskListTitle}
  icon={Zap}
  badges={taskBadges}
  tasks={scopedTasks}
  expanded={expandedTaskBlocks.active}
  onExpandedChange={(expanded) => setTaskBlockExpanded("active", expanded)}
  emptyContent={
    <EmptyState
      variant="tasks"
      title={emptyTaskTitle}
      description={emptyTaskDescription}
      className="py-6"
    />
  }
  itemVariant="default"
  showAssignee={currentScope === "department"}
  orderingHint="Сначала срочные и ближайшие дедлайны"
  linkHref="/tasks"
  linkLabel="На доску"
/>
```

- [ ] **Step 6: Replace the overdue task card contents**

Inside the overdue task card wrapper, replace the current `SectionHeader` plus conditional list with:

```tsx
<DashboardTaskBlock
  blockKey="overdue"
  title={overdueListTitle}
  icon={AlertTriangle}
  iconColor={ACCENT_DESTRUCTIVE}
  badges={overdueBadges}
  tasks={scopedOverdueTasks}
  expanded={expandedTaskBlocks.overdue}
  onExpandedChange={(expanded) => setTaskBlockExpanded("overdue", expanded)}
  emptyContent={
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-done-bg">
        <CheckCircle2 className="h-5 w-5 text-status-done-fg" />
      </div>
      <p className="mb-0.5 text-sm font-heading font-semibold text-foreground">
        Всё в срок
      </p>
      <p className="text-xs text-muted-foreground">
        Нет просроченных задач
      </p>
    </div>
  }
  itemVariant="overdue"
  showAssignee={currentScope === "department"}
  orderingHint="Сначала срочные и самые старые просрочки"
/>
```

- [ ] **Step 7: Replace the completed-week task card contents**

Inside the completed task card wrapper, replace the current `SectionHeader` plus conditional list with:

```tsx
<DashboardTaskBlock
  blockKey="completed"
  title="Выполнено за 7 дней"
  icon={CheckCircle2}
  iconColor="hsl(var(--status-done-fg))"
  badges={completedWeekBadges}
  tasks={completedWeekTasks}
  expanded={expandedTaskBlocks.completed}
  onExpandedChange={(expanded) => setTaskBlockExpanded("completed", expanded)}
  emptyContent={
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-done-bg">
        <CheckCircle2 className="h-5 w-5 text-status-done-fg" />
      </div>
      <p className="mb-0.5 text-sm font-heading font-semibold text-foreground">
        Пока пусто
      </p>
      <p className="text-xs text-muted-foreground">
        За последнюю неделю задач не завершали
      </p>
    </div>
  }
  itemVariant="completed"
  showAssignee={currentScope === "department"}
  orderingHint="Сначала недавно выполненные"
/>
```

Do not pass `linkHref` to the completed block in this first implementation.

- [ ] **Step 8: Run TypeScript for the page changes**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS. If TypeScript reports a long line or JSX type issue, fix the local component signature rather than weakening task types.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "Add expandable dashboard task blocks"
```

---

## Task 3: Update Dashboard Source Guards

**Files:**
- Modify: `frontend/src/app/dashboardCompletedWeekCard.test.ts`

- [ ] **Step 1: Update the dashboard source test**

Replace `frontend/src/app/dashboardCompletedWeekCard.test.ts` with:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function readSource(relativePath: string) {
  return readFileSync(path.join(sourceRoot, relativePath), "utf8");
}

test("dashboard completed-week card is expandable instead of a dead-end five-task slice", () => {
  const source = readSource("app/page.tsx");

  assert.match(source, /completedInScopeThisWeek/);
  assert.match(source, /completedWeekTasks/);
  assert.match(source, /done_week/);
  assert.match(source, /completed_since/);
  assert.match(source, /filterTasksCompletedSince/);
  assert.match(source, /sort: "completed_at_desc"/);
  assert.match(source, /Выполнено за 7 дней/);
  assert.match(source, /За последнюю неделю задач не завершали/);
  assert.match(source, /DashboardTaskBlock/);
  assert.match(source, /blockKey="completed"/);
  assert.match(source, /expandedTaskBlocks\.completed/);
  assert.match(source, /getDashboardTaskPreview/);
  assert.match(source, /Показать ещё/);
  assert.match(source, /Свернуть/);
  assert.match(source, /Сначала недавно выполненные/);
  assert.match(source, /variant="completed"/);
  assert.doesNotMatch(source, /completedWeekTasks\.slice\(0, 5\)\.map/);
  assert.doesNotMatch(source, /Не обновлялись/);
  assert.doesNotMatch(source, /scopedStaleTasks/);
});
```

- [ ] **Step 2: Run the dashboard source guard**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/app/dashboardCompletedWeekCard.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboardCompletedWeekCard.test.ts
git commit -m "Update dashboard expansion source guard"
```

---

## Task 4: Finalize Repository Status Docs

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Mark the active plan as implemented after code verification**

In the `Dashboard Task Block Expansion` section of `docs/PLAN.md`, replace:

```md
**Implementation status:**

- Planned; ready for execution.
```

with:

```md
**Implementation status:**

- Implemented; automated verification passed.
- Frontend task ordering helpers, expandable dashboard task blocks, and dashboard source guards are implemented.
```

- [ ] **Step 2: Update `docs/STATUS.md` progress after verification**

In the `Dashboard Task Block Expansion` section of `docs/STATUS.md`, change `Current phase` to:

```md
- Current phase: implemented; automated verification passed
```

Append these bullets to `Latest progress`:

```md
  - Added dashboard task ordering and preview helpers.
  - Added inline expand/collapse controls to active, overdue, and completed-week dashboard task blocks.
  - Removed the misleading generic completed-week Kanban link.
  - Updated dashboard source guards.
```

Replace the `Latest verification` subsection with the actual command results from Task 5. If browser QA cannot reach authenticated dashboard data, add one bullet that states the unauthenticated route reached the login flow and authenticated expansion QA remains manual.

- [ ] **Step 3: Commit docs finalization**

```bash
git add docs/PLAN.md docs/STATUS.md
git commit -m "Update dashboard task expansion status"
```

---

## Task 5: Full Frontend Verification

**Files:**
- Verify only unless a failure requires a scoped fix.

- [ ] **Step 1: Run frontend tests**

Run:

```bash
cd frontend && npm test
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
cd frontend && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 5: Check whitespace**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 6: Commit verification fixes if needed**

If any verification step required code changes, commit those scoped fixes:

```bash
git add frontend/src/app/page.tsx frontend/src/lib/dashboardTaskUtils.ts frontend/src/lib/dashboardTaskUtils.test.ts frontend/src/app/dashboardCompletedWeekCard.test.ts docs/PLAN.md docs/STATUS.md
git commit -m "Fix dashboard task expansion verification issues"
```

If no fixes were needed, do not create an empty commit.

---

## Manual Browser QA

Run after automated verification:

```bash
cd frontend && npm run dev
```

Use the printed local URL, open `/dashboard` or `/` depending on the app shell route, and verify:

- each task block shows at most five tasks initially;
- each block with more than five tasks shows `Показать ещё N`;
- expanding active tasks reveals the loaded rest of the current-scope active list;
- expanding overdue tasks reveals the loaded rest of the current-scope overdue list;
- expanding completed-week tasks reveals the loaded rest of the completed-week list;
- `Свернуть` returns the block to five visible tasks;
- task links still open task detail pages;
- switching `Мои` / `Отдел` updates the lists and does not leave stale expanded content from the previous scope;
- the completed-week card has no misleading generic `Все задачи` link.

If authenticated local data is unavailable, document that browser QA reached the login flow and that authenticated expansion QA remains manual.

---

## Plan Self-Review

- Spec coverage: covered compact default view, inline expansion, ordering rules, completed-week discoverability, API loading limit, accessibility, source guards, docs, and verification.
- Placeholder scan: no `TBD`, `TODO`, or open-ended "add tests" steps remain.
- Type consistency: helper signatures use the fields present on `Task` and fixture tasks; page code imports the same helper names defined in Task 1.
