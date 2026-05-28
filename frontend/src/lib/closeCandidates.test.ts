import assert from "node:assert/strict";
import test from "node:test";

import {
  daysOverdue,
  selectCloseCandidates,
  russianDayNoun,
  formatDaysOverdue,
  toggleInSet,
} from "./closeCandidates.ts";
import type { Task } from "./types.ts";

const TODAY = new Date("2026-05-28T12:00:00.000Z");

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? `id-${overrides.short_id ?? 0}`,
    short_id: overrides.short_id ?? 0,
    title: overrides.title ?? "Task",
    description: null,
    checklist: [],
    labels: [],
    status: overrides.status ?? "new",
    priority: "normal",
    assignee_id: null,
    created_by_id: null,
    meeting_id: null,
    source: "text",
    deadline: overrides.deadline ?? null,
    reminder_at: null,
    reminder_comment: null,
    reminder_sent_at: null,
    completed_at: null,
    cancellation_reason: null,
    last_activity_at: "2026-05-01T00:00:00.000Z",
    escalation_dm_sent_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    assignee: null,
    created_by: null,
    ...overrides,
  };
}

test("daysOverdue returns 0 for a null deadline", () => {
  assert.equal(daysOverdue(null, TODAY), 0);
});

test("daysOverdue counts whole days for a past deadline", () => {
  // 14 days before TODAY
  assert.equal(daysOverdue("2026-05-14T12:00:00.000Z", TODAY), 14);
  assert.equal(daysOverdue("2026-05-10T12:00:00.000Z", TODAY), 18);
});

test("daysOverdue clamps future deadlines to 0", () => {
  assert.equal(daysOverdue("2026-06-10T12:00:00.000Z", TODAY), 0);
});

test("selectCloseCandidates includes tasks overdue >= 14 days", () => {
  const tasks = [
    makeTask({ short_id: 1, deadline: "2026-05-14T12:00:00.000Z" }), // 14d
    makeTask({ short_id: 2, deadline: "2026-05-01T12:00:00.000Z" }), // 27d
  ];
  const result = selectCloseCandidates(tasks, TODAY);
  assert.deepEqual(
    result.map((t) => t.short_id),
    [2, 1]
  );
});

test("selectCloseCandidates excludes tasks overdue < 14 days", () => {
  const tasks = [
    makeTask({ short_id: 1, deadline: "2026-05-15T12:00:00.000Z" }), // 13d
    makeTask({ short_id: 2, deadline: null }),
  ];
  assert.deepEqual(selectCloseCandidates(tasks, TODAY), []);
});

test("selectCloseCandidates excludes done and cancelled tasks", () => {
  const tasks = [
    makeTask({
      short_id: 1,
      deadline: "2026-05-01T12:00:00.000Z",
      status: "done",
    }),
    makeTask({
      short_id: 2,
      deadline: "2026-05-01T12:00:00.000Z",
      status: "cancelled",
    }),
    makeTask({
      short_id: 3,
      deadline: "2026-05-01T12:00:00.000Z",
      status: "in_progress",
    }),
  ];
  const result = selectCloseCandidates(tasks, TODAY);
  assert.deepEqual(
    result.map((t) => t.short_id),
    [3]
  );
});

test("selectCloseCandidates sorts most-overdue first", () => {
  const tasks = [
    makeTask({ short_id: 1, deadline: "2026-05-10T12:00:00.000Z" }), // 18d
    makeTask({ short_id: 2, deadline: "2026-04-01T12:00:00.000Z" }), // 57d
    makeTask({ short_id: 3, deadline: "2026-05-12T12:00:00.000Z" }), // 16d
  ];
  const result = selectCloseCandidates(tasks, TODAY);
  assert.deepEqual(
    result.map((t) => t.short_id),
    [2, 1, 3]
  );
});

test("russianDayNoun pluralizes correctly", () => {
  assert.equal(russianDayNoun(1), "день");
  assert.equal(russianDayNoun(2), "дня");
  assert.equal(russianDayNoun(4), "дня");
  assert.equal(russianDayNoun(5), "дней");
  assert.equal(russianDayNoun(11), "дней");
  assert.equal(russianDayNoun(14), "дней");
  assert.equal(russianDayNoun(21), "день");
  assert.equal(russianDayNoun(22), "дня");
  assert.equal(russianDayNoun(25), "дней");
});

test("formatDaysOverdue combines count and noun", () => {
  assert.equal(formatDaysOverdue(18), "18 дней");
  assert.equal(formatDaysOverdue(21), "21 день");
  assert.equal(formatDaysOverdue(22), "22 дня");
});

test("toggleInSet adds a missing id and returns a new set", () => {
  const original = new Set<number>([1, 2]);
  const next = toggleInSet(original, 3);
  assert.deepEqual(Array.from(next).sort(), [1, 2, 3]);
  assert.notEqual(next, original);
  assert.deepEqual(Array.from(original).sort(), [1, 2]);
});

test("toggleInSet removes an existing id", () => {
  const original = new Set<number>([1, 2, 3]);
  const next = toggleInSet(original, 2);
  assert.deepEqual(Array.from(next).sort(), [1, 3]);
  assert.deepEqual(Array.from(original).sort(), [1, 2, 3]);
});
