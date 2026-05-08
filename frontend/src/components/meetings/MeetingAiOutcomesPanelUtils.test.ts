import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMeetingOutcomePublishPayload,
  canPublishMeetingOutcomes,
  formatMeetingProcessingBadge,
  formatMeetingTranscriptionStatus,
  getSelectedTaskDraftsMissingAssignee,
  isMeetingTranscriptionActive,
  prepareMeetingOutcomeTaskDraftsForPublish,
  shouldShowMeetingTranscriptionStatus,
  splitDraftDecisionsText,
  setAllTaskDraftsSelected,
  setTaskDraftAssignee,
  toggleTaskDraftSelected,
} from "./MeetingAiOutcomesPanelUtils.ts";
import type { MeetingAITaskDraft, TeamMember } from "../../lib/types.ts";

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

function teamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: "member-1",
    telegram_id: null,
    telegram_username: null,
    full_name: "Мария Иванова",
    name_variants: ["Мария", "Маша"],
    department_id: null,
    extra_department_ids: [],
    position: null,
    email: null,
    birthday: null,
    avatar_url: null,
    role: "member",
    is_test: false,
    is_active: true,
    created_at: "2026-05-08T00:00:00Z",
    updated_at: "2026-05-08T00:00:00Z",
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

test("getSelectedTaskDraftsMissingAssignee ignores skipped tasks and resolves name variants", () => {
  const members = [teamMember()];
  const drafts = [
    taskDraft({ title: "Resolved by id", assignee_id: "member-1", assignee_name: null }),
    taskDraft({ title: "Resolved by variant", assignee_id: null, assignee_name: "Маша" }),
    taskDraft({ title: "Skipped missing", selected: false, assignee_id: null, assignee_name: null }),
    taskDraft({ title: "Selected missing", assignee_id: null, assignee_name: null }),
  ];

  assert.deepEqual(getSelectedTaskDraftsMissingAssignee(drafts, members), [
    taskDraft({ title: "Selected missing", assignee_id: null, assignee_name: null }),
  ]);
});

test("setTaskDraftAssignee and prepareMeetingOutcomeTaskDraftsForPublish store resolved member ids", () => {
  const maria = teamMember();
  const drafts = [
    taskDraft({ title: "Manual assignment", assignee_id: null, assignee_name: null }),
    taskDraft({ title: "Name from AI", assignee_id: null, assignee_name: "Мария" }),
  ];

  assert.deepEqual(setTaskDraftAssignee(drafts, 0, maria), [
    taskDraft({
      title: "Manual assignment",
      assignee_id: "member-1",
      assignee_name: "Мария Иванова",
    }),
    taskDraft({ title: "Name from AI", assignee_id: null, assignee_name: "Мария" }),
  ]);

  assert.deepEqual(prepareMeetingOutcomeTaskDraftsForPublish(drafts, [maria]), [
    taskDraft({ title: "Manual assignment", assignee_id: null, assignee_name: null }),
    taskDraft({
      title: "Name from AI",
      assignee_id: "member-1",
      assignee_name: "Мария Иванова",
    }),
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
