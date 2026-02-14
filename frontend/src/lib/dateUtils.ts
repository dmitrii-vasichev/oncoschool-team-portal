/**
 * Parse a date string as a local date.
 *
 * JS `new Date("2026-02-14")` treats date-only strings as UTC midnight,
 * which shifts to the previous day in UTC+ timezones (e.g. Moscow UTC+3
 * shows Feb 13 instead of Feb 14).
 *
 * Adding `T00:00:00` (without `Z`) forces local interpretation.
 * Full ISO datetime strings (with time/timezone) pass through unchanged.
 */
export function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T00:00:00");
  }
  return new Date(dateStr);
}
