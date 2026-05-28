import type { Task } from "./types";

/** Whole days a deadline is past `today`. Null deadline or future deadline → 0. */
export function daysOverdue(deadline: string | null, today: Date): number {
  if (!deadline) return 0;
  const d = new Date(deadline);
  const ms = today.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Tasks overdue >= 14 days, excluding done/cancelled, sorted most-overdue first. */
export function selectCloseCandidates(tasks: Task[], today: Date): Task[] {
  return tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "cancelled" &&
        daysOverdue(t.deadline, today) >= 14
    )
    .sort(
      (a, b) =>
        daysOverdue(b.deadline, today) - daysOverdue(a.deadline, today)
    );
}

/** Russian day-count noun: 1 день / 2 дня / 5 дней. */
export function russianDayNoun(count: number): string {
  const abs = Math.abs(count);
  const lastDigit = abs % 10;
  const lastTwoDigits = abs % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return "день";
  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
  ) {
    return "дня";
  }
  return "дней";
}

/** Human-readable overdue label, e.g. "18 дней". */
export function formatDaysOverdue(days: number): string {
  return `${days} ${russianDayNoun(days)}`;
}

/** Returns a NEW set with `id` toggled in/out — never mutates the input. */
export function toggleInSet(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}
