import assert from "node:assert/strict";
import test from "node:test";

import {
  completedSinceParam,
  filterTasksCompletedSince,
  getDashboardTaskPreview,
  sortDashboardActiveTasks,
  sortDashboardCompletedTasks,
  sortDashboardOverdueTasks,
  splitDashboardOpenTasks,
} from "./dashboardTaskUtils.ts";

type TaskFixture = {
  id: string;
  status: string;
  priority: string;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function task(overrides: Partial<TaskFixture> & { id: string }): TaskFixture {
  return {
    status: "new",
    priority: "normal",
    deadline: null,
    completed_at: null,
    created_at: "2026-05-01T10:00:00.000Z",
    updated_at: "2026-05-01T10:00:00.000Z",
    ...overrides,
  };
}

test("completedSinceParam keeps the seven-day cutoff tied to the current time", () => {
  const now = new Date("2026-05-08T12:00:00.000Z");

  assert.equal(completedSinceParam(now), "2026-05-01T12:00:00.000Z");
});

test("filterTasksCompletedSince drops old or incomplete done tasks from API responses", () => {
  const completedSince = new Date("2026-05-01T12:00:00.000Z");
  const tasks = [
    task({ id: "feb", status: "done", completed_at: "2026-02-23T10:00:00.000Z" }),
    task({ id: "recent", status: "done", completed_at: "2026-05-06T10:00:00.000Z" }),
    task({ id: "boundary", status: "done", completed_at: "2026-05-01T12:00:00.000Z" }),
    task({ id: "open", status: "review", completed_at: "2026-05-06T10:00:00.000Z" }),
    task({ id: "missing", status: "done", completed_at: null }),
    task({ id: "invalid", status: "done", completed_at: "not-a-date" }),
  ];

  assert.deepEqual(
    filterTasksCompletedSince(tasks, completedSince).map((item) => item.id),
    ["recent", "boundary"],
  );
});

test("sortDashboardActiveTasks prioritizes urgent overdue and nearest deadlines", () => {
  const today = new Date("2026-05-08T12:00:00.000Z");
  const tasks = [
    task({ id: "newest-generic", created_at: "2026-05-08T11:00:00.000Z" }),
    task({ id: "normal-nearest", deadline: "2026-05-09", created_at: "2026-05-01T11:00:00.000Z" }),
    task({ id: "urgent-future", priority: "urgent", deadline: "2026-05-10", created_at: "2026-05-01T12:00:00.000Z" }),
    task({ id: "urgent-overdue", priority: "urgent", deadline: "2026-05-06", created_at: "2026-05-01T13:00:00.000Z" }),
    task({ id: "normal-overdue", deadline: "2026-05-05", created_at: "2026-05-01T14:00:00.000Z" }),
  ];

  assert.deepEqual(
    sortDashboardActiveTasks(tasks, today).map((item) => item.id),
    ["urgent-overdue", "urgent-future", "normal-overdue", "normal-nearest", "newest-generic"],
  );
});

test("splitDashboardOpenTasks separates overdue tasks without duplicating ids", () => {
  const today = new Date("2026-05-08T12:00:00.000Z");
  const tasks = [
    task({ id: "normal", deadline: "2026-05-10" }),
    task({ id: "overdue", deadline: "2026-05-01" }),
    task({ id: "done-overdue", status: "done", deadline: "2026-05-01" }),
    task({ id: "cancelled-overdue", status: "cancelled", deadline: "2026-05-01" }),
  ];

  const grouped = splitDashboardOpenTasks(tasks, today);

  assert.deepEqual(grouped.overdue.map((item) => item.id), ["overdue"]);
  assert.deepEqual(grouped.active.map((item) => item.id), ["normal"]);
  assert.deepEqual(
    [...grouped.overdue, ...grouped.active].map((item) => item.id),
    ["overdue", "normal"],
  );
});

test("sortDashboardOverdueTasks prioritizes urgent tasks then oldest missed deadline", () => {
  const tasks = [
    task({ id: "normal-newer-miss", deadline: "2026-05-07", created_at: "2026-05-03T10:00:00.000Z" }),
    task({ id: "urgent-newer-miss", priority: "urgent", deadline: "2026-05-06", created_at: "2026-05-02T10:00:00.000Z" }),
    task({ id: "normal-oldest-miss", deadline: "2026-05-01", created_at: "2026-05-04T10:00:00.000Z" }),
    task({ id: "urgent-oldest-miss", priority: "urgent", deadline: "2026-05-02", created_at: "2026-05-01T10:00:00.000Z" }),
  ];

  assert.deepEqual(
    sortDashboardOverdueTasks(tasks).map((item) => item.id),
    ["urgent-oldest-miss", "urgent-newer-miss", "normal-oldest-miss", "normal-newer-miss"],
  );
});

test("sortDashboardCompletedTasks keeps most recently completed first with updated fallback", () => {
  const tasks = [
    task({ id: "older-completion", status: "done", completed_at: "2026-05-04T10:00:00.000Z" }),
    task({
      id: "same-completion-newer-update",
      status: "done",
      completed_at: "2026-05-06T10:00:00.000Z",
      updated_at: "2026-05-06T12:00:00.000Z",
    }),
    task({
      id: "same-completion-older-update",
      status: "done",
      completed_at: "2026-05-06T10:00:00.000Z",
      updated_at: "2026-05-06T11:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    sortDashboardCompletedTasks(tasks).map((item) => item.id),
    ["same-completion-newer-update", "same-completion-older-update", "older-completion"],
  );
});

test("getDashboardTaskPreview returns five items when collapsed and every loaded item when expanded", () => {
  const tasks = Array.from({ length: 8 }, (_, index) =>
    task({ id: `task-${index + 1}` }),
  );

  assert.deepEqual(
    getDashboardTaskPreview(tasks, false).map((item) => item.id),
    ["task-1", "task-2", "task-3", "task-4", "task-5"],
  );
  assert.deepEqual(
    getDashboardTaskPreview(tasks, true).map((item) => item.id),
    ["task-1", "task-2", "task-3", "task-4", "task-5", "task-6", "task-7", "task-8"],
  );
});
