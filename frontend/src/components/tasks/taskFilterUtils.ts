import type {
  Department,
  TaskLabel,
  TaskSource,
  TeamMember,
} from "../../lib/types.ts";
import { TASK_SOURCE_LABELS } from "../../lib/types.ts";
import {
  normalizeTaskUrgency,
  TASK_URGENCY_LABELS,
} from "../../lib/taskUrgency.ts";

export interface TaskFilterValues {
  search: string;
  priority: string;
  source: string;
  department_id: string;
  assignee_id: string;
  created_by_id: string;
  labels: TaskLabel[];
}

export const EMPTY_FILTERS: TaskFilterValues = {
  search: "",
  priority: "",
  source: "",
  department_id: "",
  assignee_id: "",
  created_by_id: "",
  labels: [],
};

export type ActiveTaskFilterChip =
  | {
      type: "label";
      key: string;
      label: string;
      labelId: string;
    }
  | {
      type: "label-overflow";
      key: "labels-overflow";
      label: string;
    }
  | {
      type: "field";
      key: keyof Pick<
        TaskFilterValues,
        "priority" | "source" | "department_id" | "assignee_id" | "created_by_id"
      >;
      label: string;
    };

export function countActiveStructuredTaskFilters(
  filters: TaskFilterValues,
  { showDepartmentFilter }: { showDepartmentFilter: boolean }
) {
  let count = 0;
  if (filters.labels.length > 0) count += 1;
  if (showDepartmentFilter && filters.department_id) count += 1;
  if (filters.assignee_id || filters.created_by_id) count += 1;
  if (filters.priority) count += 1;
  if (filters.source) count += 1;
  return count;
}

export function clearStructuredTaskFilters(
  filters: TaskFilterValues
): TaskFilterValues {
  return {
    ...EMPTY_FILTERS,
    search: filters.search,
  };
}

export function removeTaskFilterChip(
  filters: TaskFilterValues,
  chip: ActiveTaskFilterChip
): TaskFilterValues {
  if (chip.type === "label") {
    return {
      ...filters,
      labels: filters.labels.filter((label) => label.id !== chip.labelId),
    };
  }

  if (chip.type === "label-overflow") {
    return filters;
  }

  return {
    ...filters,
    [chip.key]: "",
  };
}

export function buildActiveTaskFilterChips({
  filters,
  members,
  departments,
  showDepartmentFilter,
  maxVisibleLabels = 2,
}: {
  filters: TaskFilterValues;
  members: TeamMember[];
  departments: Department[];
  showDepartmentFilter: boolean;
  maxVisibleLabels?: number;
}): ActiveTaskFilterChip[] {
  const chips: ActiveTaskFilterChip[] = [];
  const visibleLabels = filters.labels.slice(0, maxVisibleLabels);
  const hiddenLabelCount = filters.labels.length - visibleLabels.length;

  visibleLabels.forEach((label) => {
    chips.push({
      type: "label",
      key: `label:${label.id}`,
      label: label.name,
      labelId: label.id,
    });
  });

  if (hiddenLabelCount > 0) {
    chips.push({
      type: "label-overflow",
      key: "labels-overflow",
      label: `+${hiddenLabelCount} меток`,
    });
  }

  if (showDepartmentFilter && filters.department_id) {
    const department = departments.find(
      (item) => item.id === filters.department_id
    );
    chips.push({
      type: "field",
      key: "department_id",
      label: `Отдел: ${department?.name || "—"}`,
    });
  }

  if (filters.assignee_id) {
    const member = members.find((item) => item.id === filters.assignee_id);
    chips.push({
      type: "field",
      key: "assignee_id",
      label:
        filters.assignee_id === "unassigned"
          ? "Исполнитель: Не назначен"
          : `Исполнитель: ${member?.full_name || "—"}`,
    });
  }

  if (filters.created_by_id) {
    const member = members.find((item) => item.id === filters.created_by_id);
    chips.push({
      type: "field",
      key: "created_by_id",
      label: `Автор: ${member?.full_name || "—"}`,
    });
  }

  if (filters.priority) {
    const urgency = normalizeTaskUrgency(filters.priority);
    chips.push({
      type: "field",
      key: "priority",
      label: `Срочность: ${TASK_URGENCY_LABELS[urgency]}`,
    });
  }

  if (filters.source) {
    chips.push({
      type: "field",
      key: "source",
      label: TASK_SOURCE_LABELS[filters.source as TaskSource],
    });
  }

  return chips;
}
