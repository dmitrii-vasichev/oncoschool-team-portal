# Task Filter Sheet Design

## Summary

The tasks board filter toolbar should become a compact control row with an off-canvas filter sheet. The current inline filter grid consumes too much vertical space after adding task labels, especially when the department filter is available. The new design keeps the board visually dominant while preserving clear visibility into active filters.

## Goals

- Reduce the default vertical height of the tasks page header.
- Keep search immediately available.
- Move structured filters into a dedicated sheet.
- Preserve multi-select behavior for task labels.
- Make all filter controls look like one consistent design system.
- Keep active filter state visible without reopening the sheet.

## Non-Goals

- No backend API changes.
- No changes to task visibility, department access, or label matching semantics.
- No saved views or per-user customizable pinned filters in this iteration.
- No change to task card label display beyond any active-filter chip behavior needed by this design.

## Top-Level Layout

The tasks page header should use one compact row:

```text
[Search task...]  [Filters · N]  [New task]
```

Search stays outside the sheet because it is a high-frequency direct lookup action, not a structured filter configuration field.

The `Filters · N` button opens the filter sheet. `N` is the number of active structured filters and excludes the search query. If no structured filters are active, the button can read `Filters`.

Active filter chips appear below the compact row only when at least one structured filter is active. If no structured filter is active, the chip row is hidden.

## Filter Sheet Behavior

On desktop, the sheet opens from the right side of the viewport. On mobile and tablet widths, it opens as a bottom sheet so the controls have enough width and remain easy to scan.

Filter changes apply immediately, matching the current task board behavior. The sheet does not need a separate `Apply` button.

The sheet includes:

- Header: `Filters` and close button.
- Filter fields in the approved order.
- Footer actions: `Reset` and `Done`.

`Done` closes the sheet. `Reset` clears all structured filters but leaves the search query unchanged. Closing the sheet does not reset filters.

## Filter Order

The sheet fields must appear in this order:

1. Labels
2. Department
3. Participant
4. Priority
5. Source

The department field is shown only when the user can switch departments, preserving the current role-aware behavior.

## Labels Filter

The labels filter keeps its existing multi-select behavior:

- users can select multiple labels;
- users can search labels;
- users can create a new label while typing;
- users can remove one selected label without clearing the whole labels filter.

The labels trigger should visually match the other filter triggers. It should use the same height, border, radius, background, hover state, focus state, and right-side dropdown indicator. Internally it can remain a custom multi-select popover, but externally it should read as part of the same filter control family.

Inside the sheet, the labels trigger should stay compact. When labels are selected, it should show a summary such as `VK Launch +1` or `2 labels selected`, rather than growing with many chips.

## Active Filter Chips

The active chip row explains the current filtered state without requiring the sheet to be open.

Label filters should be represented as individual chips where practical:

- one or two selected labels appear as individual removable chips;
- three or more selected labels show the first two labels plus an overflow chip such as `+2 labels`;
- visible label chips remove that specific label;
- the overflow chip opens the filter sheet or otherwise exposes the full selected label set.

Other structured filters appear as one chip each:

- department;
- participant;
- priority;
- source.

The row includes a `Reset` action that clears structured filters and keeps search unchanged.

## Visual Consistency

All sheet filter controls should share a single control style:

- same height;
- same border color;
- same border radius;
- same background;
- same typography scale;
- same hover and focus treatment;
- same right-side dropdown indicator.

This applies to the labels picker even though its internal behavior differs from a single-select field.

## Accessibility

The filter sheet should support keyboard navigation through existing Radix/shadcn primitives where possible. The close button, reset action, done action, and every filter trigger must have clear accessible labels. Focus should move into the sheet when it opens and return to the `Filters` button when it closes.

## Testing

Manual validation should cover:

- default header height with no active filters;
- header and chip row with one active filter;
- labels filter with one, two, and three or more selected labels;
- department filter hidden for users without department switching;
- department filter visible for users with access to multiple departments;
- desktop right-side sheet;
- mobile bottom sheet;
- immediate filtering after changing each field;
- `Done` closes without changing state;
- `Reset` clears structured filters and preserves search;
- visual parity between the labels trigger and the other filter triggers.
