"use client";

import { useState } from "react";
import { useMyTasks } from "@/hooks/useTasks";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { groupTasksByDeadline } from "@/lib/taskUtils";
import { TaskCard } from "@/components/TaskCard";
import { StatusFilter } from "@/components/StatusFilter";
import { TaskSkeleton } from "@/components/TaskSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { GroupHeader } from "@/components/GroupHeader";
import { BottomNav } from "@/components/BottomNav";
import { PullIndicator } from "@/components/PullIndicator";
import { PageTransition } from "@/components/PageTransition";

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { data, isLoading, refetch } = useMyTasks(statusFilter);

  const { isRefreshing, containerRef } = usePullToRefresh(async () => {
    await refetch();
  });

  const tasks = data?.items ?? [];
  const grouped = groupTasksByDeadline(tasks);

  return (
    <PageTransition>
      <div ref={containerRef} className="min-h-screen bg-tg-bg pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-tg-bg px-4 pt-3 pb-1">
          <h1 className="text-lg font-bold text-tg-text">Мои задачи</h1>
        </div>

        {/* Filters */}
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />

        {/* Pull indicator */}
        <PullIndicator isRefreshing={isRefreshing} />

        {/* Content */}
        <div className="px-4">
          {isLoading ? (
            <TaskSkeleton count={3} />
          ) : tasks.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {grouped.overdue.length > 0 && (
                <>
                  <GroupHeader
                    title="⏰ Просроченные"
                    className="text-tg-destructive"
                  />
                  {grouped.overdue.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </>
              )}
              {grouped.today.length > 0 && (
                <>
                  <GroupHeader title="📅 Сегодня" />
                  {grouped.today.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </>
              )}
              {grouped.other.length > 0 && (
                <>
                  <GroupHeader title="📋 Остальные" />
                  {grouped.other.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
}
