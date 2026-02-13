"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useAllTasks } from "@/hooks/useTasks";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { TaskCard } from "@/components/TaskCard";
import { StatusFilter } from "@/components/StatusFilter";
import { TaskSkeleton } from "@/components/TaskSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { BottomNav } from "@/components/BottomNav";
import { PullIndicator } from "@/components/PullIndicator";
import { PageTransition } from "@/components/PageTransition";

export default function AllTasksPage() {
  const router = useRouter();
  const { role, isLoading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { data, isLoading, refetch } = useAllTasks(statusFilter);

  const { isRefreshing, containerRef } = usePullToRefresh(async () => {
    await refetch();
  });

  const tasks = data?.items ?? [];

  useEffect(() => {
    if (!authLoading && role === "member") {
      router.replace("/tasks");
    }
  }, [authLoading, role, router]);

  if (authLoading || role === "member") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tg-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-tg-button border-t-transparent" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div ref={containerRef} className="min-h-screen bg-tg-bg pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-tg-bg px-4 pt-3 pb-1">
          <h1 className="text-lg font-bold text-tg-text">Все задачи</h1>
        </div>

        {/* Filters */}
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />

        {/* Pull indicator */}
        <PullIndicator isRefreshing={isRefreshing} />

        {/* Content */}
        <div className="px-4">
          {isLoading ? (
            <TaskSkeleton count={5} />
          ) : tasks.length === 0 ? (
            <EmptyState title="Нет задач" subtitle="Ни одной задачи не найдено" />
          ) : (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} showAssignee />
            ))
          )}
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
}
