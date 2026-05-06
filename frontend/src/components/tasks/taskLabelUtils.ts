import type { TaskLabel, TaskLabelColor } from "@/lib/types";

export const TASK_LABEL_COLOR_OPTIONS: Array<{
  value: TaskLabelColor;
  label: string;
}> = [
  { value: "teal", label: "Teal" },
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "gold", label: "Gold" },
  { value: "green", label: "Green" },
  { value: "coral", label: "Coral" },
  { value: "rose", label: "Rose" },
  { value: "slate", label: "Slate" },
];

const LABEL_CLASSES: Record<string, string> = {
  teal: "bg-primary/10 text-primary border-primary/20",
  blue: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300",
  purple: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-300",
  gold: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
  green: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
  coral: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-300",
  rose: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300",
  slate: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-300",
};

const SWATCH_CLASSES: Record<string, string> = {
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  gold: "bg-amber-500",
  green: "bg-emerald-500",
  coral: "bg-orange-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

export function labelClass(color: string) {
  return LABEL_CLASSES[color] || LABEL_CLASSES.slate;
}

export function labelSwatchClass(color: string) {
  return SWATCH_CLASSES[color] || SWATCH_CLASSES.slate;
}

export function canEditTaskLabel(label: TaskLabel) {
  return label.can_edit;
}

export function canArchiveTaskLabel(label: TaskLabel) {
  return label.can_archive;
}

export function getTaskLabelPickerStateAfterArchive({
  options,
  selectedLabels,
  archivedLabelId,
}: {
  options: TaskLabel[];
  selectedLabels: TaskLabel[];
  archivedLabelId: string;
}) {
  return {
    options: options.filter((label) => label.id !== archivedLabelId),
    selectedLabels,
  };
}
