import type { MeetingTranscriptSource } from "../../lib/types.ts";

export type MeetingSummaryDisplayState =
  | "published"
  | "awaiting_outcomes"
  | "needs_transcript";

export function getMeetingTranscriptSourceLabel(
  source: MeetingTranscriptSource | null | undefined
): string {
  switch (source) {
    case "zoom_api":
      return "Zoom API";
    case "openai_audio":
      return "Распознано из аудио";
    case "manual":
    default:
      return "Вставлено вручную";
  }
}

export function hasPublishedMeetingSummary(
  parsedSummary: string | null | undefined
): boolean {
  return Boolean(parsedSummary?.trim());
}

function hasMeetingTranscript(transcript: string | null | undefined): boolean {
  return Boolean(transcript?.trim());
}

export function getMeetingSummaryDisplayState({
  transcript,
  parsed_summary,
}: {
  transcript: string | null | undefined;
  parsed_summary: string | null | undefined;
}): MeetingSummaryDisplayState {
  if (hasPublishedMeetingSummary(parsed_summary)) return "published";
  if (hasMeetingTranscript(transcript)) return "awaiting_outcomes";
  return "needs_transcript";
}
