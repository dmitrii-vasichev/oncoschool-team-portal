import assert from "node:assert/strict";
import test from "node:test";
import {
  getMeetingBoardScopeCounts,
  sanitizeMeetingBoardMaterialUrl,
} from "./meetingBoardPresentationUtils.ts";
import type { MeetingBoardSettings } from "../../lib/types.ts";

function settings(overrides: Partial<MeetingBoardSettings>): MeetingBoardSettings {
  return {
    id: "settings-id",
    meeting_id: "meeting-id",
    added_member_ids: [],
    added_department_ids: [],
    pinned_task_ids: [],
    focus_label_ids: [],
    materials: [],
    board_notes: null,
    created_by_id: null,
    updated_by_id: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

test("sanitizeMeetingBoardMaterialUrl allows absolute http and https URLs", () => {
  assert.equal(
    sanitizeMeetingBoardMaterialUrl("https://example.com/doc"),
    "https://example.com/doc"
  );
  assert.equal(
    sanitizeMeetingBoardMaterialUrl(" http://example.com/path?q=1 "),
    "http://example.com/path?q=1"
  );
});

test("sanitizeMeetingBoardMaterialUrl blocks unsafe or non-external schemes", () => {
  assert.equal(sanitizeMeetingBoardMaterialUrl("javascript:alert(1)"), null);
  assert.equal(sanitizeMeetingBoardMaterialUrl("data:text/html,<script></script>"), null);
  assert.equal(sanitizeMeetingBoardMaterialUrl("mailto:test@example.com"), null);
  assert.equal(sanitizeMeetingBoardMaterialUrl("/relative/path"), null);
  assert.equal(sanitizeMeetingBoardMaterialUrl(""), null);
});

test("getMeetingBoardScopeCounts uses raw settings lengths", () => {
  assert.deepEqual(
    getMeetingBoardScopeCounts(
      settings({
        added_member_ids: ["missing-member", "loaded-member"],
        added_department_ids: ["missing-department"],
        pinned_task_ids: ["task-1", "task-2", "task-3"],
        focus_label_ids: ["label-1", "label-2"],
      })
    ),
    {
      addedMemberCount: 2,
      addedDepartmentCount: 1,
      pinnedTaskCount: 3,
      focusLabelCount: 2,
    }
  );
});
