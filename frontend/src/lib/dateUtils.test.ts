import assert from "node:assert/strict";
import test from "node:test";

import { formatDateOnly, toLocalDateString } from "./dateUtils.ts";

function withTimezone(timeZone: string, callback: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;

  try {
    callback();
  } finally {
    if (previous === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previous;
    }
  }
}

test("formatDateOnly keeps chart labels stable for date-only API values", () => {
  withTimezone("America/Denver", () => {
    assert.equal(
      new Date("2026-03-21").toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      }),
      "20.03"
    );
    assert.equal(formatDateOnly("2026-03-21"), "21.03");
    assert.equal(
      formatDateOnly("2026-03-21", { includeYear: true }),
      "21.03.2026"
    );
  });
});

test("toLocalDateString preserves the local calendar day for API requests", () => {
  withTimezone("America/Denver", () => {
    const yesterdayEvening = new Date("2026-03-21T18:00:00-06:00");

    assert.equal(yesterdayEvening.toISOString().split("T")[0], "2026-03-22");
    assert.equal(toLocalDateString(yesterdayEvening), "2026-03-21");
  });
});
