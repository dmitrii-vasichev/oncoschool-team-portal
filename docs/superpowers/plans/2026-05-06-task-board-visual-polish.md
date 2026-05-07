# Task Board Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the task creation dialog, task board cards, and empty Kanban columns according to the approved visual polish design.

**Architecture:** This is a frontend-only layout change. Keep existing task API fields and interactions, but change component state and markup in `CreateTaskDialog`, `TaskCard`, and the task board column renderers. Use existing Tailwind, Radix dialog/switch primitives, lucide icons, and current component patterns.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI dialog/switch primitives, lucide-react, existing frontend Node tests, TypeScript, ESLint, and Next build.

---

## Source Documents

- Approved design spec: `docs/superpowers/specs/2026-05-06-task-board-visual-polish-design.md`
- Active repo status: `docs/STATUS.md`
- Existing create dialog: `frontend/src/components/tasks/CreateTaskDialog.tsx`
- Existing task card: `frontend/src/components/tasks/TaskCard.tsx`
- Existing task board columns: `frontend/src/app/tasks/page.tsx`

## Scope Check

This plan covers one cohesive frontend visual polish pass. The work touches three visible areas of the same task board workflow and does not require backend, database, API, bot, analytics, or task detail changes.

## File Structure

- Modify `frontend/src/components/tasks/CreateTaskDialog.tsx`: compact the dialog, collapse description by default, place labels and urgency on one row, and keep urgency as an off-by-default switch.
- Modify `frontend/src/components/tasks/TaskCard.tsx`: remove the visible footer `Срочно` badge, expose urgency accessibly, and reduce reserved title/source space before checklist previews.
- Modify `frontend/src/app/tasks/page.tsx`: replace noisy empty-state illustration/copy with a quiet dashed drop-zone surface for empty columns.
- Modify `docs/STATUS.md`: record implementation progress and verification commands after the code changes are complete.
- Modify `docs/TEST_PLAN.md`: add the manual/browser checks for this visual polish pass.

## Task 1: Compact New Task Dialog

**Files:**

- Modify: `frontend/src/components/tasks/CreateTaskDialog.tsx`

- [ ] **Step 1: Add collapsed description state**

In `CreateTaskDialog`, add a state flag beside the existing `description` state:

```tsx
const [description, setDescription] = useState("");
const [descriptionOpen, setDescriptionOpen] = useState(false);
```

Update `resetForm()` so closing or successful creation resets the collapsed state:

```tsx
function resetForm() {
  setTitle("");
  setDescription("");
  setDescriptionOpen(false);
  setLabels([]);
  setPriority("normal");
  setChecklist([]);
  setNewChecklistItem("");
  setAssigneeId(canAssignToOthers ? "" : currentUser.id);
  setDeadline("");
  setError(null);
}
```

- [ ] **Step 2: Import a disclosure icon**

Add `ChevronDown` to the lucide import list:

```tsx
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
```

- [ ] **Step 3: Remove normal desktop dialog scrolling and tighten vertical rhythm**

Replace the `DialogContent` class:

```tsx
<DialogContent className="max-h-[calc(100vh-1.5rem)] overflow-y-auto backdrop-blur-sm sm:max-h-none sm:max-w-[560px] sm:overflow-visible">
```

Replace the form spacing:

```tsx
<form onSubmit={handleSubmit} className="space-y-3.5">
```

Keep the mobile/very-small viewport overflow as a fallback so the modal cannot become unreachable on narrow screens, while desktop does not show the internal scroll in normal use.

- [ ] **Step 4: Replace always-visible description textarea with a collapsible section**

Replace the current description block:

```tsx
{/* Description */}
<div className="space-y-2">
  <Label htmlFor="create-desc" className="text-sm font-medium">
    Описание
  </Label>
  <Textarea
    id="create-desc"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Подробности задачи..."
    rows={3}
    className="bg-muted/30 border-border/60 focus:bg-card resize-none min-h-[80px]"
  />
</div>
```

with:

```tsx
<div className="space-y-2">
  <button
    type="button"
    aria-expanded={descriptionOpen}
    aria-controls="create-desc"
    onClick={() =>
      setDescriptionOpen((open) =>
        open && !description.trim() ? false : true
      )
    }
    className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/40"
  >
    <span>Описание</span>
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {descriptionOpen ? "Открыто" : "Добавить"}
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform ${
          descriptionOpen ? "rotate-180" : ""
        }`}
      />
    </span>
  </button>

  {descriptionOpen && (
    <Textarea
      id="create-desc"
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      placeholder="Подробности задачи..."
      rows={2}
      className="min-h-[68px] resize-none border-border/60 bg-muted/30 focus:bg-card"
    />
  )}
</div>
```

Expected behavior:

- description is collapsed by default;
- clicking the row opens the textarea;
- when the textarea has text, it stays open until the dialog closes or resets;
- if the textarea is open and empty, clicking the row can collapse it.

- [ ] **Step 5: Put labels and urgency on one row**

Replace the separate labels and urgency blocks:

```tsx
<div className="space-y-2">
  <Label className="text-sm font-medium">Метки</Label>
  <TaskLabelPicker
    value={labels}
    onChange={setLabels}
    disabled={saving}
    placeholder="Добавить метки"
  />
</div>

<div className="space-y-2">
  <Label htmlFor="create-urgent" className="text-sm font-medium">
    Срочность
  </Label>
  <div
    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
      priority === "urgent"
        ? "border-priority-urgent-dot/60 bg-priority-urgent-bg text-priority-urgent-fg"
        : "border-border/60 bg-muted/30"
    }`}
  >
    <span className="text-sm font-medium">
      {priority === "urgent" ? "Срочная" : "Обычная"}
    </span>
    <Switch
      id="create-urgent"
      checked={priority === "urgent"}
      onCheckedChange={(checked) =>
        setPriority(checked ? "urgent" : "normal")
      }
      disabled={saving}
    />
  </div>
</div>
```

with:

```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
  <div className="space-y-2">
    <Label className="text-sm font-medium">Метки</Label>
    <TaskLabelPicker
      value={labels}
      onChange={setLabels}
      disabled={saving}
      placeholder="Добавить метки"
    />
  </div>

  <div className="space-y-2">
    <Label htmlFor="create-urgent" className="text-sm font-medium">
      Срочная задача
    </Label>
    <div
      className={`flex h-10 items-center justify-between gap-2 rounded-lg border px-3 ${
        priority === "urgent"
          ? "border-priority-urgent-dot/60 bg-priority-urgent-bg text-priority-urgent-fg"
          : "border-border/60 bg-muted/30 text-muted-foreground"
      }`}
    >
      <span className="text-sm font-medium">
        {priority === "urgent" ? "Вкл." : "Выкл."}
      </span>
      <Switch
        id="create-urgent"
        checked={priority === "urgent"}
        onCheckedChange={(checked) =>
          setPriority(checked ? "urgent" : "normal")
        }
        disabled={saving}
        aria-label="Срочная задача"
      />
    </div>
  </div>
</div>
```

Expected behavior:

- labels and urgency share one row on desktop dialog width;
- they stack on narrow widths;
- urgency is off by default and writes `normal`;
- enabling it writes `urgent`.

- [ ] **Step 6: Compact checklist controls**

In the checklist input row, replace the add button body:

```tsx
<Button
  type="button"
  variant="outline"
  onClick={addChecklistItem}
  disabled={saving || !newChecklistItem.trim()}
  className="h-10 gap-1.5 border-border/60"
>
  <Plus className="h-4 w-4" />
  Добавить
</Button>
```

with an icon-only button:

```tsx
<Button
  type="button"
  variant="outline"
  size="icon"
  onClick={addChecklistItem}
  disabled={saving || !newChecklistItem.trim()}
  className="h-10 w-10 shrink-0 border-border/60"
  aria-label="Добавить пункт чек-листа"
>
  <Plus className="h-4 w-4" />
</Button>
```

Expected behavior: the checklist row uses less horizontal space and still has an accessible add action.

- [ ] **Step 7: Run frontend validation for the dialog change**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: TypeScript check passes.

Run:

```bash
cd frontend && npm run lint
```

Expected: ESLint passes.

Do not commit yet; Task 2 and Task 3 complete the visual feature.

## Task 2: Tighten Task Board Cards

**Files:**

- Modify: `frontend/src/components/tasks/TaskCard.tsx`

- [ ] **Step 1: Replace fixed title height with a smaller minimum height**

Replace the current `titleClass` definition:

```tsx
const titleClass = `h-[3.75rem] overflow-hidden line-clamp-3 break-words [overflow-wrap:anywhere] text-sm leading-5 font-heading font-semibold ${
  overdue
    ? "text-destructive group-hover:text-destructive"
    : "group-hover:text-primary"
}`;
```

with:

```tsx
const titleClass = `min-h-10 overflow-hidden line-clamp-3 break-words [overflow-wrap:anywhere] text-sm leading-5 font-heading font-semibold ${
  overdue
    ? "text-destructive group-hover:text-destructive"
    : "group-hover:text-primary"
}`;
```

Expected behavior: one-line titles no longer reserve a full three-line block before checklist previews.

- [ ] **Step 2: Render source metadata only when a source icon exists**

Add a local `sourceIcon` constant before `return`:

```tsx
const sourceIcon =
  task.source === "voice" ? (
    <span
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-purple-100 dark:bg-purple-900/30"
      title="Голосовая задача"
    >
      <Mic className="h-2 w-2 text-purple-600 dark:text-purple-400" />
    </span>
  ) : task.source === "summary" ? (
    <span
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-blue-100 dark:bg-blue-900/30"
      title="Из встречи"
    >
      <FileText className="h-2 w-2 text-blue-600 dark:text-blue-400" />
    </span>
  ) : null;
```

Then replace the always-rendered source row:

```tsx
<div className="flex h-3.5 items-center gap-1">
  {task.source === "voice" && (
    <span
      className="inline-flex items-center justify-center h-3.5 w-3.5 rounded bg-purple-100 dark:bg-purple-900/30"
      title="Голосовая задача"
    >
      <Mic className="h-2 w-2 text-purple-600 dark:text-purple-400" />
    </span>
  )}
  {task.source === "summary" && (
    <span
      className="inline-flex items-center justify-center h-3.5 w-3.5 rounded bg-blue-100 dark:bg-blue-900/30"
      title="Из встречи"
    >
      <FileText className="h-2 w-2 text-blue-600 dark:text-blue-400" />
    </span>
  )}
</div>
```

with:

```tsx
{sourceIcon && (
  <div className="flex h-3.5 items-center gap-1">
    {sourceIcon}
  </div>
)}
```

Expected behavior: normal web tasks do not reserve an empty metadata row between title and checklist.

- [ ] **Step 3: Remove the visible urgent footer badge**

Delete this footer block:

```tsx
{urgent && (
  <span className="rounded-full bg-priority-urgent-bg px-2 py-0.5 text-2xs font-medium text-priority-urgent-fg ring-1 ring-inset ring-priority-urgent-dot/35">
    Срочно
  </span>
)}
```

Keep the red left edge block unchanged:

```tsx
{urgent && (
  <div className="absolute inset-y-0 left-0 w-1 bg-priority-urgent-dot" />
)}
```

Expected behavior: urgent board cards have the red left edge but no footer `Срочно` chip.

- [ ] **Step 4: Expose urgent state accessibly without taking footer space**

Add `aria-label` to the `Link`:

```tsx
<Link
  href={`/tasks/${task.short_id}`}
  aria-label={`${task.title}${urgent ? ", срочная задача" : ""}`}
  className="block h-full"
  draggable={false}
>
```

Expected behavior: assistive technology can still announce urgency even though the visual footer badge is removed.

- [ ] **Step 5: Give assignee names the recovered footer space**

Replace the assignee name span:

```tsx
<span className="text-xs text-muted-foreground truncate max-w-[120px]">
  {task.assignee.full_name}
</span>
```

with:

```tsx
<span className="max-w-[150px] truncate text-xs text-muted-foreground">
  {task.assignee.full_name}
</span>
```

Expected behavior: names like `Оксана Гончарук` are less likely to truncate after the urgent chip is removed.

- [ ] **Step 6: Run frontend validation for the card change**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: TypeScript check passes.

Run:

```bash
cd frontend && npm run lint
```

Expected: ESLint passes.

Do not commit yet; Task 3 completes the visual feature.

## Task 3: Replace Empty Column Noise With Quiet Drop Zone

**Files:**

- Modify: `frontend/src/app/tasks/page.tsx`

- [ ] **Step 1: Remove the unused empty-state import**

Delete this import:

```tsx
import { EmptyState } from "@/components/shared/EmptyState";
```

- [ ] **Step 2: Add a local empty column drop-zone component**

Add this component below `ColumnHeader`:

```tsx
function EmptyColumnDropZone({ active = false }: { active?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`
        min-h-[220px] rounded-xl border border-dashed transition-colors duration-150
        ${
          active
            ? "border-primary/35 bg-primary/5"
            : "border-border/45 bg-background/35"
        }
      `}
    />
  );
}
```

Expected behavior: the empty state has no visible text or illustration, only a subtle surface.

- [ ] **Step 3: Use the drop zone in the mobile/static column**

Replace:

```tsx
{tasks.length === 0 ? (
  <EmptyState variant="tasks" title="Нет задач" description="В этой колонке пока пусто" className="py-10" />
) : (
  tasks.map((task) => (
    <TaskCard key={task.id} task={task} />
  ))
)}
```

with:

```tsx
{tasks.length === 0 ? (
  <EmptyColumnDropZone />
) : (
  tasks.map((task) => <TaskCard key={task.id} task={task} />)
)}
```

Expected behavior: the mobile empty tab is quiet and does not show the old `Нет задач` text.

- [ ] **Step 4: Use the drop zone in the desktop draggable column**

Replace:

```tsx
{tasks.length === 0 && !isDragOver ? (
  <EmptyState variant="tasks" title="Нет задач" description="В этой колонке пока пусто" className="py-10" />
) : (
  tasks.map((task) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className={
        draggedTaskId === task.id ? "opacity-40 scale-[0.97]" : ""
      }
    >
      <TaskCard task={task} />
    </div>
  ))
)}
```

with:

```tsx
{tasks.length === 0 ? (
  <EmptyColumnDropZone active={isDragOver && Boolean(draggedTaskId)} />
) : (
  tasks.map((task) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className={
        draggedTaskId === task.id ? "opacity-40 scale-[0.97]" : ""
      }
    >
      <TaskCard task={task} />
    </div>
  ))
)}
```

Expected behavior:

- resting empty columns show only the quiet dashed drop-zone;
- dragging over an empty column makes the drop-zone slightly more visible;
- existing drop handling remains on the column container.

- [ ] **Step 5: Run frontend validation for empty columns**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: TypeScript check passes.

Run:

```bash
cd frontend && npm run lint
```

Expected: ESLint passes.

## Task 4: Documentation, Browser QA, and Final Verification

**Files:**

- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`

- [ ] **Step 1: Update implementation status**

In `docs/STATUS.md`, update the `Task Board Visual Polish` section:

```markdown
## Task Board Visual Polish

- Current phase: implemented, verification in progress
- Spec: `docs/superpowers/specs/2026-05-06-task-board-visual-polish-design.md`
- Plan: `docs/superpowers/plans/2026-05-06-task-board-visual-polish.md`
- Scope: frontend-only visual cleanup for the new task dialog, task board cards, checklist card spacing, and empty Kanban columns
- Latest progress:
  - New task dialog compact layout is implemented.
  - Description starts collapsed and expands on demand.
  - Labels and urgency share one row on desktop dialog widths.
  - Urgent board cards keep the red left edge and no longer show the footer `Срочно` badge.
  - Empty Kanban columns use a quiet dashed drop-zone instead of the old illustration and copy.
```

- [ ] **Step 2: Add manual checks to the test plan**

Append this section to `docs/TEST_PLAN.md`:

```markdown
## Task Board Visual Polish

Manual/browser checks:

- Open the new task dialog on desktop and confirm the create button is visible without internal dialog scrolling in the normal viewport.
- Confirm the description row starts collapsed, expands into a textarea, accepts text, and resets after closing the dialog.
- Confirm labels and urgency share one row on desktop and stack cleanly on narrow widths.
- Confirm urgency is off by default and switches between `normal` and `urgent` in the create payload.
- Confirm urgent task board cards show the red left edge and do not show the footer `Срочно` chip.
- Confirm the assignee name has more room on urgent cards with deadlines.
- Confirm checklist preview cards no longer show a large blank area between title and checklist.
- Confirm empty columns show a quiet dashed drop-zone instead of the old `Нет задач` illustration and copy.
- Drag a task over an empty column and confirm the drop-zone remains a visible target.
```

- [ ] **Step 3: Run full frontend verification**

Run:

```bash
cd frontend && npm test
```

Expected: existing frontend Node tests pass.

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: TypeScript check passes.

Run:

```bash
cd frontend && npm run lint
```

Expected: ESLint passes.

Run:

```bash
cd frontend && npm run build
```

Expected: production build passes.

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Run browser QA**

Start or reuse the frontend dev server:

```bash
cd frontend && npm run dev
```

Open the task board in the browser and check:

- create dialog has no internal scroll in normal desktop viewport;
- description is collapsed by default;
- labels and urgency share one row;
- urgent cards have the red edge and no footer `Срочно` chip;
- checklist card spacing is compact;
- empty columns show quiet dashed drop-zones;
- drag-over styling still appears on empty columns.

If authenticated browser QA is not possible in the current session, record that limitation in `docs/STATUS.md` and include it in the final response.

- [ ] **Step 5: Commit the implementation**

Stage only the files changed for this task:

```bash
git add frontend/src/components/tasks/CreateTaskDialog.tsx frontend/src/components/tasks/TaskCard.tsx frontend/src/app/tasks/page.tsx docs/STATUS.md docs/TEST_PLAN.md
```

Commit:

```bash
git commit -m "feat: polish task board visuals"
```

Expected: commit succeeds and contains only the visual polish implementation and related docs.
