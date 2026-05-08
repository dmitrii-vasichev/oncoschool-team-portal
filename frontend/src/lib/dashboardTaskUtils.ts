import { isTaskUrgent } from "./taskUrgency.ts";

export const DASHBOARD_TASK_PREVIEW_LIMIT = 5;

type DashboardTaskLike = {
  status: string;
  priority?: unknown;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CompletedTaskLike = Pick<
  DashboardTaskLike,
  "status" | "completed_at" | "updated_at"
>;

export function completedSinceParam(now = new Date()): string {
  const completedSince = new Date(now);
  completedSince.setDate(completedSince.getDate() - 7);
  return completedSince.toISOString();
}

function dateTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function localDateTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function completedAtTime(task: CompletedTaskLike): number | null {
  if (task.status !== "done" || !task.completed_at) return null;
  return dateTime(task.completed_at);
}

function urgencyRank(task: Pick<DashboardTaskLike, "priority">): number {
  return isTaskUrgent(task.priority) ? 0 : 1;
}

function isTaskOverdueForSort(
  task: Pick<DashboardTaskLike, "deadline" | "status">,
  today = new Date(),
): boolean {
  if (!task.deadline || task.status === "done" || task.status === "cancelled") {
    return false;
  }
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const deadlineTime = localDateTime(task.deadline);
  return deadlineTime !== null && deadlineTime < todayStart.getTime();
}

function newestCreatedFallback<T extends Pick<DashboardTaskLike, "created_at">>(
  a: T,
  b: T,
): number {
  return (dateTime(b.created_at) ?? 0) - (dateTime(a.created_at) ?? 0);
}

export function filterTasksCompletedSince<T extends CompletedTaskLike>(
  tasks: T[],
  completedSince: Date | string,
): T[] {
  const completedSinceTime = new Date(completedSince).getTime();
  if (Number.isNaN(completedSinceTime)) return [];

  return sortDashboardCompletedTasks(
    tasks.filter((task) => {
      const completedAt = completedAtTime(task);
      return completedAt !== null && completedAt >= completedSinceTime;
    }),
  );
}

export function sortDashboardActiveTasks<T extends DashboardTaskLike>(
  tasks: T[],
  today = new Date(),
): T[] {
  return [...tasks].sort((a, b) => {
    const urgentCompare = urgencyRank(a) - urgencyRank(b);
    if (urgentCompare !== 0) return urgentCompare;

    const overdueCompare =
      Number(!isTaskOverdueForSort(a, today)) -
      Number(!isTaskOverdueForSort(b, today));
    if (overdueCompare !== 0) return overdueCompare;

    const deadlineA = localDateTime(a.deadline);
    const deadlineB = localDateTime(b.deadline);
    if (deadlineA !== null && deadlineB !== null && deadlineA !== deadlineB) {
      return deadlineA - deadlineB;
    }
    if (deadlineA !== null && deadlineB === null) return -1;
    if (deadlineA === null && deadlineB !== null) return 1;

    return newestCreatedFallback(a, b);
  });
}

export function sortDashboardOverdueTasks<T extends DashboardTaskLike>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const urgentCompare = urgencyRank(a) - urgencyRank(b);
    if (urgentCompare !== 0) return urgentCompare;

    const deadlineA = localDateTime(a.deadline);
    const deadlineB = localDateTime(b.deadline);
    if (deadlineA !== null && deadlineB !== null && deadlineA !== deadlineB) {
      return deadlineA - deadlineB;
    }
    if (deadlineA !== null && deadlineB === null) return -1;
    if (deadlineA === null && deadlineB !== null) return 1;

    return newestCreatedFallback(a, b);
  });
}

export type DashboardOpenTaskGroups<T> = {
  overdue: T[];
  active: T[];
};

export function splitDashboardOpenTasks<T extends DashboardTaskLike>(
  tasks: T[],
  today = new Date(),
): DashboardOpenTaskGroups<T> {
  const overdue: T[] = [];
  const active: T[] = [];

  for (const task of tasks) {
    if (task.status === "done" || task.status === "cancelled") {
      continue;
    }
    if (isTaskOverdueForSort(task, today)) {
      overdue.push(task);
    } else {
      active.push(task);
    }
  }

  return {
    overdue: sortDashboardOverdueTasks(overdue),
    active: sortDashboardActiveTasks(active, today),
  };
}

export function sortDashboardCompletedTasks<T extends CompletedTaskLike>(
  tasks: T[],
): T[] {
  return [...tasks].sort((a, b) => {
    const completedCompare =
      (completedAtTime(b) ?? 0) - (completedAtTime(a) ?? 0);
    if (completedCompare !== 0) return completedCompare;
    return (dateTime(b.updated_at) ?? 0) - (dateTime(a.updated_at) ?? 0);
  });
}

export function getDashboardTaskPreview<T>(
  tasks: T[],
  expanded: boolean,
  limit = DASHBOARD_TASK_PREVIEW_LIMIT,
): T[] {
  return expanded ? tasks : tasks.slice(0, limit);
}
