export type CancellationReasonCode =
  | "completed"
  | "obsolete"
  | "duplicate"
  | "other"
  | "auto_inactivity";

export const CANCELLATION_REASON_LABELS: Record<string, string> = {
  completed: "Уже выполнено",
  obsolete: "Потеряло актуальность",
  duplicate: "Дубль другой задачи",
  other: "Другое",
  auto_inactivity: "Авто (неактивность)",
};

export function humanizeCancellationReason(
  code: string | null | undefined
): string {
  if (!code) return "";
  return CANCELLATION_REASON_LABELS[code] ?? code;
}

// The reasons a user can pick in the UI (excludes the system-only auto_inactivity):
export const USER_CANCELLATION_REASONS: {
  code: CancellationReasonCode;
  label: string;
}[] = [
  { code: "completed", label: CANCELLATION_REASON_LABELS.completed },
  { code: "obsolete", label: CANCELLATION_REASON_LABELS.obsolete },
  { code: "duplicate", label: CANCELLATION_REASON_LABELS.duplicate },
  { code: "other", label: CANCELLATION_REASON_LABELS.other },
];
