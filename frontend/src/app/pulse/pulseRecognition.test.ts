import { test } from "node:test";
import assert from "node:assert/strict";
import { kudosText, milestoneText, isRecognitionEvent } from "./pulseRecognition.ts";

test("kudosText composes giver, recipient and message", () => {
  const r = kudosText({ actor_name: "Дмитрий", recipient_name: "Анна", message: "спасибо!" });
  assert.equal(r.who, "Дмитрий");
  assert.equal(r.recipient, "Анна");
  assert.equal(r.message, "спасибо!");
});

test("milestoneText handles team total", () => {
  assert.equal(milestoneText({ milestone_kind: "total", milestone_count: 1000 }), "🎉 Команда закрыла 1000 задач!");
});

test("milestoneText handles team month", () => {
  assert.equal(milestoneText({ milestone_kind: "month", milestone_count: 42, period: "2026-05" }), "🎉 За май 2026 команда закрыла 42 задач");
});

test("milestoneText handles personal no_overdue", () => {
  assert.equal(milestoneText({ milestone_kind: "no_overdue", actor_name: "Анна" }), "🛡️ Анна — месяц без единой просрочки");
});

test("isRecognitionEvent flags new types only", () => {
  assert.equal(isRecognitionEvent("kudos"), true);
  assert.equal(isRecognitionEvent("milestone_team"), true);
  assert.equal(isRecognitionEvent("task_completed"), false);
});
