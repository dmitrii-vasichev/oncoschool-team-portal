import assert from "node:assert/strict";
import test from "node:test";

import { formatProjectEvent } from "./projectEventUtils.ts";
import type { ProjectEvent } from "./types.ts";

function event(event_type: string, payload: Record<string, unknown>): ProjectEvent {
  return {
    id: "event-1",
    project_id: "project-1",
    actor_id: "member-1",
    event_type,
    payload,
    created_at: "2026-05-13T07:13:00",
    actor: null,
  };
}

test("formatProjectEvent renders status changes with Russian status labels", () => {
  const formatted = formatProjectEvent(
    event("status_changed", {
      old_status: "planned",
      new_status: "in_progress",
    }),
  );

  assert.equal(formatted.title, "Статус изменён");
  assert.equal(formatted.detail, "Запланирован → В работе");
});

test("formatProjectEvent avoids raw event keys", () => {
  assert.equal(formatProjectEvent(event("project_created", {})).title, "Проект создан");
  assert.equal(formatProjectEvent(event("task_linked", {})).title, "Создана задача по проекту");
});
