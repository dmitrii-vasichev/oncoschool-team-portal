"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  FileText,
  Copy,
  Check,
  StickyNote,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PriorityBadge } from "@/components/shared/PriorityBadge";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Meeting, Task } from "@/lib/types";

type TabId = "summary" | "tasks" | "original";

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toastError } = useToast();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [copied, setCopied] = useState(false);

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
        toastError("Не удалось загрузить встречу");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleCopy = async () => {
    if (!meeting?.raw_summary) return;
    await navigator.clipboard.writeText(meeting.raw_summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const taskProgress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-6 w-20 rounded-lg" />
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Skeleton className="h-6 w-48 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-destructive">Встреча не найдена</p>
        <Link href="/meetings" className="mt-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            К списку встреч
          </Button>
        </Link>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof FileText; count?: number }[] = [
    { id: "summary", label: "Резюме", icon: FileText },
    { id: "tasks", label: "Задачи", icon: ListChecks, count: tasks.length },
    { id: "original", label: "Оригинал", icon: StickyNote },
  ];

  return (
    <div className="max-w-3xl space-y-6 animate-in fade-in duration-300">
      {/* Back */}
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground group"
      >
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5" />
        Встречи
      </Link>

      {/* Header */}
      <div className="animate-fade-in-up stagger-1">
        <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">
          {meeting.title || "Встреча без названия"}
        </h1>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          {meeting.meeting_date && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {new Date(meeting.meeting_date).toLocaleDateString("ru-RU", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          )}
          {tasks.length > 0 && (
            <Badge variant="secondary" className="gap-1 rounded-lg">
              <ListChecks className="h-3 w-3" />
              {doneCount}/{tasks.length} задач
            </Badge>
          )}
        </div>
      </div>

      {/* Custom tabs */}
      <div className="animate-fade-in-up stagger-2">
        <div className="flex gap-1 p-1 bg-muted/50 rounded-2xl w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                  ${
                    isActive
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`
                      text-2xs rounded-full px-1.5 min-w-[18px] text-center font-semibold
                      ${isActive ? "bg-primary/10 text-primary" : "bg-foreground/8 text-muted-foreground"}
                    `}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in-up stagger-3">
        {/* ===== Summary ===== */}
        {activeTab === "summary" && (
          <div className="space-y-5">
            {meeting.parsed_summary && (
              <div className="rounded-2xl border border-border/60 bg-card p-6">
                <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Краткое резюме
                </h3>
                <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                  {meeting.parsed_summary}
                </p>
              </div>
            )}

            {meeting.decisions && meeting.decisions.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-6">
                <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-status-done-fg" />
                  Решения
                </h3>
                <ul className="space-y-3">
                  {meeting.decisions.map((decision, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 animate-fade-in-up"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <span className="flex-shrink-0 h-6 w-6 rounded-lg bg-status-done-bg text-status-done-fg flex items-center justify-center text-xs font-semibold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-foreground leading-relaxed pt-0.5">
                        {decision}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.notes && (
              <div className="rounded-2xl bg-muted/40 border border-border/40 p-6">
                <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Заметки
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {meeting.notes}
                </p>
              </div>
            )}

            {!meeting.parsed_summary &&
              (!meeting.decisions || meeting.decisions.length === 0) && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                    <FileText className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Нет распознанных данных для этой встречи
                  </p>
                </div>
              )}
          </div>
        )}

        {/* ===== Tasks ===== */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            {tasks.length > 0 && (
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1">
                  <Progress value={taskProgress} className="h-1.5" />
                </div>
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                  {taskProgress}% выполнено
                </span>
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                  <ListChecks className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">
                  К этой встрече не привязано задач
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, i) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.short_id}`}
                    className="group block"
                  >
                    <div
                      className="rounded-xl border border-border/60 bg-card p-4 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-px animate-fade-in-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-2xs font-mono text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                            #{task.short_id}
                          </span>
                          <span className="text-sm font-medium truncate group-hover:text-primary">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary" />
                        </div>
                      </div>

                      {task.assignee && (
                        <div className="flex items-center gap-2 mt-2 ml-12">
                          <UserAvatar name={task.assignee.full_name} size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {task.assignee.full_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Original ===== */}
        {activeTab === "original" && (
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            {/* Header with copy button */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Zoom AI Summary
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 text-xs gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-status-done-fg" />
                    Скопировано
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Копировать
                  </>
                )}
              </Button>
            </div>

            {/* Scrollable content with line numbers */}
            <div className="max-h-[500px] overflow-y-auto p-5">
              <div className="font-mono text-sm leading-relaxed">
                {meeting.raw_summary?.split("\n").map((line, i) => (
                  <div key={i} className="flex gap-4 hover:bg-muted/30 -mx-2 px-2 rounded">
                    <span className="select-none text-muted-foreground/40 text-right min-w-[2rem] text-xs leading-relaxed tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground whitespace-pre-wrap break-all">
                      {line || "\u00A0"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
