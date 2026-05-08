import type {
  MeetingAIProcessingStatus,
  MeetingAITaskDraft,
  TeamMember,
} from "../../lib/types.ts";

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

export function setAllTaskDraftsSelected(
  taskDrafts: MeetingAITaskDraft[],
  selected: boolean
): MeetingAITaskDraft[] {
  return taskDrafts.map((task) =>
    task.selected === selected ? task : { ...task, selected }
  );
}

function normalizeAssigneeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("ru-RU");
}

function memberMatchesAssigneeName(member: TeamMember, assigneeName: string): boolean {
  const normalizedName = normalizeAssigneeName(assigneeName);
  if (!normalizedName) return false;
  if (normalizeAssigneeName(member.full_name) === normalizedName) return true;
  const firstName = normalizeAssigneeName(member.full_name.split(" ")[0]);
  if (firstName === normalizedName) return true;
  return member.name_variants.some(
    (variant) => normalizeAssigneeName(variant) === normalizedName
  );
}

export function resolveTaskDraftAssignee(
  taskDraft: MeetingAITaskDraft,
  members: TeamMember[]
): TeamMember | null {
  const activeMembers = members.filter((member) => member.is_active);
  if (taskDraft.assignee_id) {
    const memberById = activeMembers.find((member) => member.id === taskDraft.assignee_id);
    if (memberById) return memberById;
  }
  const assigneeName = taskDraft.assignee_name;
  if (!assigneeName) return null;
  return (
    activeMembers.find((member) =>
      memberMatchesAssigneeName(member, assigneeName)
    ) ?? null
  );
}

export function getSelectedTaskDraftsMissingAssignee(
  taskDrafts: MeetingAITaskDraft[],
  members: TeamMember[]
): MeetingAITaskDraft[] {
  return taskDrafts.filter(
    (taskDraft) => taskDraft.selected && !resolveTaskDraftAssignee(taskDraft, members)
  );
}

export function setTaskDraftAssignee(
  taskDrafts: MeetingAITaskDraft[],
  index: number,
  member: TeamMember | null
): MeetingAITaskDraft[] {
  return taskDrafts.map((task, taskIndex) =>
    taskIndex === index
      ? {
          ...task,
          assignee_id: member?.id ?? null,
          assignee_name: member?.full_name ?? null,
        }
      : task
  );
}

export function prepareMeetingOutcomeTaskDraftsForPublish(
  taskDrafts: MeetingAITaskDraft[],
  members: TeamMember[]
): MeetingAITaskDraft[] {
  return taskDrafts.map((taskDraft) => {
    const assignee = resolveTaskDraftAssignee(taskDraft, members);
    return assignee
      ? {
          ...taskDraft,
          assignee_id: assignee.id,
          assignee_name: assignee.full_name,
        }
      : taskDraft;
  });
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

export function canPublishMeetingOutcomes(
  status: MeetingAIProcessingStatus | null | undefined,
  busy: boolean
): boolean {
  return status === "draft_ready" && !busy;
}

export function formatMeetingProcessingBadge(
  status: MeetingAIProcessingStatus | null | undefined
): string | null {
  switch (status) {
    case "queued":
      return "В очереди";
    case "recording_not_ready":
      return "Запись недоступна";
    case "recording_ready":
      return "Запись готова";
    case "transcribing":
      return "Транскрибируется";
    case "transcript_ready":
      return "Транскрипция готова";
    case "draft_ready":
      return "Черновик готов";
    case "published":
      return "Опубликовано";
    case "failed":
      return "Ошибка";
    case "idle":
    default:
      return null;
  }
}

export function isMeetingTranscriptionActive(
  status: MeetingAIProcessingStatus | null | undefined
): boolean {
  return status === "queued" || status === "transcribing";
}

export function formatMeetingTranscriptionStatus({
  status,
  transcription_phase,
  transcription_current_chunk,
  transcription_total_chunks,
  transcription_progress_percent,
}: {
  status: MeetingAIProcessingStatus | null | undefined;
  transcription_phase?: string | null;
  transcription_current_chunk?: number | null;
  transcription_total_chunks?: number | null;
  transcription_progress_percent?: number | null;
}): string {
  if (status === "failed" || transcription_phase === "failed") {
    return "Ошибка транскрибации";
  }
  if (status === "transcript_ready" || transcription_phase === "completed") {
    return "Транскрипция готова";
  }
  if (transcription_phase === "queued" || status === "queued") {
    return "В очереди";
  }
  if (transcription_phase === "downloading") {
    return "Скачиваем запись";
  }
  if (transcription_phase === "preparing_audio") {
    return "Готовим аудио";
  }
  if (transcription_phase === "saving") {
    return "Сохраняем результат";
  }
  if (transcription_phase === "transcribing" || status === "transcribing") {
    const currentChunk = transcription_current_chunk ?? 0;
    const totalChunks = transcription_total_chunks ?? 0;
    if (currentChunk > 0 && totalChunks > 0) {
      return `Транскрибируем ${currentChunk}/${totalChunks}`;
    }
    if (
      typeof transcription_progress_percent === "number" &&
      transcription_progress_percent > 0
    ) {
      return `Транскрибируем ${transcription_progress_percent}%`;
    }
    return "Транскрибируем";
  }
  return status ?? "idle";
}

export function shouldShowMeetingTranscriptionStatus({
  status,
  transcription_phase,
}: {
  status: MeetingAIProcessingStatus | null | undefined;
  transcription_phase?: string | null;
}): boolean {
  return (
    isMeetingTranscriptionActive(status) ||
    status === "transcript_ready" ||
    transcription_phase === "completed" ||
    transcription_phase === "failed"
  );
}
