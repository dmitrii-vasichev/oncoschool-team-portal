type CompletedTaskLike = {
  status: string;
  completed_at: string | null;
};

export function completedSinceParam(now = new Date()): string {
  const completedSince = new Date(now);
  completedSince.setDate(completedSince.getDate() - 7);
  return completedSince.toISOString();
}

function completedAtTime(task: CompletedTaskLike): number | null {
  if (task.status !== "done" || !task.completed_at) return null;
  const completedAt = new Date(task.completed_at).getTime();
  return Number.isNaN(completedAt) ? null : completedAt;
}

export function filterTasksCompletedSince<T extends CompletedTaskLike>(
  tasks: T[],
  completedSince: Date | string,
): T[] {
  const completedSinceTime = new Date(completedSince).getTime();
  if (Number.isNaN(completedSinceTime)) return [];

  return tasks
    .filter((task) => {
      const completedAt = completedAtTime(task);
      return completedAt !== null && completedAt >= completedSinceTime;
    })
    .sort((a, b) => {
      const completedAtA = completedAtTime(a) ?? 0;
      const completedAtB = completedAtTime(b) ?? 0;
      return completedAtB - completedAtA;
    });
}
