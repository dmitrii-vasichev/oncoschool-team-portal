# Meeting Board Focus and Sections Design

## Metadata

| Field | Value |
| --- | --- |
| Date | 2026-05-08 |
| Status | Draft ready for user review |
| Feature | Meeting board topical focus and section cleanup |
| Scope | Meeting board MVP extension |

## Summary

The meeting board should support a topical focus so a meeting can show only tasks relevant to the meeting topic, while preserving the current participant-based behavior when no focus is configured.

The MVP adds `focus_label_ids` to per-meeting board settings. These labels filter the normal board scope, but they do not grant task access and do not affect pinned tasks. The same update also makes the board more useful for planning meetings by adding a `New` section, aligning the `review` section label with the rest of the product, clarifying the completed task window, and moving the board scope controls into a compact expandable surface.

## Problem

The current meeting board pulls tasks primarily by meeting participants plus manually added people, departments, and pinned tasks. This creates noise when one person owns tasks across several initiatives. A medical tourism planning meeting can accidentally show that person's product, content, GetCourse, and general operations tasks.

The board also omits non-urgent `new` tasks, which makes it weaker for planning meetings. The existing section label `On review` is inconsistent with the product status name `On approval`, and the always-visible scope panel uses space that is more valuable for task discussion during a live screen share.

## Goals

- Let moderators set a meeting focus by choosing existing active task labels.
- Keep the current board behavior when no focus labels are selected.
- Filter participant, added-member, and added-department tasks by selected focus labels.
- Always include pinned tasks as manual exceptions to the focus filter.
- Preserve all existing task visibility rules.
- Add a board section for `new` tasks.
- Rename the board `review` section to the same user-facing label used elsewhere: `On approval`.
- Clarify the completed section as tasks completed in the last 7 days.
- Make board scope controls compact by default, with an expandable settings panel.
- Avoid adding a separate `Project` or `Workspace` entity.

## Non-Goals

- No separate project/workspace model.
- No complex filter builder.
- No focus modes such as `labels_only`, `pinned_only`, or `people_all` in the MVP.
- No creation of new labels from the meeting board focus picker.
- No hidden-task list in the MVP.
- No AI relevance suggestions in the MVP.
- No default schedule-level focus labels in the MVP.

## Current Behavior

The backend board scope is computed from:

- meeting participants;
- `added_member_ids`;
- `added_department_ids`;
- `pinned_task_ids`.

Those conditions are combined as a broad task candidate set, then task visibility is applied through department visibility and `can_access_task`.

Tasks are grouped into:

- urgent;
- in progress;
- review;
- done this week.

Non-urgent tasks with status `new` are not shown. Completed tasks are included when `Task.completed_at` is within the last 7 days.

## Data Model

Add one field to `meeting_board_settings`:

| Column | Type | Notes |
| --- | --- | --- |
| `focus_label_ids` | UUID array | Default empty array. Stores existing task label IDs selected as the meeting focus. |

The field belongs to the meeting-specific board settings record, not to `Meeting` and not to `MeetingSchedule`.

API and frontend types should expose:

- `focus_label_ids: list[UUID]` in board settings update and response models;
- optionally `focus_labels: list[TaskLabelResponse]` in the board response if the frontend needs label names/chips without a separate lookup.

The label catalog remains the existing task label system. Labels continue to be team-wide classification metadata only.

## Product Behavior

### Empty Focus

If `focus_label_ids` is empty, the board task selection must behave exactly as it does now, except for the added `New` section and label text cleanup.

### Non-Empty Focus

If `focus_label_ids` contains one or more labels:

- participant tasks are included only when the task has at least one selected focus label;
- added-member tasks are included only when the task has at least one selected focus label;
- added-department tasks are included only when the task has at least one selected focus label;
- pinned tasks are included even when they do not have any selected focus label;
- all task visibility rules still apply after the scope is computed.

Multiple focus labels use `match any` semantics.

### Pinned Tasks

Pinned tasks are manual exceptions to topical filtering only. They do not bypass visibility. A viewer still sees a pinned task only if the existing task visibility rules allow that viewer to see it.

### New Tasks

Add a `New` section for tasks with status `new`.

Recommended board order:

1. Urgent
2. New
3. In progress
4. On approval
5. Completed in 7 days

Urgent tasks should remain in the urgent section even if their status is `new`, `in_progress`, or `review`, because urgency is the fastest scan path during a meeting.

Cancelled tasks should not appear on the meeting board, including cancelled tasks with urgent priority.

### Completed Window

The completed section should be based on `Task.completed_at`, which is set when a task moves to `done` through the task service.

Use user-facing wording that matches the actual rolling window: `Completed in 7 days`. This avoids implying a calendar week.

### Section Terminology

The task status `review` should display as `On approval`, matching the rest of the product terminology. The board should not use a separate `On review` or `On check` label.

## Frontend UX

### Compact Scope Summary

The meeting board should keep more horizontal space for task sections.

Replace the always-prominent scope panel with a compact summary near the board header or above the task sections:

- focus labels as chips, or `No focus`;
- added people count;
- added departments count;
- pinned task count;
- a moderator-only settings button.

### Expandable Scope Settings

Clicking the settings button opens a drawer/sheet with board scope controls:

- `Meeting focus`: existing active task label multi-select;
- added people;
- added departments;
- pinned tasks;
- materials and notes may stay in their current section unless a later UI pass moves them.

For the MVP, the focus picker should select only existing active task labels. It should not create labels, edit labels, archive labels, or open label management actions from the meeting board.

Regular participants should see a read-only scope summary and no settings controls.

## Backend Logic

The task query should preserve the existing visibility enforcement and avoid using a global label join that would accidentally remove pinned tasks.

Recommended candidate logic:

- build a people/department scope condition from participants, added members, and added departments;
- if focus labels are empty, use the people/department scope unchanged;
- if focus labels are non-empty, require the people/department scope and a task-label match;
- OR the pinned task condition separately;
- apply existing visible department filtering;
- run `can_access_task` for each candidate as the final safety check.

The label filter should use the existing `task_label_links` relationship/indexes and `match any` semantics.

## Permissions

- Only moderators/admins can update board settings, as today.
- Any authenticated viewer may see the selected focus labels if they can view the meeting board.
- Focus labels do not grant access to tasks.
- Focus labels do not allow attaching labels to tasks.
- Label creation/edit/archive permissions remain controlled by the existing task label feature.

## MeetingSchedule Decision

Do not add schedule-level focus labels in the MVP.

Reasoning:

- the current board settings model is per meeting;
- schedule-level defaults require inheritance and override rules;
- changing a recurring schedule would need decisions about future meetings, existing meetings, and per-meeting edits.

Future enhancement: add `MeetingSchedule.default_focus_label_ids`, copy them into new meeting board settings, and allow each individual meeting board to override them.

## Risks and Edge Cases

- Archived labels may already be selected as focus labels. The board can keep filtering by ID, but normal picker results should not offer archived labels for new selection.
- If selected focus labels match no visible tasks, the board should show normal empty sections.
- Unlabeled tasks disappear when focus is active, except when pinned.
- Pinned tasks must still be deduplicated if they also match the normal focused scope.
- Cancelled urgent tasks should be excluded before urgent grouping.
- Focus labels should not make hidden tasks visible to users outside the existing department/role visibility rules.

## Future Enhancements

- Default focus labels on `MeetingSchedule` for recurring meetings.
- Automatic application of meeting focus labels to tasks created from AI outcomes.
- `hidden_task_ids` for per-board manual hiding.
- Selection modes such as `people_all`, `people_by_labels`, `labels_only`, and `pinned_only`.
- A `Possibly related` section for unlabeled tasks suggested by text similarity.

## Acceptance Criteria

- A board with no focus labels behaves like the current board.
- A board with focus labels shows participant, added-member, and added-department tasks only when they have at least one selected focus label.
- Pinned tasks remain visible despite focus labels when the viewer can access them.
- A matching focus label never reveals a task outside the viewer's visibility scope.
- New tasks appear in a dedicated board section.
- Cancelled tasks do not appear on the board.
- The `review` status appears as `On approval`.
- Completed tasks are shown by `completed_at` within the last 7 days.
- The board scope UI is compact by default and editable through an expandable settings surface for moderators.
