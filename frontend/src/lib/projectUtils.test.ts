import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_STATUS_LABELS,
  canCompleteProject,
  formatProjectDepartmentProgress,
  formatProjectMilestoneProgress,
  formatProjectTaskProgress,
} from "./projectUtils.ts";

test("project labels expose Russian status names", () => {
  assert.equal(PROJECT_STATUS_LABELS.planned, "Запланирован");
  assert.equal(PROJECT_STATUS_LABELS.in_progress, "В работе");
  assert.equal(PROJECT_STATUS_LABELS.completed, "Завершён");
});

test("project completion uses backend completion flag", () => {
  assert.equal(canCompleteProject({ can_complete: true }), true);
  assert.equal(canCompleteProject({ can_complete: false }), false);
});

test("project progress formatters show milestones departments and tasks", () => {
  const project = {
    departments: [{ status: "ready" }, { status: "in_progress" }],
    completed_milestone_count: 1,
    milestone_count: 3,
    completed_linked_task_count: 2,
    linked_task_count: 5,
    task_links: [],
  };

  assert.equal(formatProjectDepartmentProgress(project), "1/2 отделов готово");
  assert.equal(formatProjectMilestoneProgress(project), "1/3 этапов готово");
  assert.equal(formatProjectTaskProgress(project), "2/5 задач закрыто");
});
