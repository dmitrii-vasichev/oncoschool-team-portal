import assert from "node:assert/strict";
import test from "node:test";
import {
  getMeetingBoardSectionMeta,
  isMeetingBoardTaskOverdue,
  MEETING_BOARD_SECTIONS,
} from "./meetingBoardUtils.ts";
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
    cancellation_reason: null,
    last_activity_at: "2026-05-07T00:00:00Z",
    escalation_dm_sent_at: null,
    created_at: "2026-05-07T00:00:00Z",
    updated_at: "2026-05-07T00:00:00Z",
    assignee: null,
    created_by: null,
    ...overrides,
  };
}

test("MEETING_BOARD_SECTIONS preserves board group order", () => {
  assert.deepEqual(MEETING_BOARD_SECTIONS, [
    "urgent",
    "new",
    "in_progress",
    "review",
    "done_this_week",
  ]);
});

test("getMeetingBoardSectionMeta returns metadata for all board groups", () => {
  assert.deepEqual(
    MEETING_BOARD_SECTIONS.map((key) => [key, getMeetingBoardSectionMeta(key)]),
    [
      [
        "urgent",
        {
          label: "Срочные",
          tone: "border-priority-urgent-fg/30 bg-priority-urgent-bg/60",
        },
      ],
      [
        "new",
        {
          label: "Новые",
          tone: "border-border/70 bg-card/70",
        },
      ],
      [
        "in_progress",
        {
          label: "В работе",
          tone: "border-status-progress-fg/25 bg-status-progress-bg/50",
        },
      ],
      [
        "review",
        {
          label: "На согласовании",
          tone: "border-status-review-fg/25 bg-status-review-bg/50",
        },
      ],
      [
        "done_this_week",
        {
          label: "Выполнено за 7 дней",
          tone: "border-status-done-fg/25 bg-status-done-bg/50",
        },
      ],
    ]
  );
});

test("isMeetingBoardTaskOverdue ignores done tasks", () => {
  assert.equal(isMeetingBoardTaskOverdue(task({ status: "done", deadline: "2026-05-01" }), new Date("2026-05-07")), false);
});

test("isMeetingBoardTaskOverdue detects active tasks with past deadlines", () => {
  assert.equal(
    isMeetingBoardTaskOverdue(
      task({ status: "in_progress", deadline: "2026-05-01" }),
      new Date("2026-05-07")
    ),
    true
  );
});
