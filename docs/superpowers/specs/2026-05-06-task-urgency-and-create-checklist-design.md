# Task Urgency and Create Checklist Design

## Summary

The task priority model should become a binary urgency model across the whole system. Users should no longer choose between low, medium, high, and urgent priorities. A task is either normal or urgent. Existing high-priority tasks must remain urgent after the transition.

The task card UI should also remove status and priority icons. Status is already communicated by the Kanban column, and urgency should be shown through a clear card treatment rather than a small icon. The new task dialog should allow users to add checklist items before the task is created.

## Goals

- Replace the four-level task priority experience with a binary normal/urgent model.
- Preserve the intent of existing data by migrating `urgent` and `high` tasks to urgent.
- Treat existing `medium` and `low` tasks as normal.
- Remove status and priority icons from task cards.
- Make urgent tasks visually distinct from overdue tasks.
- Add checklist creation to the new task dialog.
- Update web UI, backend validation, bot flows, AI parsing, notifications, reminders, analytics, and documentation language from priority to urgency.

## Non-Goals

- No changes to task status values or Kanban column behavior.
- No change to task deadline or overdue semantics.
- No change to checklist behavior after task creation beyond sharing the same item data shape.
- No new reminder section, escalation workflow, or SLA logic for urgent tasks.
- No saved filter presets.

## Domain Model

The domain model is binary:

- `normal`: a regular task.
- `urgent`: a task that needs special attention.

For compatibility, the existing database/API field can remain named `priority` during this iteration. Its domain meaning changes to urgency. New writes should produce only `normal` or `urgent`.

Legacy values must be normalized as follows:

| Legacy value | New value |
| --- | --- |
| `urgent` | `urgent` |
| `high` | `urgent` |
| `medium` | `normal` |
| `low` | `normal` |

Backend write paths should accept legacy aliases temporarily and normalize them before persistence. User-facing controls and prompts should not offer `low`, `medium`, or `high` after this change.

## Data Migration

Add an Alembic migration that updates existing task rows:

- `priority = 'urgent'` stays `urgent`.
- `priority = 'high'` becomes `urgent`.
- `priority = 'medium'` becomes `normal`.
- `priority = 'low'` becomes `normal`.
- unexpected or empty values become `normal`.

The migration should also update the database default from `medium` to `normal`.

If a rollback is needed, `normal` can map back to `medium` and `urgent` can remain `urgent`. The rollback does not need to restore exact historical `high` or `low` values because the new product model intentionally removes that distinction.

## Backend API

`TaskCreate` and `TaskEdit` should accept the new values `normal` and `urgent`. They may also accept legacy values as aliases for backward compatibility:

- `high` and Russian equivalents of high/urgent normalize to `urgent`.
- `medium`, `low`, and Russian equivalents of regular/normal/medium/low normalize to `normal`.

Task creation should default to `normal`.

Filtering by urgency should support the new values. If a client sends a legacy priority filter, the backend should normalize it so old links or bot actions do not fail abruptly.

Sorting by priority should be reviewed because the new model has only two values. If kept, urgent tasks should sort before normal tasks.

## Web UI

### Task Cards

Task cards should remove both the status icon and the priority icon.

Urgent tasks use the approved visual treatment:

- a red left card edge;
- a compact text badge `Срочно`;
- no icon.

Overdue tasks remain visually separate:

- overdue styling affects the card background, border, title, deadline, and `Просрочено` badge;
- overdue does not rely only on the urgent edge;
- an urgent overdue task can show both the urgent edge/badge and the overdue card state.

The Kanban column remains the primary status signal on the tasks page. If task cards appear outside the Kanban context, status can remain visible as text or a badge, but not as the current icon-only affordance.

### New Task Dialog

Replace the four priority buttons with a binary control:

- default: normal task;
- option: `Срочная задача`.

The control should be a switch or checkbox with clear label text. It should not use a priority icon.

Add checklist editing directly in the new task dialog:

- users can add multiple checklist items before saving;
- each item has an id, title, and `is_completed: false`;
- empty item titles are ignored or blocked;
- users can remove draft checklist items before creating the task;
- submitted payload includes `checklist`.

The dialog should remain compact enough for mobile. The checklist area can be a simple stacked list with an input and add/remove controls.

### Task Details

Replace the priority selector with a binary urgency control. It should update the same field, but the UI label should be urgency-oriented, for example `Срочная задача`.

`PriorityBadge` should be renamed or reshaped at the component level where practical. If a compatibility component remains for a short transition, it should display only `Срочно` for urgent tasks and render nothing or a neutral text badge for normal tasks depending on local layout needs.

`StatusBadge` can continue to exist for detail pages and non-Kanban contexts, but task cards should not use status icons.

### Filters

Rename the task filter from priority to urgency:

- `Все задачи`;
- `Срочные`;
- `Обычные`.

The filter chip should use the same language. Legacy filter values should be normalized so old `high` filters map to urgent and old `medium`/`low` filters map to normal.

### Analytics

Rename the priority distribution to urgency distribution. It should show at most two rows:

- urgent;
- normal.

The backend aggregation can continue to return `tasks_by_priority` for compatibility in this iteration, but the frontend copy should say urgency. A future cleanup can rename the API field.

### Meeting Summary Preview

Meeting summary task extraction and preview should offer only normal/urgent. Parsed `high` values should be shown as urgent. Parsed `medium` or `low` should be shown as normal.

## Bot and Notifications

Telegram bot text should use urgency language instead of priority language.

Task creation markers:

- keep `!urgent` as the explicit urgent marker;
- accept `!high` as a legacy urgent alias;
- accept and normalize `!medium` and `!low` to normal if they are sent, but remove them from help text.

Task edit flows should ask whether the task is urgent instead of asking for low/medium/high/urgent. Text input can accept:

- urgent aliases: `urgent`, `high`, `срочно`, `срочный`, `важно`, `высокий`;
- normal aliases: `normal`, `medium`, `low`, `обычная`, `обычный`, `не срочно`, `средний`, `низкий`.

Notifications and reminder digest task lines should render urgency only when the task is urgent, for example `Срочно`. Normal tasks should not add extra noise to compact task lines unless the user explicitly enabled a full field display that needs a normal value.

Existing reminder setting field names such as `task_line_show_priority` may remain internally for compatibility in this iteration, but user-facing settings copy should refer to urgency.

## AI Parsing

Update AI prompts to request binary urgency:

- `urgent` when the text says срочно, критично, ASAP, важно, or similar high-attention language;
- `normal` by default and for low/medium language.

AI parser output normalization must handle legacy model responses:

- `high` maps to `urgent`;
- `medium` and `low` map to `normal`.

Meeting chunk merging should prefer urgent over normal when duplicate task candidates are merged.

## Permissions

Existing permissions for editing priority should apply to editing urgency. No new permission category is needed.

Assignees and authors should keep their current edit capabilities. Moderator behavior should not change.

## Accessibility

Urgency must not be communicated by color alone. The task card should include visible text `Срочно`, and controls should have clear labels. Overdue tasks should include visible `Просрочено` text as they do today.

The new checklist controls in the create dialog need accessible labels for adding and removing draft items.

## Testing

Backend tests should cover:

- legacy value normalization for create and edit;
- data migration mapping `high` to urgent and `medium`/`low` to normal;
- task text parsing for `!urgent`, legacy `!high`, and normal aliases;
- AI parser normalization;
- urgency filtering.

Frontend tests should cover:

- filter chip labels for urgent and normal;
- create dialog payload includes checklist items and binary urgency;
- task cards do not render status or priority icons;
- urgent and overdue card classes can coexist.

Manual/browser validation should cover:

- Kanban task cards for normal, urgent, overdue, and urgent overdue tasks;
- new task dialog checklist add/remove behavior;
- new task dialog mobile layout;
- task detail urgency editing;
- meeting summary task preview urgency choices;
- analytics urgency distribution copy;
- reminder settings copy where priority used to be shown.
