import assert from "node:assert/strict";
import test from "node:test";
import { getMeetingBoardSectionMeta, isMeetingBoardTaskOverdue } from "./meetingBoardUtils.ts";
import type { Task } from "../../lib/types.ts";

function task(overrides: Partial<Task>): Task {
  return {
    id: "task-id",
    short_id: 1,
    title: "Task",
    description: null,
    checklist: [],
    labels: [],
    status: "in_progress",
    priority: "normal",
    assignee_id: null,
    created_by_id: null,
    meeting_id: null,
    source: "web",
    deadline: null,
    reminder_at: null,
    reminder_comment: null,
    reminder_sent_at: null,
    completed_at: null,
    created_at: "2026-05-07T00:00:00Z",
    updated_at: "2026-05-07T00:00:00Z",
    assignee: null,
    created_by: null,
    ...overrides,
  };
}

test("getMeetingBoardSectionMeta labels done section as done this week", () => {
  assert.equal(getMeetingBoardSectionMeta("done_this_week").label, "Выполнено за неделю");
});

test("isMeetingBoardTaskOverdue ignores done tasks", () => {
  assert.equal(isMeetingBoardTaskOverdue(task({ status: "done", deadline: "2026-05-01" }), new Date("2026-05-07")), false);
});
