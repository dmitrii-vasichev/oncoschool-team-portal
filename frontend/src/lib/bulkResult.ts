import type { BulkResult } from "./types";

/**
 * Short Russian summary of a partial-success bulk result,
 * e.g. "Обновлено: 3" or "Обновлено: 2, ошибок: 1".
 */
export function summarizeBulkResult(result: BulkResult): string {
  const failedCount = result.failed.length;
  if (failedCount === 0) {
    return `Обновлено: ${result.succeeded}`;
  }
  return `Обновлено: ${result.succeeded}, ошибок: ${failedCount}`;
}
