import assert from "node:assert/strict";
import test from "node:test";

import {
  IDEA_STATUS_LABELS,
  canCompleteIdea,
  countReadyIdeaDepartments,
} from "./ideaUtils.ts";

test("idea labels expose Russian status names used by the Ideas UI", () => {
  assert.equal(IDEA_STATUS_LABELS.in_tasks, "В задачах");
  assert.equal(IDEA_STATUS_LABELS.completed, "Завершена");
});

test("countReadyIdeaDepartments counts ready and not required departments", () => {
  assert.equal(
    countReadyIdeaDepartments([
      { status: "ready" },
      { status: "not_required" },
      { status: "in_progress" },
    ]),
    2,
  );
});

test("canCompleteIdea returns the backend completion flag", () => {
  assert.equal(canCompleteIdea({ can_complete: true }), true);
  assert.equal(canCompleteIdea({ can_complete: false }), false);
});
