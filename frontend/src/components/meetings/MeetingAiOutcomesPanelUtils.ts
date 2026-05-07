import type { MeetingAITaskDraft } from "../../lib/types.ts";

export function splitDraftDecisionsText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function toggleTaskDraftSelected(
  taskDrafts: MeetingAITaskDraft[],
  index: number,
  selected: boolean
): MeetingAITaskDraft[] {
  return taskDrafts.map((task, taskIndex) =>
    taskIndex === index ? { ...task, selected } : task
  );
}

export function buildMeetingOutcomePublishPayload({
  summary,
  decisionsText,
  taskDrafts,
}: {
  summary: string;
  decisionsText: string;
  taskDrafts: MeetingAITaskDraft[];
}): {
  draft_summary: string;
  draft_decisions: string[];
  draft_tasks: MeetingAITaskDraft[];
} {
  return {
    draft_summary: summary,
    draft_decisions: splitDraftDecisionsText(decisionsText),
    draft_tasks: taskDrafts,
  };
}
