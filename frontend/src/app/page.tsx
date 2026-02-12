"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Users,
  CalendarDays,
  Mic,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";
import { api } from "@/lib/api";
import type { OverviewAnalytics, Task } from "@/lib/types";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function isOverdue(task: Task): boolean {
  if (!task.deadline || task.status === "done" || task.status === "cancelled")
    return false;
  return new Date(task.deadline) < new Date();
}

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      try {
        const [overviewData, myTasksData] = await Promise.all([
          api.getOverview(),
          api.getTasks({
            assignee: user!.id,
            status: "new,in_progress,review",
            per_page: "5",
            sort: "-updated_at",
          }),
        ]);

        setOverview(overviewData);
        setMyTasks(myTasksData.items);

        // Filter overdue from my tasks
        const allMyTasks = await api.getTasks({
          assignee: user!.id,
          status: "new,in_progress,review",
          per_page: "50",
        });
        setOverdueTasks(allMyTasks.items.filter(isOverdue));

        // Unassigned tasks (moderator only)
        if (PermissionService.isModerator(user!)) {
          const unassigned = await api.getTasks({
            status: "new",
            per_page: "5",
            sort: "-created_at",
          });
          setUnassignedTasks(
            unassigned.items.filter((t) => !t.assignee_id)
          );
        }
      } catch {
        // Silently fail — data will just be empty
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  if (!user) return null;

  const isModerator = PermissionService.isModerator(user);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего задач
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.total_tasks ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Выполнено: {overview?.tasks_done ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              В работе
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.tasks_in_progress ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              На ревью: {overview?.tasks_review ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Просроченные
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {overview?.tasks_overdue ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Требуют внимания
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Команда
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview?.total_members ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Встреч: {overview?.total_meetings ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Мои задачи</CardTitle>
            <Link href="/tasks">
              <Button variant="ghost" size="sm">
                Все задачи <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Нет активных задач
              </p>
            ) : (
              <div className="space-y-3">
                {myTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.short_id}`}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          #{task.short_id}
                        </span>
                        {task.source === "voice" && (
                          <Mic className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span
                          className={`text-sm font-medium truncate ${
                            isOverdue(task) ? "text-destructive" : ""
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        {task.deadline && (
                          <span
                            className={`text-xs ${
                              isOverdue(task)
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            <CalendarDays className="inline h-3 w-3 mr-1" />
                            {formatDate(task.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Просроченные
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Нет просроченных задач
              </p>
            ) : (
              <div className="space-y-3">
                {overdueTasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.short_id}`}
                    className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 transition-colors hover:bg-destructive/10"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          #{task.short_id}
                        </span>
                        <span className="text-sm font-medium truncate text-destructive">
                          {task.title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <PriorityBadge priority={task.priority} />
                        {task.deadline && (
                          <span className="text-xs text-destructive font-medium">
                            Дедлайн: {formatDate(task.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Moderator: Unassigned Tasks */}
      {isModerator && unassignedTasks.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Неназначенные задачи</CardTitle>
            <Link href="/tasks">
              <Button variant="ghost" size="sm">
                Все задачи <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unassignedTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.short_id}`}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        #{task.short_id}
                      </span>
                      {task.source === "voice" && (
                        <Mic className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {task.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      {task.created_by && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <UserAvatar
                            name={task.created_by.full_name}
                            size="sm"
                          />
                          {task.created_by.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
