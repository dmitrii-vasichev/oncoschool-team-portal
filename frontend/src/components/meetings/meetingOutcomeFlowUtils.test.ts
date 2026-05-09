import assert from "node:assert/strict";
import test from "node:test";
import {
  getMeetingSummaryDisplayState,
  getMeetingTranscriptSourceLabel,
  hasPublishedMeetingSummary,
} from "./meetingOutcomeFlowUtils.ts";

test("getMeetingTranscriptSourceLabel distinguishes audio transcription from manual text", () => {
  assert.equal(getMeetingTranscriptSourceLabel("zoom_api"), "Zoom API");
  assert.equal(
    getMeetingTranscriptSourceLabel("openai_audio"),
    "Распознано из аудио"
  );
  assert.equal(getMeetingTranscriptSourceLabel("manual"), "Вставлено вручную");
  assert.equal(getMeetingTranscriptSourceLabel(null), "Вставлено вручную");
});

test("hasPublishedMeetingSummary requires non-empty saved summary text", () => {
  assert.equal(hasPublishedMeetingSummary("Итоги встречи"), true);
  assert.equal(hasPublishedMeetingSummary("   "), false);
  assert.equal(hasPublishedMeetingSummary(null), false);
});

test("getMeetingSummaryDisplayState treats transcript without summary as awaiting published outcomes", () => {
  assert.equal(
    getMeetingSummaryDisplayState({
      transcript: "Полная транскрипция",
      parsed_summary: null,
    }),
    "awaiting_outcomes"
  );
  assert.equal(
    getMeetingSummaryDisplayState({
      transcript: "Полная транскрипция",
      parsed_summary: "Готовые итоги",
    }),
    "published"
  );
  assert.equal(
    getMeetingSummaryDisplayState({
      transcript: null,
      parsed_summary: null,
    }),
    "needs_transcript"
  );
});
