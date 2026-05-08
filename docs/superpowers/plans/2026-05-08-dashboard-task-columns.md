# Dashboard Task Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render overdue and active dashboard tasks as readable internal columns on desktop while keeping a stacked, no-scroll mobile layout.

**Architecture:** Keep the existing dashboard data flow and task grouping helper. Update the dashboard task block presenter so each visible group owns its own preview, expansion button, and responsive layout. Guard the behavior with the existing source-level dashboard test file, then verify the full frontend.

**Tech Stack:** Next.js 14, React state, TypeScript, Tailwind CSS, Node `node:test`.

---

## File Structure

- Modify `frontend/src/app/dashboardCompletedWeekCard.test.ts`: add source guards for the responsive grouped-column task block, universal explanatory copy, and no-overdue badge guard.
- Modify `frontend/src/app/page.tsx`: add group expansion state and render visible dashboard task groups as internal responsive columns.
- Modify `docs/STATUS.md`: record implementation progress and verification results after code changes are complete.

No backend files change. No API or database changes are needed because the current frontend already receives grouped open tasks through `splitDashboardOpenTasks`.

---

### Task 1: Add Frontend Source Guards

**Files:**
- Modify: `frontend/src/app/dashboardCompletedWeekCard.test.ts`

- [ ] **Step 1: Add the failing dashboard layout guard**

Append these tests to `frontend/src/app/dashboardCompletedWeekCard.test.ts`:

```ts
test("dashboard task block uses responsive grouped columns and universal ordering copy", () => {
  const source = readSource("app/page.tsx");
  const block = source.match(
    /function DashboardTaskBlock[\s\S]*?function DashboardActivityCard/,
  );

  assert.ok(block, "dashboard task block source should exist");
  assert.match(source, /type DashboardTaskGroupKey = "overdue" \| "active"/);
  assert.match(block[0], /groupExpansion/);
  assert.match(block[0], /xl:grid-cols-2/);
  assert.match(block[0], /md:grid-cols-2/);
  assert.match(block[0], /dashboard-\$\{blockKey\}-\$\{group.key\}-tasks/);
  assert.match(
    source,
    /Задачи сгруппированы по состоянию и отсортированы по срочности\./,
  );
  assert.doesNotMatch(source, /Сначала просроченные/);
});

test("dashboard task badges avoid a red zero-overdue state", () => {
  const source = readSource("app/page.tsx");
  const badgeBlock = source.match(
    /const taskBadges: BadgeInfo\[] = \[[\s\S]*?const scopedMeetingsTotal/,
  );

  assert.ok(badgeBlock, "task badge source should exist");
  assert.match(
    badgeBlock[0],
    /if \(scopedOpenTaskGroups\.overdue\.length > 0\)/,
  );
  assert.doesNotMatch(badgeBlock[0], /value:\s*0/);
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/app/dashboardCompletedWeekCard.test.ts
```

Expected: FAIL with an `AssertionError` because `DashboardTaskGroupKey`, `groupExpansion`, the new explanatory copy, and grouped-column classes are not implemented yet.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
git add frontend/src/app/dashboardCompletedWeekCard.test.ts
git commit -m "test: guard dashboard task column layout"
```

---

### Task 2: Implement Responsive Dashboard Task Groups

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Test: `frontend/src/app/dashboardCompletedWeekCard.test.ts`

- [ ] **Step 1: Add dashboard task group types**

In `frontend/src/app/page.tsx`, replace:

```ts
type DashboardTaskBlockKey = "tasks";
type ActivityMetricKey = "completed" | "created" | "in_progress_over_7_days";
```

with:

```ts
type DashboardTaskBlockKey = "tasks";
type DashboardTaskGroupKey = "overdue" | "active";
type DashboardTaskItemVariant = "default" | "overdue" | "completed";
type ActivityMetricKey = "completed" | "created" | "in_progress_over_7_days";

type DashboardTaskGroup = {
  key: DashboardTaskGroupKey;
  title: string;
  tasks: Task[];
  itemVariant: DashboardTaskItemVariant;
};
```

- [ ] **Step 2: Replace the grouped rendering logic**

In `frontend/src/app/page.tsx`, replace the `DashboardTaskBlock` function with this implementation:

```tsx
function DashboardTaskBlock({
  blockKey,
  title,
  icon,
  iconColor,
  badges,
  tasks,
  expanded,
  onExpandedChange,
  groupExpansion,
  onGroupExpansionChange,
  emptyContent,
  itemVariant,
  showAssignee,
  orderingHint,
  truncated,
  truncationMessage,
  linkHref,
  linkLabel,
  groups,
}: {
  blockKey: DashboardTaskBlockKey;
  title: string;
  icon: ElementType;
  iconColor?: string;
  badges?: BadgeInfo[];
  tasks: Task[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  groupExpansion?: Record<DashboardTaskGroupKey, boolean>;
  onGroupExpansionChange?: (
    groupKey: DashboardTaskGroupKey,
    expanded: boolean,
  ) => void;
  emptyContent: ReactNode;
  itemVariant: DashboardTaskItemVariant;
  showAssignee: boolean;
  orderingHint: string;
  truncated?: boolean;
  truncationMessage?: string;
  linkHref?: string;
  linkLabel?: string;
  groups?: DashboardTaskGroup[];
}) {
  const visibleTasks = getDashboardTaskPreview(tasks, expanded);
  const hiddenCount = Math.max(0, tasks.length - DASHBOARD_TASK_PREVIEW_LIMIT);
  const listId = `dashboard-${blockKey}-tasks`;
  const canExpand = tasks.length > DASHBOARD_TASK_PREVIEW_LIMIT;
  const visibleGroups = groups
    ?.filter((group) => group.tasks.length > 0)
    .map((group) => {
      const groupExpanded = groupExpansion?.[group.key] ?? expanded;
      return {
        ...group,
        expanded: groupExpanded,
        visibleTasks: getDashboardTaskPreview(group.tasks, groupExpanded),
        hiddenCount: Math.max(
          0,
          group.tasks.length - DASHBOARD_TASK_PREVIEW_LIMIT,
        ),
        canExpand: group.tasks.length > DASHBOARD_TASK_PREVIEW_LIMIT,
        listId: `dashboard-${blockKey}-${group.key}-tasks`,
      };
    });
  const hasVisibleGroups = Boolean(visibleGroups?.length);
  const groupLayoutClassName =
    visibleGroups && visibleGroups.length > 1
      ? "grid gap-4 xl:grid-cols-2"
      : "space-y-3";

  const setGroupExpanded = (
    groupKey: DashboardTaskGroupKey,
    nextExpanded: boolean,
  ) => {
    if (onGroupExpansionChange) {
      onGroupExpansionChange(groupKey, nextExpanded);
      return;
    }
    onExpandedChange(nextExpanded);
  };

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
        <>
          {emptyContent}
          {truncated && truncationMessage && (
            <p className="text-xs text-muted-foreground">
              {truncationMessage}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{orderingHint}</p>
          {hasVisibleGroups && visibleGroups ? (
            <div id={listId} className={groupLayoutClassName}>
              {visibleGroups.map((group) => {
                const headingId = `${group.listId}-heading`;
                const taskGridClassName =
                  visibleGroups.length === 1
                    ? "grid gap-3 md:grid-cols-2"
                    : "space-y-2";

                return (
                  <section
                    key={group.key}
                    aria-labelledby={headingId}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        id={headingId}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        {group.title}
                      </h3>
                      <span className="text-xs text-muted-foreground/70">
                        {group.tasks.length}
                      </span>
                    </div>
                    <div id={group.listId} className={taskGridClassName}>
                      {group.visibleTasks.map((task) => (
                        <TaskListItem
                          key={task.id}
                          task={task}
                          variant={group.itemVariant}
                          showAssignee={showAssignee}
                        />
                      ))}
                    </div>
                    {group.canExpand && (
                      <button
                        type="button"
                        aria-expanded={group.expanded}
                        aria-controls={group.listId}
                        onClick={() =>
                          setGroupExpanded(group.key, !group.expanded)
                        }
                        className="w-full rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                      >
                        {group.expanded
                          ? "Свернуть"
                          : `Показать ещё ${group.hiddenCount}`}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div id={listId} className="space-y-3">
              {visibleTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  variant={
                    itemVariant === "default" && isOverdue(task)
                      ? "overdue"
                      : itemVariant
                  }
                  showAssignee={showAssignee}
                />
              ))}
            </div>
          )}
          {truncated && truncationMessage && (
            <p className="text-xs text-muted-foreground">
              {truncationMessage}
            </p>
          )}
          {!hasVisibleGroups && canExpand && (
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

- [ ] **Step 3: Add group expansion state**

In `frontend/src/app/page.tsx`, after the existing `expandedTaskBlocks` state, add:

```ts
const [expandedTaskGroups, setExpandedTaskGroups] = useState<
  Record<DashboardTaskGroupKey, boolean>
>({
  overdue: false,
  active: false,
});
```

- [ ] **Step 4: Reset group expansion on scope changes**

In the `useEffect` that currently resets `expandedTaskBlocks`, update it to also reset grouped expansion:

```ts
useEffect(() => {
  setExpandedTaskBlocks({
    tasks: false,
  });
  setExpandedTaskGroups({
    overdue: false,
    active: false,
  });
  setSelectedActivityMetric(null);
  setDashboardActivity(null);
}, [currentScope, selectedDepartmentId]);
```

- [ ] **Step 5: Add the group expansion setter**

After `setTaskBlockExpanded`, add:

```ts
const setTaskGroupExpanded = (
  groupKey: DashboardTaskGroupKey,
  expanded: boolean,
) => {
  setExpandedTaskGroups((current) => ({
    ...current,
    [groupKey]: expanded,
  }));
};
```

- [ ] **Step 6: Update the dashboard task block props**

In the `DashboardTaskBlock` usage for scoped tasks, replace the old ordering hint and add group expansion props:

```tsx
expanded={expandedTaskBlocks.tasks}
onExpandedChange={(expanded) =>
  setTaskBlockExpanded("tasks", expanded)
}
groupExpansion={expandedTaskGroups}
onGroupExpansionChange={setTaskGroupExpanded}
emptyContent={
  <DashboardEmptyState
    icon={ClipboardList}
    title={emptyTaskTitle}
    description={emptyTaskDescription}
    iconContainerClassName="bg-primary/10"
    iconClassName="text-primary"
  />
}
itemVariant="default"
showAssignee={currentScope !== "my"}
orderingHint="Задачи сгруппированы по состоянию и отсортированы по срочности."
truncated={scopedTasksTruncated}
truncationMessage={`Загружены первые ${scopedTasks.length} задач; в полном списке может быть больше.`}
linkHref="/tasks"
linkLabel="На доску"
groups={[
  {
    key: "overdue",
    title: "Просрочено",
    tasks: scopedOpenTaskGroups.overdue,
    itemVariant: "overdue",
  },
  {
    key: "active",
    title: "Активные",
    tasks: scopedOpenTaskGroups.active,
    itemVariant: "default",
  },
]}
```

- [ ] **Step 7: Run the targeted test**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/app/dashboardCompletedWeekCard.test.ts
```

Expected: PASS for all tests in `dashboardCompletedWeekCard.test.ts`. Existing Node warnings about `MODULE_TYPELESS_PACKAGE_JSON` may appear.

- [ ] **Step 8: Run TypeScript**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 9: Commit the implementation**

Run:

```bash
git add frontend/src/app/page.tsx frontend/src/app/dashboardCompletedWeekCard.test.ts
git commit -m "Improve dashboard task column layout"
```

---

### Task 3: Verify and Record Completion

**Files:**
- Modify: `docs/STATUS.md`
- Read: `docs/superpowers/specs/2026-05-08-dashboard-task-columns-design.md`

- [ ] **Step 1: Run full frontend verification**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected:

- `npm test` passes, including `src/app/dashboardCompletedWeekCard.test.ts`.
- `npx tsc --noEmit` exits successfully.
- `npm run lint` exits successfully.
- `npm run build` completes a production build.
- `git diff --check` has no output.

- [ ] **Step 2: Update status**

In `docs/STATUS.md`, update the `Dashboard Task Column Layout` section:

```md
## Dashboard Task Column Layout

- Current phase: implemented; automated verification passed
- Spec: `docs/superpowers/specs/2026-05-08-dashboard-task-columns-design.md`
- Plan: `docs/superpowers/plans/2026-05-08-dashboard-task-columns.md`
- Scope: dashboard task-block internal grouping layout, explanatory copy, no-overdue state, and responsive behavior
- Latest progress:
  - Confirmed the current merged task block solves duplication but makes overdue task cards feel too stretched in the wide desktop layout.
  - Approved keeping overdue tasks inside the same task block while rendering `Просрочено` and `Активные` as separate internal columns on desktop.
  - Approved mobile behavior: stack groups vertically, with overdue tasks first.
  - Approved replacing the ordering hint with `Задачи сгруппированы по состоянию и отсортированы по срочности.`
  - Approved no-overdue behavior: hide the overdue group and red zero badge, avoid reserving an empty column, and let active tasks use the available width.
  - Implemented grouped dashboard task rendering with independent `Просрочено` and `Активные` expansion controls.
  - Verified the frontend source guard, TypeScript, lint, and production build.
- Key approved decisions:
  - The dashboard should not reintroduce a separate overdue card.
  - The right-side `Активность за 7 дней` card remains unchanged.
  - Empty task state remains the only content when there are no open tasks.
- Latest verification:
  - `cd frontend && npm test` passed.
  - `cd frontend && npx tsc --noEmit` passed.
  - `cd frontend && npm run lint` passed.
  - `cd frontend && npm run build` passed.
  - `git diff --check` passed.
```

- [ ] **Step 3: Commit status**

Run:

```bash
git add docs/STATUS.md
git commit -m "docs: record dashboard task columns verification"
```

---

## Final Validation

Before final handoff, run:

```bash
git status --short
```

Expected: no uncommitted files unless the user explicitly asks to leave changes unstaged.
