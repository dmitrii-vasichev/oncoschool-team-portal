import type { Task } from "./types";

export interface GroupedTasks {
  overdue: Task[];
  today: Task[];
  other: Task[];
}

export function groupTasksByDeadline(tasks: Task[]): GroupedTasks {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const overdue: Task[] = [];
  const today: Task[] = [];
  const other: Task[] = [];

  for (const task of tasks) {
    if (!task.deadline) {
      other.push(task);
      continue;
    }

    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    if (
      deadlineDate < todayStart &&
      task.status !== "done" &&
      task.status !== "cancelled"
    ) {
      overdue.push(task);
    } else if (deadlineDate >= todayStart && deadlineDate < tomorrowStart) {
      today.push(task);
    } else {
      other.push(task);
    }
  }

  return { overdue, today, other };
}
