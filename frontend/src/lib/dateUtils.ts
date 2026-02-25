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
export function parseLocalDate(dateStr: string | null | undefined): Date {
  if (typeof dateStr !== "string") return new Date(NaN);
  const normalized = dateStr.trim();
  if (!normalized) return new Date(NaN);

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(normalized + "T00:00:00");
  }
  return new Date(normalized);
}

/**
 * Parse a datetime string from the API as UTC.
 *
 * The backend stores datetimes as naive UTC. Ideally the API sends them
 * with "+00:00" suffix, but for safety: if the string has no timezone
 * indicator (no Z, no +/-offset), append "Z" so JavaScript interprets
 * it as UTC instead of the browser's local timezone.
 */
export function parseUTCDate(dateStr: string | null | undefined): Date {
  if (typeof dateStr !== "string") return new Date(NaN);
  const normalized = dateStr.trim();
  if (!normalized) return new Date(NaN);

  // Already has timezone info (Z or +/-offset) — parse as-is
  if (/Z|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  // No timezone info — treat as UTC
  return new Date(normalized + "Z");
}
