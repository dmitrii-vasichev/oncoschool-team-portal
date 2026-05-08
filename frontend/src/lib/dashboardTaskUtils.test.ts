import assert from "node:assert/strict";
import test from "node:test";

import {
  completedSinceParam,
  filterTasksCompletedSince,
} from "./dashboardTaskUtils.ts";

test("completedSinceParam keeps the seven-day cutoff tied to the current time", () => {
  const now = new Date("2026-05-08T12:00:00.000Z");

  assert.equal(completedSinceParam(now), "2026-05-01T12:00:00.000Z");
});

test("filterTasksCompletedSince drops old or incomplete done tasks from API responses", () => {
  const completedSince = new Date("2026-05-01T12:00:00.000Z");
  const tasks = [
    { id: "feb", status: "done", completed_at: "2026-02-23T10:00:00.000Z" },
    { id: "recent", status: "done", completed_at: "2026-05-06T10:00:00.000Z" },
    { id: "boundary", status: "done", completed_at: "2026-05-01T12:00:00.000Z" },
    { id: "open", status: "review", completed_at: "2026-05-06T10:00:00.000Z" },
    { id: "missing", status: "done", completed_at: null },
    { id: "invalid", status: "done", completed_at: "not-a-date" },
  ];

  assert.deepEqual(
    filterTasksCompletedSince(tasks, completedSince).map((task) => task.id),
    ["recent", "boundary"],
  );
});
