import type { PulseEventType } from "@/lib/types";

// Nominative case — fits the "За <month> <year>" phrasing.
const RU_MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

const RECOGNITION: PulseEventType[] = ["kudos", "milestone_team", "milestone_personal"];

export function isRecognitionEvent(t: PulseEventType): boolean {
  return RECOGNITION.includes(t);
}

export function kudosText(e: {
  actor_name?: string | null;
  recipient_name?: string | null;
  message?: string;
}): { who: string; recipient: string; message: string } {
  return {
    who: e.actor_name ?? "Кто-то",
    recipient: e.recipient_name ?? "коллегу",
    message: e.message ?? "",
  };
}

function formatPeriod(period?: string): string {
  if (!period) return "";
  const [y, m] = period.split("-").map((x) => parseInt(x, 10));
  if (!y || !m) return period;
  return `${RU_MONTHS[m - 1]} ${y}`;
}

function pluralTasks(n: number): string {
  const n100 = n % 100;
  if (n100 >= 11 && n100 <= 14) return "задач";
  const n10 = n % 10;
  if (n10 === 1) return "задачу";
  if (n10 >= 2 && n10 <= 4) return "задачи";
  return "задач";
}

export function milestoneText(e: {
  milestone_kind?: "total" | "month" | "no_overdue";
  milestone_count?: number;
  period?: string;
  actor_name?: string | null;
}): string {
  if (e.milestone_kind === "total") {
    const n = e.milestone_count ?? 0;
    return `Команда закрыла ${n} ${pluralTasks(n)}!`;
  }
  if (e.milestone_kind === "month") {
    const n = e.milestone_count ?? 0;
    return `За ${formatPeriod(e.period)} команда закрыла ${n} ${pluralTasks(n)}`;
  }
  return `${e.actor_name ?? "Коллега"} — месяц без единой просрочки`;
}
