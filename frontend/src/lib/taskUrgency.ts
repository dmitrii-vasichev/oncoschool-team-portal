export type TaskUrgency = "normal" | "urgent";

export const TASK_URGENCY_LABELS: Record<TaskUrgency, string> = {
  normal: "Обычная",
  urgent: "Срочная",
};

const urgentAliases = new Set([
  "urgent",
  "high",
  "срочно",
  "срочный",
  "срочная",
  "важно",
  "важный",
  "важная",
  "критично",
  "высокий",
  "высокая",
]);

const normalAliases = new Set([
  "normal",
  "medium",
  "low",
  "обычная",
  "обычный",
  "обычно",
  "не срочно",
  "несрочно",
  "средний",
  "средняя",
  "низкий",
  "низкая",
]);

export function normalizeTaskUrgency(value: unknown): TaskUrgency {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (urgentAliases.has(normalized)) return "urgent";
  if (normalAliases.has(normalized)) return "normal";
  return "normal";
}

export function isTaskUrgent(value: unknown): boolean {
  return normalizeTaskUrgency(value) === "urgent";
}
