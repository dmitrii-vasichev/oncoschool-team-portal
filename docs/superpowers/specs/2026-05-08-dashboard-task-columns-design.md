# Dashboard Task Column Layout Design

## Summary

The dashboard task block already removes duplicate overdue tasks by grouping them inside the main scoped task area. The next refinement improves readability when many overdue tasks are present: overdue and active tasks should appear as separate internal columns on desktop while remaining one logical block.

This keeps the product model simple. The dashboard still answers one question in the task area: what open work needs attention in the selected scope. The layout only changes how the grouped work is presented.

## Goals

- Reduce the stretched-card feeling in the wide dashboard task block.
- Keep overdue tasks visually prominent without making them a separate dashboard card.
- Keep overdue and active tasks in one scoped task block.
- Preserve the existing activity card beside the task block.
- Make the mobile layout readable without horizontal scrolling.
- Avoid showing empty red UI when there are no overdue tasks.

## Non-Goals

- No change to overdue semantics.
- No change to task visibility, scope, or department access rules.
- No change to activity metrics.
- No modal or drawer for overdue tasks.
- No separate overdue dashboard card.

## Approved Layout

On desktop, the task block keeps its current outer position in the dashboard grid. Inside the block, task groups render as two internal columns when both groups have content:

- `Overdue`
- `Active`

Russian UI copy:

- `Просрочено`
- `Активные`

Each column owns its own task list and should keep compact dashboard task cards. The overdue column uses the existing overdue card treatment. The active column uses normal task-card styling unless a task has another state such as urgent.

The explanatory line should be updated to:

> Задачи сгруппированы по состоянию и отсортированы по срочности.

This copy works on desktop and mobile because it does not describe the layout using directional language such as left or right.

## No-Overdue State

If there are no overdue tasks:

- Do not show the `Просрочено` group.
- Do not show a `0 просрочено` red badge.
- Do not reserve an empty red column.
- Let the `Активные` group use the full task-block width.
- On desktop, active tasks may still render in an internal two-column card grid so cards do not stretch across the full block.

If there are no open tasks at all, the existing empty task state remains the only content inside the block. The group headings should not appear.

## Responsive Behavior

Desktop:

- When both overdue and active groups exist, render the groups as two internal columns.
- Keep the right-side `Активность за 7 дней` card unchanged.
- Each group should have its own heading and task stack.

Tablet:

- Use two internal columns only when there is enough width for readable task cards.
- Otherwise stack the groups vertically.

Mobile:

- Always stack groups vertically.
- Render `Просрочено` first, then `Активные`.
- Avoid horizontal scrolling.
- Keep task-card text clamped and metadata wrapped as it is today.

## Expansion Behavior

The task block should keep inline expansion. If implementation cost is reasonable, each group should expand independently:

- `Показать ещё N` inside `Просрочено`
- `Показать ещё N` inside `Активные`

If independent expansion creates unnecessary state complexity, a single block-level expansion is acceptable for the first implementation, as long as the two-column layout and no-overdue behavior remain correct.

## Accessibility

- Group headings must be visible text.
- Expand buttons must remain real buttons with `aria-expanded`.
- The explanatory line must not be the only way to understand the grouping.
- Mobile and desktop layouts must preserve a logical reading order: overdue tasks before active tasks.

## Acceptance Criteria

- With overdue and active tasks, the dashboard task block shows two internal groups on desktop: `Просрочено` and `Активные`.
- Overdue tasks appear only in `Просрочено`.
- Active non-overdue tasks appear only in `Активные`.
- The explanatory line reads `Задачи сгруппированы по состоянию и отсортированы по срочности.`
- With zero overdue tasks, the dashboard shows no empty overdue group, no red zero badge, and active tasks use the available width.
- With zero open tasks, the existing empty task state appears without group headings.
- On mobile, groups stack vertically with `Просрочено` before `Активные`.
- The `Активность за 7 дней` card remains unchanged.
