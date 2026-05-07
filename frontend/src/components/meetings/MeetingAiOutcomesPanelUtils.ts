import type { MeetingAIProcessingStatus, MeetingAITaskDraft } from "../../lib/types.ts";

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

export function canPublishMeetingOutcomes(
  status: MeetingAIProcessingStatus | null | undefined,
  busy: boolean
): boolean {
  return status === "draft_ready" && !busy;
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
