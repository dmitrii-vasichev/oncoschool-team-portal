import {
  PROJECT_DEPARTMENT_STATUS_LABELS,
  PROJECT_MILESTONE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
} from "./projectUtils.ts";
import type {
  ProjectDepartmentStatus,
  ProjectEvent,
  ProjectMilestoneStatus,
  ProjectStatus,
} from "./types.ts";

export interface ProjectEventPresentation {
  title: string;
  detail: string | null;
}

const PROJECT_FIELD_LABELS: Record<string, string> = {
  title: "название",
  description: "описание",
  owner_id: "ответственный",
};

const PROJECT_DEPARTMENT_FIELD_LABELS: Record<string, string> = {
  owner_id: "ответственный",
  status: "статус",
  note: "заметка",
};

const PROJECT_MILESTONE_FIELD_LABELS: Record<string, string> = {
  title: "название",
  status: "статус",
  due_date: "дата",
  sort_order: "порядок",
};

function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && value in PROJECT_STATUS_LABELS;
}

function isProjectDepartmentStatus(value: unknown): value is ProjectDepartmentStatus {
  return typeof value === "string" && value in PROJECT_DEPARTMENT_STATUS_LABELS;
}

function isProjectMilestoneStatus(value: unknown): value is ProjectMilestoneStatus {
  return typeof value === "string" && value in PROJECT_MILESTONE_STATUS_LABELS;
}

function statusLabel(value: unknown): string | null {
  if (!isProjectStatus(value)) return typeof value === "string" ? value : null;
  return PROJECT_STATUS_LABELS[value];
}

function departmentStatusLabel(value: unknown): string | null {
  if (!isProjectDepartmentStatus(value)) {
    return typeof value === "string" ? value : null;
  }
  return PROJECT_DEPARTMENT_STATUS_LABELS[value];
}

function milestoneStatusLabel(value: unknown): string | null {
  if (!isProjectMilestoneStatus(value)) {
    return typeof value === "string" ? value : null;
  }
  return PROJECT_MILESTONE_STATUS_LABELS[value];
}

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function changedFieldsLabel(
  payload: Record<string, unknown>,
  labels: Record<string, string>,
): string | null {
  const fields = payload.fields;
  if (!Array.isArray(fields)) return null;

  const readableFields = fields
    .filter((field): field is string => typeof field === "string")
    .map((field) => labels[field] || field);

  if (readableFields.length === 0) return null;
  return `Изменено: ${readableFields.join(", ")}`;
}

export function formatProjectEvent(event: ProjectEvent): ProjectEventPresentation {
  const payload = event.payload || {};

  switch (event.event_type) {
    case "project_created":
      return {
        title: "Проект создан",
        detail: payloadString(payload, "title"),
      };
    case "project_updated":
      return {
        title: "Проект обновлён",
        detail: changedFieldsLabel(payload, PROJECT_FIELD_LABELS),
      };
    case "status_changed": {
      const oldStatus = statusLabel(payload.old_status);
      const newStatus = statusLabel(payload.new_status);
      return {
        title: "Статус изменён",
        detail: oldStatus && newStatus ? `${oldStatus} → ${newStatus}` : newStatus,
      };
    }
    case "department_added":
      return {
        title: "Добавлен отдел",
        detail: null,
      };
    case "department_updated": {
      const status = departmentStatusLabel(payload.status);
      return {
        title: "Отдел обновлён",
        detail: status || changedFieldsLabel(payload, PROJECT_DEPARTMENT_FIELD_LABELS),
      };
    }
    case "milestone_added":
      return {
        title: "Добавлен этап",
        detail: payloadString(payload, "title"),
      };
    case "milestone_updated": {
      const status = milestoneStatusLabel(payload.status);
      const dueDate = payloadString(payload, "due_date");
      return {
        title: "Этап обновлён",
        detail:
          status ||
          (dueDate ? `Дата: ${formatIsoDate(dueDate)}` : null) ||
          changedFieldsLabel(payload, PROJECT_MILESTONE_FIELD_LABELS),
      };
    }
    case "task_linked":
      return {
        title: "Создана задача по проекту",
        detail: null,
      };
    case "comment_added":
      return {
        title: "Добавлен комментарий",
        detail: null,
      };
    case "project_completed":
      return {
        title: "Проект завершён",
        detail: null,
      };
    case "project_deleted":
      return {
        title: "Проект удалён",
        detail: statusLabel(payload.status),
      };
    default:
      return {
        title: "Обновление проекта",
        detail: null,
      };
  }
}
