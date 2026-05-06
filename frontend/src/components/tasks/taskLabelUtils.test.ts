import assert from "node:assert/strict";
import test from "node:test";

import {
  TASK_LABEL_COLOR_OPTIONS,
  getTaskLabelPickerStateAfterArchive,
  canArchiveTaskLabel,
  canEditTaskLabel,
  labelClass,
  labelSwatchClass,
} from "./taskLabelUtils.ts";
import type { TaskLabel } from "../../lib/types.ts";

function label(overrides: Partial<TaskLabel> = {}): TaskLabel {
  const base: TaskLabel = {
    id: "label-1",
    name: "Conference",
    slug: "conference",
    color: "teal",
    created_by_id: "member-1",
    is_archived: false,
    created_at: "2026-05-06T00:00:00Z",
    updated_at: "2026-05-06T00:00:00Z",
    usage_count: 0,
    can_edit: false,
    can_archive: false,
    can_restore: false,
    is_shared_for_current_user: false,
  };
  return Object.assign(base, overrides);
}

test("TASK_LABEL_COLOR_OPTIONS exposes the fixed backend palette", () => {
  assert.deepEqual(
    TASK_LABEL_COLOR_OPTIONS.map((option) => option.value),
    ["teal", "blue", "purple", "gold", "green", "coral", "rose", "slate"]
  );
});

test("labelClass falls back to slate for unknown legacy colors", () => {
  assert.equal(labelClass("unknown"), labelClass("slate"));
});

test("labelSwatchClass supports rose", () => {
  assert.match(labelSwatchClass("rose"), /rose/);
});

test("capability helpers read backend capability flags", () => {
  assert.equal(canEditTaskLabel(label({ can_edit: true })), true);
  assert.equal(canArchiveTaskLabel(label({ can_archive: true })), true);
  assert.equal(canEditTaskLabel(label({ can_edit: false })), false);
  assert.equal(canArchiveTaskLabel(label({ can_archive: false })), false);
});

test("archiving a label removes it from picker options without changing selected labels", () => {
  const archived = label({ id: "label-1", name: "Owned" });
  const other = label({ id: "label-2", name: "Other" });
  const selectedLabels = [archived, other];

  const result = getTaskLabelPickerStateAfterArchive({
    options: [archived, other],
    selectedLabels,
    archivedLabelId: archived.id,
  });

  assert.deepEqual(
    result.options.map((item) => item.id),
    [other.id]
  );
  assert.deepEqual(result.selectedLabels, selectedLabels);
});
