import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMeetingOutcomePublishPayload,
  canPublishMeetingOutcomes,
  formatMeetingProcessingBadge,
  formatMeetingTranscriptionStatus,
  isMeetingTranscriptionActive,
  shouldShowMeetingTranscriptionStatus,
  splitDraftDecisionsText,
  setAllTaskDraftsSelected,
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

test("setAllTaskDraftsSelected updates every task draft", () => {
  const drafts = [
    taskDraft({ title: "First", selected: true }),
    taskDraft({ title: "Second", selected: false }),
    taskDraft({ title: "Third", selected: true }),
  ];

  assert.deepEqual(setAllTaskDraftsSelected(drafts, false), [
    taskDraft({ title: "First", selected: false }),
    taskDraft({ title: "Second", selected: false }),
    taskDraft({ title: "Third", selected: false }),
  ]);
  assert.deepEqual(setAllTaskDraftsSelected(drafts, true), [
    taskDraft({ title: "First", selected: true }),
    taskDraft({ title: "Second", selected: true }),
    taskDraft({ title: "Third", selected: true }),
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
  assert.equal(canPublishMeetingOutcomes("queued", false), false);
  assert.equal(canPublishMeetingOutcomes("transcript_ready", false), false);
  assert.equal(canPublishMeetingOutcomes("draft_ready", false), true);
  assert.equal(canPublishMeetingOutcomes("draft_ready", true), false);
  assert.equal(canPublishMeetingOutcomes(null, false), false);
});

test("formatMeetingProcessingBadge hides idle and localizes visible statuses", () => {
  assert.equal(formatMeetingProcessingBadge("idle"), null);
  assert.equal(formatMeetingProcessingBadge("queued"), "В очереди");
  assert.equal(formatMeetingProcessingBadge("draft_ready"), "Черновик готов");
  assert.equal(formatMeetingProcessingBadge("published"), "Опубликовано");
  assert.equal(formatMeetingProcessingBadge("failed"), "Ошибка");
});

test("isMeetingTranscriptionActive returns true for queued and transcribing states", () => {
  assert.equal(isMeetingTranscriptionActive("queued"), true);
  assert.equal(isMeetingTranscriptionActive("transcribing"), true);
  assert.equal(isMeetingTranscriptionActive("transcript_ready"), false);
  assert.equal(isMeetingTranscriptionActive("failed"), false);
  assert.equal(isMeetingTranscriptionActive(null), false);
});

test("formatMeetingTranscriptionStatus renders phases and chunk progress", () => {
  assert.equal(
    formatMeetingTranscriptionStatus({
      status: "queued",
      transcription_phase: "queued",
      transcription_current_chunk: 0,
      transcription_total_chunks: 0,
      transcription_progress_percent: 0,
    }),
    "В очереди"
  );
  assert.equal(
    formatMeetingTranscriptionStatus({
      status: "transcribing",
      transcription_phase: "transcribing",
      transcription_current_chunk: 3,
      transcription_total_chunks: 8,
      transcription_progress_percent: 46,
    }),
    "Транскрибируем 3/8"
  );
  assert.equal(
    formatMeetingTranscriptionStatus({
      status: "failed",
      transcription_phase: "failed",
      transcription_current_chunk: 0,
      transcription_total_chunks: 0,
      transcription_progress_percent: 0,
    }),
    "Ошибка транскрибации"
  );
});

test("shouldShowMeetingTranscriptionStatus ignores legacy generic failed states", () => {
  assert.equal(
    shouldShowMeetingTranscriptionStatus({
      status: "failed",
      transcription_phase: null,
    }),
    false
  );
  assert.equal(
    shouldShowMeetingTranscriptionStatus({
      status: "failed",
      transcription_phase: "failed",
    }),
    true
  );
  assert.equal(
    shouldShowMeetingTranscriptionStatus({
      status: "queued",
      transcription_phase: "queued",
    }),
    true
  );
});
