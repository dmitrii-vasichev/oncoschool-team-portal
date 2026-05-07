import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMeetingOutcomePublishPayload,
  canPublishMeetingOutcomes,
  splitDraftDecisionsText,
  toggleTaskDraftSelected,
} from "./MeetingAiOutcomesPanelUtils.ts";
import type { MeetingAITaskDraft } from "../../lib/types.ts";

function taskDraft(overrides: Partial<MeetingAITaskDraft> = {}): MeetingAITaskDraft {
  return {
    title: "Prepare report",
    description: null,
    assignee_name: null,
    assignee_id: null,
    deadline: null,
    priority: "normal",
    selected: true,
    ...overrides,
  };
}

test("splitDraftDecisionsText trims lines and drops empty decisions", () => {
  assert.deepEqual(
    splitDraftDecisionsText("  Первый пункт\n\nВторой пункт  \n   \nТретий пункт"),
    ["Первый пункт", "Второй пункт", "Третий пункт"]
  );
});

test("toggleTaskDraftSelected updates only the requested task", () => {
  const drafts = [
    taskDraft({ title: "First", selected: true }),
    taskDraft({ title: "Second", selected: false }),
  ];

  assert.deepEqual(toggleTaskDraftSelected(drafts, 1, true), [
    taskDraft({ title: "First", selected: true }),
    taskDraft({ title: "Second", selected: true }),
  ]);
});

test("buildMeetingOutcomePublishPayload preserves edited summary, decisions, tasks, and selected flags", () => {
  const tasks = [
    taskDraft({ title: "Publish notes", selected: true }),
    taskDraft({ title: "Create skipped task", selected: false }),
  ];

  assert.deepEqual(
    buildMeetingOutcomePublishPayload({
      summary: "  Итоги встречи  ",
      decisionsText: " Решение 1 \n\n Решение 2 ",
      taskDrafts: tasks,
    }),
    {
      draft_summary: "  Итоги встречи  ",
      draft_decisions: ["Решение 1", "Решение 2"],
      draft_tasks: tasks,
    }
  );
});

test("canPublishMeetingOutcomes allows publishing only draft_ready outcomes when idle", () => {
  assert.equal(canPublishMeetingOutcomes("transcript_ready", false), false);
  assert.equal(canPublishMeetingOutcomes("draft_ready", false), true);
  assert.equal(canPublishMeetingOutcomes("draft_ready", true), false);
  assert.equal(canPublishMeetingOutcomes(null, false), false);
});
