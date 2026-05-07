# Task Board Visual Polish Design

## Summary

The task board needs a compact visual cleanup after the urgency and create-checklist rollout. The main goal is to reduce unnecessary vertical and horizontal noise while keeping the board usable for task creation, scanning, and drag-and-drop.

The approved direction is conservative: keep the existing task model and interactions, but tighten the layout in the create dialog, task cards, and empty Kanban columns.

## Goals

- Remove the internal scroll from the new task dialog in normal desktop use.
- Make the description field optional by keeping it collapsed by default.
- Place labels and urgency on one row in the create dialog on wider screens.
- Treat urgency as an off-by-default binary switch labeled as an urgent task toggle.
- Remove the `Срочно` footer badge from task board cards so the assignee name has enough room.
- Keep urgent task cards visually distinct through the red left edge.
- Remove excessive empty vertical space between a task card title and checklist preview.
- Replace noisy empty-column copy and illustration with a quiet drop-zone surface.

## Non-Goals

- No backend, database, or API changes.
- No changes to task urgency semantics.
- No changes to checklist creation or completion behavior.
- No changes to task detail page urgency editing.
- No redesign of the whole Kanban board or filter bar.
- No new empty-state illustrations.

## Approved Decisions

### New Task Dialog

The dialog should be compact enough that the create button remains visible without using `DialogContent` as a scroll container in normal desktop viewport sizes.

The description section is collapsed by default. It appears as a compact row labeled `Описание` with an action such as `Добавить`. When opened, it expands into the existing textarea. If the user enters text, the section stays open until the task is created or the dialog is closed/reset.

Labels and urgency share one row on wider dialog widths:

- labels keep the existing picker behavior;
- urgency becomes a compact switch block labeled `Срочная задача`;
- the switch is off by default and writes `normal`;
- enabling the switch writes `urgent`.

On narrow screens, labels and urgency can stack to avoid cramped controls.

The checklist area remains visible because checklist creation is a common part of this flow. It should use compact spacing and an icon-only add button when space is tight.

Deadline and assignee keep their existing two-column layout on wider screens and stack on narrow screens.

### Task Board Cards

Urgent task cards no longer render the footer text badge `Срочно`. The red left edge remains the urgency signal. This preserves horizontal space for the deadline and assignee name, especially when the card also contains a deadline.

The card footer should prioritize:

- deadline;
- assignee avatar and full visible name where possible;
- overdue badge when applicable.

Urgency is communicated by the red edge only on the board card. This is an intentional trade-off for card readability. Other contexts may continue to show text urgency labels where they do not create layout pressure.

Checklist previews should not be pushed down by reserved title/source space when there is no source icon or other metadata. The card should keep title height stable enough for a tidy board, but avoid a large blank gap before the checklist block.

### Empty Kanban Columns

Empty columns should stop showing the large empty-state illustration and the copy `Нет задач` / `В этой колонке пока пусто`.

Instead, an empty column shows a quiet dashed drop-zone surface under the column header. The surface should be subtle in the resting state and can become more visible when a task is dragged over it.

This keeps the column readable as a drag-and-drop target without adding obvious explanatory text.

## Alternatives Considered

### Urgency Badge Alternatives

1. Keep only the red left edge.
   - Approved because it is the cleanest and fixes assignee truncation.
2. Move `Срочно` above the title.
   - Rejected because it still adds vertical weight to every urgent card.
3. Keep `Срочно` in the footer and collapse the assignee to avatar-only.
   - Rejected because assignee context is more useful than repeated urgency text.

### Empty Column Alternatives

1. Fully blank column body.
   - Rejected because drag-and-drop affordance becomes too invisible.
2. Quiet dashed drop-zone surface.
   - Approved because it keeps the board calm while preserving a target area.
3. Small plus marker.
   - Rejected because it implies task creation more than task movement and adds a visual object.

## Component Scope

Primary frontend files:

- `frontend/src/components/tasks/CreateTaskDialog.tsx`
- `frontend/src/components/tasks/TaskCard.tsx`
- `frontend/src/app/tasks/page.tsx`

Potential supporting files:

- shared UI primitives only if needed for an accessible collapsible description section;
- task card tests only if the existing test setup already covers rendered card behavior.

The dashboard compact task list is not part of this change unless implementation shows the same urgent badge creates the same layout issue there.

## Accessibility

The create-dialog description toggle must be keyboard accessible and expose expanded/collapsed state.

The urgency switch must have a clear accessible label. The visual label should make the off state understandable without requiring explanatory helper text.

The empty-column drop-zone should not rely on text, but the drag-and-drop target should keep appropriate event handling and visible drag-over styling.

The approved visible board-card urgency treatment uses the red edge only in this dense board context. The card link should still expose urgency to assistive technology, for example through an `aria-label` or visually hidden text that does not occupy footer space.

## Validation

Automated validation:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Manual/browser validation:

- Open the new task dialog on desktop and confirm there is no internal scroll in the normal viewport.
- Confirm the description starts collapsed, expands on demand, accepts text, and resets when the dialog closes.
- Confirm labels and urgency share one row on desktop and stack cleanly on narrow/mobile width.
- Create a normal task and an urgent task; verify the payload still uses `normal` and `urgent`.
- Confirm urgent task cards show the red left edge but no footer `Срочно` badge.
- Confirm assignee names have more room after the urgent badge removal.
- Confirm task cards with checklist previews do not show a large empty gap between title and checklist.
- Confirm empty columns show the quiet dashed drop-zone instead of illustration and copy.
- Drag a task over an empty column and confirm the drop target remains obvious.
