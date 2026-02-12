"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "@/components/tasks/TaskCard";
import {
  TaskFilters,
  EMPTY_FILTERS,
  type TaskFilterValues,
} from "@/components/tasks/TaskFilters";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import type { Task, TaskStatus, TeamMember } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";

const COLUMNS: TaskStatus[] = ["new", "in_progress", "review", "done"];

const COLUMN_COLORS: Record<string, string> = {
  new: "border-t-blue-400",
  in_progress: "border-t-yellow-400",
  review: "border-t-purple-400",
  done: "border-t-green-400",
};

export default function TasksPage() {
  const { user } = useCurrentUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      const [tasksRes, membersRes] = await Promise.all([
        api.getTasks({ per_page: "200" }),
        api.getTeam().catch(() => [] as TeamMember[]),
      ]);
      setTasks(tasksRes.items);
      setMembers(membersRes);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (
        filters.search &&
        !t.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        !`#${t.short_id}`.includes(filters.search)
      ) {
        return false;
      }
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.source && t.source !== filters.source) return false;
      if (filters.assignee_id) {
        if (filters.assignee_id === "unassigned") {
          if (t.assignee_id) return false;
        } else if (t.assignee_id !== filters.assignee_id) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, filters]);

  const tasksByStatus = useMemo(() => {
    return COLUMNS.reduce(
      (acc, status) => {
        acc[status] = filteredTasks.filter((t) => t.status === status);
        return acc;
      },
      {} as Record<TaskStatus, Task[]>
    );
  }, [filteredTasks]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <Skeleton key={col} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <TaskFilters
          filters={filters}
          onFiltersChange={setFilters}
          members={members}
        />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Новая задача
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Показано: {filteredTasks.length} из {tasks.length}
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((status) => (
          <Card key={status} className={`border-t-4 ${COLUMN_COLORS[status]}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                {TASK_STATUS_LABELS[status]}
                <span className="text-muted-foreground font-normal text-xs bg-muted rounded-full px-2 py-0.5">
                  {tasksByStatus[status].length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[calc(100vh-280px)]">
                <div className="space-y-2 pr-2">
                  {tasksByStatus[status].length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Нет задач
                    </p>
                  ) : (
                    tasksByStatus[status].map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>

      {user && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          currentUser={user}
          members={members}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
