import type {
  Project,
  ProjectDepartmentStatus,
  ProjectMilestoneStatus,
  ProjectStatus,
} from "./types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Запланирован",
  in_progress: "В работе",
  paused: "На паузе",
  completed: "Завершён",
  cancelled: "Отменён",
};

export const PROJECT_DEPARTMENT_STATUS_LABELS: Record<ProjectDepartmentStatus, string> = {
  not_started: "Не начато",
  in_progress: "В работе",
  ready: "Готово",
  not_required: "Не требуется",
};

export const PROJECT_MILESTONE_STATUS_LABELS: Record<ProjectMilestoneStatus, string> = {
  planned: "Запланирован",
  in_progress: "В работе",
  done: "Готово",
};

type ProjectDepartmentProgress = {
  status: ProjectDepartmentStatus | string;
};

type ProjectTaskProgress = {
  completed_linked_task_count: number;
  linked_task_count?: number | null;
  task_links: unknown[];
};

type ProjectMilestoneProgress = {
  completed_milestone_count: number;
  milestone_count: number;
};

export function countReadyProjectDepartments(
  departments: ProjectDepartmentProgress[],
): number {
  return departments.filter(
    (department) =>
      department.status === "ready" || department.status === "not_required",
  ).length;
}

export function canCompleteProject(project: Pick<Project, "can_complete">): boolean {
  return project.can_complete;
}

export function formatProjectDepartmentProgress(
  project: { departments: ProjectDepartmentProgress[] },
): string {
  if (project.departments.length === 0) return "Без отделов";
  return `${countReadyProjectDepartments(project.departments)}/${project.departments.length} отделов готово`;
}

export function formatProjectMilestoneProgress(
  project: ProjectMilestoneProgress,
): string {
  if (project.milestone_count === 0) return "Без этапов";
  return `${project.completed_milestone_count}/${project.milestone_count} этапов готово`;
}

export function formatProjectTaskProgress(project: ProjectTaskProgress): string {
  const linkedTaskCount = project.linked_task_count ?? project.task_links.length;
  if (linkedTaskCount === 0) return "Задач нет";
  return `${project.completed_linked_task_count}/${linkedTaskCount} задач закрыто`;
}
