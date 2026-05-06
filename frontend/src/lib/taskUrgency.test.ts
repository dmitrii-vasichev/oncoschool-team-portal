import assert from "node:assert/strict";
import test from "node:test";

import {
  isTaskUrgent,
  normalizeTaskUrgency,
  TASK_URGENCY_LABELS,
} from "./taskUrgency.ts";

test("normalizeTaskUrgency maps legacy values to binary urgency", () => {
  assert.equal(normalizeTaskUrgency("urgent"), "urgent");
  assert.equal(normalizeTaskUrgency("high"), "urgent");
  assert.equal(normalizeTaskUrgency("срочно"), "urgent");
  assert.equal(normalizeTaskUrgency("medium"), "normal");
  assert.equal(normalizeTaskUrgency("low"), "normal");
  assert.equal(normalizeTaskUrgency("normal"), "normal");
  assert.equal(normalizeTaskUrgency("не срочно"), "normal");
  assert.equal(normalizeTaskUrgency(undefined), "normal");
});

test("isTaskUrgent reads legacy high as urgent", () => {
  assert.equal(isTaskUrgent("high"), true);
  assert.equal(isTaskUrgent("urgent"), true);
  assert.equal(isTaskUrgent("medium"), false);
});

test("TASK_URGENCY_LABELS uses user-facing Russian labels", () => {
  assert.deepEqual(TASK_URGENCY_LABELS, {
    normal: "Обычная",
    urgent: "Срочная",
  });
});
