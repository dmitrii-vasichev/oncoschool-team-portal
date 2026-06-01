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

export function milestoneText(e: {
  milestone_kind?: "total" | "month" | "no_overdue";
  milestone_count?: number;
  period?: string;
  actor_name?: string | null;
}): string {
  if (e.milestone_kind === "total") {
    return `🎉 Команда закрыла ${e.milestone_count} задач!`;
  }
  if (e.milestone_kind === "month") {
    return `🎉 За ${formatPeriod(e.period)} команда закрыла ${e.milestone_count} задач`;
  }
  return `🛡️ ${e.actor_name ?? "Коллега"} — месяц без единой просрочки`;
}
