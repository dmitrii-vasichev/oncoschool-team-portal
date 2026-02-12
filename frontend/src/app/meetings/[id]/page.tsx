"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckSquare, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { api } from "@/lib/api";
import type { Meeting, Task } from "@/lib/types";

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [meetingData, tasksData] = await Promise.all([
          api.getMeeting(id),
          api.getMeetingTasks(id),
        ]);
        setMeeting(meetingData);
        setTasks(tasksData);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!meeting) {
    return <p className="text-sm text-destructive">Встреча не найдена</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/meetings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Button>
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-bold">
          {meeting.title || "Встреча без названия"}
        </h2>
        {meeting.meeting_date && (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            {new Date(meeting.meeting_date).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Резюме</TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1">
            <ListChecks className="h-4 w-4" />
            Задачи
            {tasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="original">Оригинал</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 mt-4">
          {meeting.parsed_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Краткое резюме</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {meeting.parsed_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {meeting.decisions && meeting.decisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Решения ({meeting.decisions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {meeting.decisions.map((decision, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground font-mono text-xs mt-0.5">
                        {i + 1}.
                      </span>
                      {decision}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {!meeting.parsed_summary &&
            (!meeting.decisions || meeting.decisions.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет распознанных данных для этой встречи
              </p>
            )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              К этой встрече не привязано задач
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.short_id}`}>
                  <Card className="transition-colors hover:bg-accent cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono text-muted-foreground">
                            #{task.short_id}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                        </div>
                      </div>
                      {task.assignee && (
                        <p className="text-xs text-muted-foreground mt-1 ml-10">
                          Исполнитель: {task.assignee.full_name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="original" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Оригинальный Zoom Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm whitespace-pre-wrap text-muted-foreground font-mono">
                {meeting.raw_summary}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
