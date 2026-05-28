import assert from "node:assert/strict";
import test from "node:test";

import {
  CANCELLATION_REASON_LABELS,
  USER_CANCELLATION_REASONS,
  humanizeCancellationReason,
} from "./cancellation.ts";

test("humanizeCancellationReason maps known user-facing codes to labels", () => {
  assert.equal(humanizeCancellationReason("completed"), "Уже выполнено");
  assert.equal(humanizeCancellationReason("obsolete"), "Потеряло актуальность");
  assert.equal(humanizeCancellationReason("duplicate"), "Дубль другой задачи");
  assert.equal(humanizeCancellationReason("other"), "Другое");
});

test("humanizeCancellationReason maps the system-only auto_inactivity code", () => {
  assert.equal(
    humanizeCancellationReason("auto_inactivity"),
    "Авто (неактивность)"
  );
});

test("humanizeCancellationReason returns unknown codes unchanged", () => {
  assert.equal(humanizeCancellationReason("mystery_code"), "mystery_code");
});

test("humanizeCancellationReason returns empty string for null/undefined", () => {
  assert.equal(humanizeCancellationReason(null), "");
  assert.equal(humanizeCancellationReason(undefined), "");
  assert.equal(humanizeCancellationReason(""), "");
});

test("USER_CANCELLATION_REASONS excludes the system-only auto_inactivity code", () => {
  const codes = USER_CANCELLATION_REASONS.map((reason) => reason.code);
  assert.deepEqual(codes, ["completed", "obsolete", "duplicate", "other"]);
  assert.ok(!codes.includes("auto_inactivity" as never));
});

test("USER_CANCELLATION_REASONS labels stay in sync with the label map", () => {
  for (const reason of USER_CANCELLATION_REASONS) {
    assert.equal(reason.label, CANCELLATION_REASON_LABELS[reason.code]);
  }
});
