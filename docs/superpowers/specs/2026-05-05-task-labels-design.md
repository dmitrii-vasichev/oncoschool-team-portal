# Task Labels Design

## Metadata

| Field | Value |
| --- | --- |
| Date | 2026-05-05 |
| Status | Approved for implementation planning |
| Feature | Optional multi-label grouping for portal tasks |
| Scope | Web portal MVP only |

## Problem

The Oncoschool portal is the primary operational workspace, but the project lead also needs to group tasks by additional initiatives inside the same portal. These initiatives are not separate workspaces: they do not need separate permissions, boards, schedules, or dashboards in the first release. The goal is a lightweight way to tag, find, and filter tasks by cross-cutting project context.

## Goals

- Add optional, multiple labels to tasks.
- Let any authenticated portal user create a new team-wide label from the task UI.
- Keep ordinary portal tasks unlabeled by default.
- Let users filter the task board by labels without changing current department and role visibility.
- Keep the first release web-only.
- Store enough metadata to support moderator cleanup later.

## Non-Goals

- No separate project/workspace entity.
- No default `Oncoschool` label.
- No personal/private labels in the first release.
- No Telegram bot support in the first release.
- No analytics by label in the first release.
- No full label management page in the first release.
- No task access changes based on labels.

## Best-Practice Context

The selected model is a small-team hybrid:

- Jira-style labels are fast because users can create labels while editing a work item, and existing labels are suggested to encourage consistency.
- Todoist distinguishes personal and shared labels, but that adds conceptual overhead that is not needed for the current portal.
- Asana's custom-field model shows why a managed catalog is useful for reporting and cleanup, even when entry is lightweight.

References:

- Jira labels: https://support.atlassian.com/jira/kb/how-to-create-and-use-labels-in-jira-cloud/
- Jira label search: https://support.atlassian.com/jira-software-cloud/docs/jql-fields/
- Todoist labels: https://www.todoist.com/help/articles/introduction-to-labels-dSo2eE
- Asana custom fields: https://developers.asana.com/docs/custom-fields-guide

## Chosen Approach

Add team-wide task labels as a classification layer over the existing task model.

Any authenticated active user can create a label. A label becomes available to the team for autocomplete and filtering as soon as it is created. Users can attach labels only to tasks they are allowed to edit. Labels do not grant visibility, do not bypass department rules, and do not replace assignees, departments, priorities, task sources, or meetings.

## User Experience

### Task Board

- Add a `Labels` filter next to the existing search, priority, source, department, and participant filters.
- Support selecting one or more labels.
- The filter applies to the current visible task scope.
- Active label filters appear in the active filter chip row.
- Task cards show up to two labels as compact chips.
- If a task has more than two labels, show an overflow chip such as `+2`.
- Unlabeled tasks do not show placeholder text on cards.

### Create Task Dialog

- Add a `Labels` multi-select field below description or near metadata fields.
- The field supports search, selection, removal, and create-while-typing.
- New labels are created through `POST /api/task-labels` before task submission; the task payload then sends only `label_ids`.
- Labels remain optional.

### Task Detail Page

- Show label chips near the existing status, priority, source, and reminder badges.
- Users who can edit the task can add and remove labels.
- Users without edit permission can view labels only.

## Permissions

Label catalog permissions:

- Any authenticated active user can create labels.
- All active labels are available for autocomplete to authenticated users.
- Moderator cleanup actions are deferred.

Task-label permissions:

- Users can attach or detach labels only if `PermissionService.can_edit_task(member, task)` is true.
- Moderators and admins can edit labels on any visible task through the existing moderator permission path.
- Label filtering must never reveal tasks outside existing task visibility rules.

## Data Model

### New Table: `task_labels`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `name` | String(80) | Display name, trimmed |
| `slug` | String(100) | Normalized unique lookup key |
| `color` | String(30) | Stable palette key or hex token |
| `created_by_id` | UUID nullable | FK to `team_members.id`; nullable for future system imports |
| `is_archived` | Boolean | Default false; archived labels are hidden from autocomplete |
| `created_at` | DateTime | Server default now |
| `updated_at` | DateTime | Updated on change |

Constraints and indexes:

- Unique index on `slug`.
- Index on `is_archived`.
- Index on `created_at` for deterministic admin cleanup views later.

Normalization:

- Trim leading and trailing whitespace.
- Collapse repeated internal whitespace.
- Normalize case for lookup.
- Reject empty names.
- Limit names to 80 characters.
- Keep the display name user-friendly; do not force hyphens in the UI.

### New Table: `task_label_links`

| Column | Type | Notes |
| --- | --- | --- |
| `task_id` | UUID | FK to `tasks.id`, cascade delete |
| `label_id` | UUID | FK to `task_labels.id` |
| `created_at` | DateTime | Server default now |

Constraints and indexes:

- Primary key or unique constraint on `(task_id, label_id)`.
- Index on `label_id`.
- Index on `task_id`.

### Modified Task Model

- Add relationship `Task.labels`.
- Task responses include `labels: list[TaskLabelResponse]`.
- Task create/edit schemas accept `label_ids: list[UUID]`.

## API Design

### Label Endpoints

`GET /api/task-labels`

Query parameters:

- `search`: optional string.
- `include_archived`: supported by the API for future moderator cleanup, but the MVP UI does not expose it.
- `limit`: default 20.

Response:

- Active labels matching search.
- Include usage count for display and sorting.

`POST /api/task-labels`

Request:

```json
{
  "name": "Conference"
}
```

Behavior:

- Normalize the name.
- If a non-archived label with the same slug already exists, return the existing label instead of creating a duplicate.
- If an archived label with the same slug exists, reactivate and return that label. This keeps slugs unique and prevents hidden duplicates.
- Otherwise create a new label with a deterministic color.

### Task Endpoints

`GET /api/tasks`

Add query support:

- `label_ids=<uuid>` for one selected label.
- `label_ids=<uuid>,<uuid>` for multiple labels.

Filtering rule:

- Apply current department and role visibility first.
- Then restrict to tasks linked to any selected label.
- MVP semantics are always `match=any`, because it is more useful for quick grouping.

`POST /api/tasks`

Add optional `label_ids`.

`PATCH /api/tasks/{short_id}`

Add optional `label_ids`. If present, replace the task's label set with the provided list after permission checks.

## Backend Components

- `TaskLabel` SQLAlchemy model.
- `TaskLabelRepository` for search, create/get by slug, usage counts, and lookup by IDs.
- Task repository query updates to preload labels and filter by labels.
- Task service updates to attach labels during create and edit.
- Permission updates to treat labels as a task edit field available to task editors.
- Alembic migration for `task_labels` and `task_label_links`.

## Frontend Components

- `TaskLabel` TypeScript type.
- API client methods for label search and creation.
- Reusable `TaskLabelPicker` component.
- Task board filter support.
- Task card label chips with overflow handling.
- Create task dialog label field.
- Task detail label editing.

## Error Handling

- Empty label names return a validation error.
- Overlong label names return a validation error.
- Duplicate normalized labels return the existing label instead of creating another one.
- Missing label IDs in task create/edit return a validation error.
- Archived labels are not suggested for new use, but existing archived labels attached to tasks can still be displayed.
- Label filter requests for unknown IDs return an empty task list.
- Permission errors must use the existing task permission error style.

## Testing

Backend tests:

- Create a label from an authenticated user.
- Duplicate label names resolve to one normalized label.
- Create a task with labels.
- Update a task label set.
- Filter tasks by a label.
- Filter by multiple labels with `match=any`.
- Ensure label filtering does not reveal tasks outside department visibility.
- Ensure users without task edit permission cannot attach or remove labels.

Frontend checks:

- TypeScript build passes.
- Create task dialog sends selected labels.
- Task detail updates labels.
- Task board filter sends label query parameters.
- Cards remain readable with zero, one, two, and more than two labels.

Manual QA:

- Create `Conference`.
- Add `Conference` and `Partners` to one task.
- Create a normal task with no labels.
- Filter the board by `Conference`.
- Verify the normal task disappears only while the filter is active.
- Verify a user with narrower department scope still cannot see hidden tagged tasks.

## Future Enhancements

- Moderator label management in settings: rename, recolor, archive, merge duplicates.
- Analytics by label on task statistics.
- Dashboard widgets filtered by label.
- Telegram display and parsing for labels.
- Saved views by label.
- Personal/private labels only if real usage shows a need.

## Acceptance Criteria

- Users can create team-wide labels from the web task UI.
- Users can attach multiple labels to a task.
- Unlabeled tasks remain valid and visually normal.
- Task cards display labels compactly.
- The task board can filter by one or more labels.
- Existing task visibility rules remain unchanged.
- Telegram behavior remains unchanged.
- Backend and frontend verification commands pass.
