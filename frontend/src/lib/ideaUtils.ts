import type { Idea, IdeaDepartment, IdeaDepartmentStatus, IdeaStatus } from "./types";

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  new: "Новая",
  in_review: "На рассмотрении",
  accepted: "Принята",
  in_tasks: "В задачах",
  completed: "Завершена",
  rejected: "Отклонена",
  deferred: "Отложена",
};

export const IDEA_DEPARTMENT_STATUS_LABELS: Record<IdeaDepartmentStatus, string> = {
  not_started: "Не начато",
  in_progress: "В работе",
  ready: "Готово",
  not_required: "Не требуется",
};

export const IDEA_STATUS_TABS: Array<{ value: "all" | IdeaStatus; label: string }> = [
  { value: "all", label: "Все" },
  { value: "new", label: IDEA_STATUS_LABELS.new },
  { value: "in_review", label: IDEA_STATUS_LABELS.in_review },
  { value: "accepted", label: IDEA_STATUS_LABELS.accepted },
  { value: "in_tasks", label: IDEA_STATUS_LABELS.in_tasks },
  { value: "completed", label: IDEA_STATUS_LABELS.completed },
  { value: "deferred", label: IDEA_STATUS_LABELS.deferred },
  { value: "rejected", label: IDEA_STATUS_LABELS.rejected },
];

type IdeaDepartmentProgress = Pick<IdeaDepartment, "status">;

type IdeaProgress = Pick<
  Idea,
  | "can_complete"
  | "completed_linked_task_count"
  | "departments"
  | "linked_task_count"
  | "task_links"
>;

export function countReadyIdeaDepartments(
  departments: IdeaDepartmentProgress[],
): number {
  return departments.filter(
    (department) =>
      department.status === "ready" || department.status === "not_required",
  ).length;
}

export function canCompleteIdea(idea: Pick<Idea, "can_complete">): boolean {
  return idea.can_complete;
}

export function formatIdeaDepartmentProgress(
  idea: Pick<IdeaProgress, "departments">,
): string {
  if (idea.departments.length === 0) return "Без отделов";
  return `${countReadyIdeaDepartments(idea.departments)}/${idea.departments.length} отделов готово`;
}

export function formatIdeaTaskProgress(
  idea: Pick<IdeaProgress, "completed_linked_task_count" | "linked_task_count" | "task_links">,
): string {
  const linkedTaskCount = idea.linked_task_count ?? idea.task_links.length;
  if (linkedTaskCount === 0) return "Задач нет";
  return `${idea.completed_linked_task_count}/${linkedTaskCount} задач закрыто`;
}
