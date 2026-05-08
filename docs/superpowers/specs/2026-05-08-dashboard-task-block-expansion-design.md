# Dashboard Task Block Expansion Design

## Summary

The dashboard task blocks currently show only five tasks per block. This keeps the page compact, but it creates ambiguity: users cannot tell why those five tasks were chosen, and the `All tasks` link leads to the generic Kanban board rather than to the complete list represented by the dashboard block.

The approved direction is to keep the dashboard compact by default while allowing each task block to expand inline and show the complete list for that block.

## Current Behavior

- The active tasks block (`My tasks` or `Department tasks`) loads open tasks sorted by `created_at_desc` and renders the first five.
- The overdue block derives overdue tasks from the loaded active tasks and renders the first five.
- The completed-week block loads done tasks with `completed_since` and `sort=completed_at_desc`, filters them client-side for the same seven-day window, and renders the first five.
- The `All tasks` links point to `/tasks`, which opens the general Kanban board. The Kanban board does not preserve the dashboard block meaning, especially for `Completed in 7 days`.

## Goals

- Keep the dashboard task area compact on first load.
- Make each task block complete without requiring a navigation away from the dashboard.
- Make the preview rule understandable for active, overdue, and completed-week tasks.
- Preserve the current personal/department scope toggle behavior.
- Preserve task-card click-through to task detail pages.
- Avoid adding a new backend endpoint unless implementation shows the current paginated task API cannot safely support the required data.

## Non-Goals

- No redesign of the task Kanban board.
- No new saved task filter system.
- No change to task status semantics.
- No change to the seven-day completed task definition.
- No dashboard-wide layout redesign beyond the task blocks.
- No change to meeting, birthday, or unassigned-task dashboard sections.

## Approved Interaction

Each dashboard task block shows at most five tasks by default.

When the block has more than five tasks, the block footer shows an inline expansion control:

- collapsed state: `Show N more`;
- expanded state: `Collapse`;
- the control belongs to the block, not to the whole dashboard.

Expanding a block reveals the rest of that block's tasks directly below the first five. Collapsing returns the block to the five-task preview. Multiple blocks may be expanded independently if the implementation is simpler and the layout remains stable enough; limiting expansion to one block at a time is acceptable only if testing shows multiple expanded blocks make the dashboard too unwieldy.

The existing task item links remain unchanged: clicking a task opens the task detail page.

## Block Ordering Rules

The preview and expanded list must use the same ordering rule inside a block.

### Active Tasks

Active tasks include `new`, `in_progress`, and `review` statuses in the current dashboard scope.

Approved ordering:

1. urgent tasks first;
2. overdue tasks next within urgency;
3. nearest deadline first when a deadline exists;
4. newest created task first as the fallback.

This is more useful than showing only the newest created tasks because the dashboard is a work-prioritization surface.

### Overdue Tasks

Overdue tasks include active tasks whose deadline is before today in the current dashboard scope.

Approved ordering:

1. urgent tasks first;
2. oldest missed deadline first;
3. newest created task first as the fallback.

This makes the most overdue work visible first and removes the current ambiguity caused by inheriting active-task order.

### Completed in 7 Days

Completed-week tasks include tasks with status `done` and `completed_at` within the last seven days in the current dashboard scope.

Approved ordering:

1. most recently completed first;
2. newest updated task first as the fallback if completion timestamps tie.

This preserves the current completed-week intent while making the full list visible.

## Labels and Copy

Each block should expose a small, quiet ordering hint near the list or footer:

- active tasks: `First: urgent and nearest deadlines`;
- overdue tasks: `First: oldest overdue`;
- completed-week tasks: `First: recently completed`.

The exact Russian UI copy can be polished during implementation, but it must explain why the first five tasks are visible.

The `All tasks` link should not be the primary way to understand the block. It may remain as a secondary Kanban navigation action for active tasks. For the completed-week block, remove the generic `All tasks` link unless a filtered completed-week destination is implemented.

## Data Loading

The dashboard should load enough tasks for inline expansion to be truthful. The first implementation can use the existing `/api/tasks` pagination with `per_page=200` for each dashboard task query.

If the API reports a `total` greater than the loaded item count, the expanded block should make that clear with a fallback message such as `Showing first 200` and, where useful, a secondary board link. The UI should not imply that a truncated 200-item response is the full block.

The completed-week list must continue to use `completed_since` and `completed_at_desc`, with the frontend guard filter kept for consistency with the existing implementation.

## Component Scope

Primary frontend files:

- `frontend/src/app/page.tsx`
- `frontend/src/lib/dashboardTaskUtils.ts`
- `frontend/src/lib/dashboardTaskUtils.test.ts`
- `frontend/src/app/dashboardCompletedWeekCard.test.ts`

Potential supporting files:

- `frontend/src/lib/taskUrgency.ts` if the ordering helper should reuse urgency normalization;
- shared UI primitives only if the expansion control needs an existing button style.

Backend changes are not expected for the first implementation.

## Accessibility

The expand/collapse control must be keyboard accessible.

The control should expose expanded/collapsed state with `aria-expanded` and identify the block it controls with `aria-controls` if the resulting markup makes that practical.

Ordering hints should be visible text rather than tooltip-only content, because they answer a core product question.

## Testing

Automated validation:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Focused test expectations:

- dashboard active-task ordering puts urgent/overdue/deadline-sensitive tasks before generic newest tasks;
- dashboard overdue ordering uses urgency and oldest missed deadline;
- dashboard completed-week ordering remains most recently completed first;
- dashboard source tests no longer assert permanent `slice(0, 5)` rendering without expansion;
- completed-week filtering continues to exclude old, incomplete, missing-date, and invalid-date tasks.

Manual/browser validation:

- Open the dashboard with more than five active tasks and confirm only five show initially.
- Expand the active block and confirm all loaded active tasks for the current scope become visible.
- Collapse the active block and confirm the dashboard returns to the compact preview.
- Repeat expansion/collapse for overdue tasks.
- Repeat expansion/collapse for completed-week tasks and confirm completed tasks do not require going to the Kanban board.
- Switch between `My` and `Department` scope and confirm expanded lists, counts, and ordering update to the selected scope.
- Confirm task links still open task detail pages.
