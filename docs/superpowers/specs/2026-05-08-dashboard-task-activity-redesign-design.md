# Dashboard Task Activity Redesign Design

## Summary

The dashboard currently separates active tasks and overdue tasks into two adjacent cards. This creates duplicate task cards because overdue tasks are also active tasks. The approved redesign removes that duplication by making overdue tasks a priority group inside the main task block, then turns the previous completed-week card into a compact activity card with drill-down lists.

The first release should keep the dashboard operational and calm: one area answers what needs attention now, and one area answers what moved during the last seven days.

## Current Behavior

- The dashboard shows an active task block for the current scope.
- The dashboard separately shows an overdue task block for the same scope.
- Overdue tasks can appear in both blocks.
- The completed-week block shows completed tasks from the last seven days.
- The dashboard scope currently supports personal and selected-department views, with role-aware department access.

## Goals

- Remove duplicate task cards from the dashboard task row.
- Keep overdue work visually prominent.
- Give the task list more room by making it a two-column block on desktop.
- Replace the narrow completed-week card with a broader activity summary for the selected scope.
- Let users drill into activity metrics without leaving the dashboard.
- Keep task visibility and department access rules strict.
- Make `team` scope available only to `admin` and `moderator` users.

## Non-Goals

- No public leaderboard in the first release.
- No multi-department selector in the first release.
- No change to task status semantics.
- No change to overdue semantics.
- No change to Kanban board columns.
- No gamification badges, streaks, or rankings in the first release.
- No modal-based dashboard detail experience unless inline disclosure proves unusable.

## Approved Layout

The top dashboard task row should become a two-part layout on desktop:

1. A large task block spanning two columns.
2. A right-side activity card spanning one column.

On smaller screens, these blocks stack vertically.

## Scope Rules

The task block and activity card always use the same selected scope.

Available scopes:

- `My`: tasks assigned to the current user.
- `Department`: tasks assigned to members of the selected accessible department.
- `Team`: tasks in the full company-wide scope visible to the current user.

Visibility:

- Regular members see `My`.
- Members with department access or department-head responsibilities may see `Department` when the existing access rules allow it.
- `Team` is visible only to `admin` and `moderator` users.
- The frontend must not show unavailable scope controls.
- The backend must enforce scope access even if a client sends unsupported scope parameters.

The first release should not add multi-select departments. That can be a later `Selected departments` scope if users need partial company views such as marketing plus sales.

## Main Task Block

The block title depends on scope:

- `My tasks`
- `Department tasks`
- `Team tasks`

Russian UI copy can remain:

- `Мои задачи`
- `Задачи отдела`
- `Задачи команды`

The block shows open tasks only: `new`, `in_progress`, and `review`.

Tasks are grouped inside the block:

1. `Overdue`
2. `Active`

Russian UI copy:

- `Просрочено`
- `Активные`

Rules:

- A task appears only once.
- If a task is overdue, it appears in the `Overdue` group and not again in `Active`.
- If there are no overdue tasks, omit the overdue group instead of showing an empty red area.
- The overdue group should keep the current overdue visual treatment.
- The active group should use normal task-card styling unless a task has another state such as urgent.
- The block keeps inline expand/collapse behavior from the existing dashboard task block expansion work.

Ordering:

- Overdue group: urgent first, oldest missed deadline first, newest created fallback.
- Active group: urgent first, nearest deadline first, newest created fallback.

## Activity Card

The existing `Completed in 7 days` dashboard card becomes `Activity in 7 days`.

Russian UI copy:

- `Активность за 7 дней`

The card shows metrics for the selected scope:

1. `Completed`
2. `Created`
3. `In progress > 7 days`
4. `Compared with previous week`

Russian metric copy:

- `Выполнено`
- `Создано`
- `В работе > 7 дней`
- `К прошлой неделе`

The activity card should not include an overdue metric. Overdue work is already represented in the main task block, and repeating it in the activity card would recreate the same conceptual duplication the redesign is removing.

## Activity Metric Definitions

### Completed

Tasks with `status = done` and `completed_at` within the last seven days.

Scope is determined by the task assignee:

- `My`: assigned to the current user.
- `Department`: assigned to members of the selected department.
- `Team`: all visible tasks for admin/moderator company scope.

### Created

Tasks with `created_at` within the last seven days.

Scope is still determined by assigned work, not by creator identity. If a manager creates ten tasks for team members, those tasks count in the assignees' scope because they represent new work entering that scope.

Unassigned tasks should not count in a department or personal activity scope unless the product later adds an explicit unassigned-work metric.

### In Progress More Than Seven Days

Tasks with current `status = in_progress` where the latest transition into `in_progress` happened more than seven days ago.

The transition source is `task_updates`:

- `update_type = status_change`
- `new_status = in_progress`
- `created_at` is the transition timestamp

Do not use `updated_at` as a substitute. `updated_at` measures record edits and timeline notes, not the moment a task entered work.

For tasks currently in `in_progress` without a recorded transition:

- Do not count them by default, because the metric cannot be computed honestly.
- If legacy coverage becomes important, add a deliberate migration/backfill or a durable `in_progress_since` field as a separate implementation decision.

### Compared With Previous Week

The comparison uses completed tasks:

- current period: completed during the last seven days;
- previous period: completed during the seven days before that.

The UI should show a compact delta such as `+3` or `-2` and explain that it compares completed tasks.

## Drill-Down Interaction

Each activity metric is clickable.

Clicking a metric expands a list inside the same card:

- `Completed` opens tasks completed in the last seven days.
- `Created` opens tasks created in the last seven days.
- `In progress > 7 days` opens currently in-progress tasks whose latest `in_progress` transition is older than seven days.

The interaction should be inline, not modal-based.

Only one metric detail list needs to be open at a time. Selecting another metric replaces the visible detail list. A second click on the selected metric may collapse the detail list.

The detail list uses compact task rows with task links to the existing task detail page.

If a metric is zero, it should remain readable but does not need to open an empty detail list.

## Data Loading

The frontend should not derive all activity metrics by fetching broad task pages and joining histories client-side.

Preferred backend support:

- A dashboard activity endpoint or analytics response extension for counts.
- A detail endpoint or query mode for each drill-down list.
- Backend-side filtering for scope and permissions.
- Backend-side calculation for `in_progress > 7 days` using `task_updates`.

The implementation may reuse existing `/api/tasks` filters for completed and created detail lists if those filters are sufficient, but `in_progress > 7 days` should be backend-calculated to avoid N+1 timeline requests.

## Accessibility

- Scope controls must be keyboard accessible.
- Activity metrics should be buttons, not plain clickable divs.
- Metric buttons should expose selected state.
- Inline detail lists should have clear labels that identify the selected metric.
- The task block group headings should be visible text, not tooltip-only explanations.

## Testing

Automated validation should cover:

- Overdue tasks appear only in the overdue group, not again in the active group.
- The task block omits the overdue group when there are no overdue tasks.
- Scope controls hide `Team` for non-admin/non-moderator users.
- Activity counts respect the same scope as the task block.
- Created activity counts assigned work by assignee scope, not creator scope.
- Completed comparison uses the last seven days versus the previous seven days.
- `In progress > 7 days` uses the latest `task_updates.new_status = in_progress` timestamp.
- Tasks without an `in_progress` transition are not counted in that metric.
- Activity drill-down changes the inline detail list without opening a modal.

Manual/browser validation should cover:

- Dashboard with overdue tasks shows no duplicate task cards.
- Dashboard without overdue tasks keeps the main task block visually calm.
- Department scope changes both task groups and activity metrics.
- Admin/moderator users can see team scope.
- Regular users cannot see team scope.
- Activity metric drill-down lists remain readable at desktop and mobile widths.

## Deferred Ideas

- Public leaderboards.
- Personal ranking or `My contribution` gamification.
- Multi-department scope selection.
- Dedicated unassigned-work activity metrics.
- Durable `in_progress_since` field if status-history queries become expensive or legacy coverage is required.
