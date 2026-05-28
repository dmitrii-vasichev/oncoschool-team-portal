import assert from "node:assert/strict";
import test from "node:test";

import { summarizeBulkResult } from "./bulkResult.ts";

test("summarizeBulkResult reports only successes when none failed", () => {
  assert.equal(
    summarizeBulkResult({ succeeded: 3, failed: [] }),
    "Обновлено: 3"
  );
});

test("summarizeBulkResult reports successes and failures on partial failure", () => {
  assert.equal(
    summarizeBulkResult({
      succeeded: 2,
      failed: [{ short_id: 7, error: "forbidden" }],
    }),
    "Обновлено: 2, ошибок: 1"
  );
});

test("summarizeBulkResult reports all-fail case", () => {
  assert.equal(
    summarizeBulkResult({
      succeeded: 0,
      failed: [
        { short_id: 7, error: "forbidden" },
        { short_id: 8, error: "not found" },
      ],
    }),
    "Обновлено: 0, ошибок: 2"
  );
});
