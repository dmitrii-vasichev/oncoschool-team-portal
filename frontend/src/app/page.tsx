"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ArrowRight,
  ClipboardList,
  Mic,
  FileText,
  UserX,
  Video,
  ExternalLink,
  CalendarDays,
  ListChecks,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/shared/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDepartments } from "@/hooks/useDepartments";
import { useIsTruncated } from "@/hooks/useIsTruncated";
import { PermissionService } from "@/lib/permissions";
import { getAccessibleDepartments } from "@/lib/departmentAccess";
import { api } from "@/lib/api";
import {
  DASHBOARD_TASK_PREVIEW_LIMIT,
  getDashboardTaskPreview,
  splitDashboardOpenTasks,
  sortDashboardActiveTasks,
} from "@/lib/dashboardTaskUtils";
import { isTaskUrgent } from "@/lib/taskUrgency";
import { sanitizeZoomJoinUrl } from "@/lib/zoomLink";
import { UpcomingBirthdays } from "./team/components/UpcomingBirthdays";
import type {
  DashboardActivityAnalytics,
  DashboardActivityMetric,
  DashboardActivityScope,
  DashboardTasksAnalytics,
  Task,
  Meeting,
  TeamMember,
} from "@/lib/types";
import { parseLocalDate, parseUTCDate } from "@/lib/dateUtils";

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const parsed = parseLocalDate(dateStr);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function isOverdue(task: Task): boolean {
  if (!task.deadline || task.status === "done" || task.status === "cancelled")
    return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return parseLocalDate(task.deadline) < todayStart;
}

function normalizePersonName(
  fullName: string | null | undefined,
  fallback = "Без имени"
): string {
  if (typeof fullName !== "string") return fallback;
  const normalized = fullName.trim();
  return normalized || fallback;
}

function firstName(fullName: string | null | undefined): string {
  const safeFullName = normalizePersonName(fullName, "Коллега");
  return safeFullName.split(/\s+/)[0] || safeFullName;
}

function firstAndLastName(fullName: string | null | undefined): string {
  const safeFullName = normalizePersonName(fullName);
  const parts = safeFullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[1]}`;
}

// ────────────────────────────────────────────
// Skeleton loading
// ────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Compact header skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-full sm:w-[240px]" />
      </div>

      {/* Three-column skeleton */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>

      {/* Meetings skeleton */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Task list item (compact)
// ────────────────────────────────────────────

function TaskListItem({
  task,
  variant = "default",
  showAssignee = false,
}: {
  task: Task;
  variant?: "default" | "overdue" | "unassigned" | "completed";
  showAssignee?: boolean;
}) {
  const overdue = variant === "overdue" || isOverdue(task);
  const urgent = isTaskUrgent(task.priority);
  const borderClass = overdue
    ? "border border-destructive/35 bg-destructive/[0.06] hover:bg-destructive/[0.1] shadow-[0_0_0_1px_hsl(var(--destructive)/0.12)_inset]"
    : variant === "unassigned"
      ? "border border-dashed border-muted-foreground/20 hover:bg-secondary/50"
      : variant === "completed"
        ? "border border-status-done-ring/35 bg-status-done-bg/20 hover:bg-status-done-bg/35"
        : "border border-border/60 hover:bg-secondary/50";

  const sourceIcon =
    task.source === "voice" ? (
      <Mic className="h-3 w-3 text-muted-foreground" />
    ) : task.source === "summary" ? (
      <FileText className="h-3 w-3 text-muted-foreground" />
    ) : null;
  const checklist = Array.isArray(task.checklist) ? task.checklist : [];
  const completedChecklist = checklist.filter((item) => item?.is_completed).length;
  const taskTitle =
    typeof task.title === "string" && task.title.trim()
      ? task.title
      : "Без названия задачи";
  const { ref: titleRef, isTruncated: isTitleTruncated } =
    useIsTruncated<HTMLSpanElement>(taskTitle);
  const titleClass = `text-sm font-heading font-semibold leading-tight line-clamp-2 ${
    overdue ? "text-destructive" : ""
  }`;
  const assigneeName = normalizePersonName(task.assignee?.full_name);
  const createdByName = normalizePersonName(task.created_by?.full_name);

  return (
    <TooltipProvider delayDuration={120}>
      <Link
        href={`/tasks/${task.short_id}`}
        className={`relative block overflow-hidden rounded-xl p-3 transition-all duration-150 ${urgent ? "pl-4" : ""} ${borderClass}`}
      >
        {urgent && (
          <span className="absolute inset-y-0 left-0 w-1 bg-priority-urgent-dot" />
        )}
        <div className="flex items-start gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="min-w-0 flex items-start gap-1.5">
              {sourceIcon}
              {isTitleTruncated ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <span ref={titleRef} className={titleClass}>
                      {taskTitle}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    className="max-w-[320px] break-words"
                  >
                    {taskTitle}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span ref={titleRef} className={titleClass}>
                  {taskTitle}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-x-2 gap-y-1.5 flex-wrap">
            {urgent && (
              <span className="inline-flex items-center rounded-full bg-priority-urgent-bg px-2 py-0.5 text-[11px] font-medium text-priority-urgent-fg ring-1 ring-inset ring-priority-urgent-dot/35">
                Срочно
              </span>
            )}
            {overdue && (
              <span className="inline-flex items-center rounded-full bg-destructive/12 px-2 py-0.5 text-[11px] font-medium text-destructive">
                Просрочено
              </span>
            )}
            {task.deadline && (
              <span
                className={`text-xs flex items-center gap-1 ${
                  overdue ? "text-destructive font-medium" : "text-muted-foreground"
                }`}
              >
                <CalendarDays className="h-3 w-3" />
                {formatDate(task.deadline)}
              </span>
            )}
            {checklist.length > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                {completedChecklist}/{checklist.length}
              </span>
            )}
            {variant === "unassigned" && task.created_by && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <UserAvatar
                  name={createdByName}
                  avatarUrl={task.created_by.avatar_url}
                  size="sm"
                />
                {createdByName}
              </span>
            )}
            {variant === "completed" && (
              <span className="text-xs text-status-done-fg flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Выполнено: {formatDate(task.completed_at || task.updated_at)}
              </span>
            )}
            {showAssignee && (
              task.assignee ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                  <UserAvatar
                    name={assigneeName}
                    avatarUrl={task.assignee.avatar_url}
                    size="sm"
                  />
                  <span className="truncate max-w-[150px]">
                    {firstAndLastName(assigneeName)}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <UserX className="h-3 w-3" />
                  Не назначен
                </span>
              )
            )}
            </div>
          </div>
        </div>
      </Link>
    </TooltipProvider>
  );
}

// ────────────────────────────────────────────
// Section header with inline badges
// ────────────────────────────────────────────

interface BadgeInfo {
  label: string;
  value: number;
  color?: "default" | "green" | "red" | "blue";
}

function SectionHeader({
  title,
  icon: Icon,
  iconColor,
  linkHref,
  linkLabel,
  count,
  badges,
}: {
  title: string;
  icon?: ElementType;
  iconColor?: string;
  linkHref?: string;
  linkLabel?: string;
  count?: number;
  badges?: BadgeInfo[];
}) {
  const badgeColors = {
    default: "bg-muted text-muted-foreground",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    red: "bg-destructive/10 text-destructive",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  return (
    <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-center gap-2 flex-wrap">
        {Icon && (
          <Icon
            className="h-[18px] w-[18px]"
            style={iconColor ? { color: iconColor } : undefined}
          />
        )}
        <h2 className="text-base font-semibold font-heading">{title}</h2>
        {count !== undefined && count > 0 && !badges && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        )}
        {badges && badges.length > 0 && (
          <div className="flex items-center gap-1.5">
            {badges.map((badge, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeColors[badge.color || "default"]}`}
              >
                {badge.value} {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {linkHref && (
        <Link
          href={linkHref}
          className="flex shrink-0 items-center gap-1 self-start whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground xl:self-auto"
        >
          {linkLabel || "Смотреть все"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

type DashboardTaskBlockKey = "tasks";
type ActivityMetricKey = "completed" | "created" | "in_progress_over_7_days";

function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  iconContainerClassName,
  iconClassName,
}: {
  icon: ElementType;
  title: string;
  description: string;
  iconContainerClassName: string;
  iconClassName: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div
        className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${iconContainerClassName}`}
      >
        <Icon className={`h-5 w-5 ${iconClassName}`} />
      </div>
      <p className="mb-0.5 text-sm font-heading font-semibold text-foreground">
        {title}
      </p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function DashboardTaskBlock({
  blockKey,
  title,
  icon,
  iconColor,
  badges,
  tasks,
  expanded,
  onExpandedChange,
  emptyContent,
  itemVariant,
  showAssignee,
  orderingHint,
  truncated,
  truncationMessage,
  linkHref,
  linkLabel,
  groups,
}: {
  blockKey: DashboardTaskBlockKey;
  title: string;
  icon: ElementType;
  iconColor?: string;
  badges?: BadgeInfo[];
  tasks: Task[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  emptyContent: ReactNode;
  itemVariant: "default" | "overdue" | "completed";
  showAssignee: boolean;
  orderingHint: string;
  truncated?: boolean;
  truncationMessage?: string;
  linkHref?: string;
  linkLabel?: string;
  groups?: Array<{
    title: string;
    tasks: Task[];
    itemVariant: "default" | "overdue" | "completed";
  }>;
}) {
  const visibleTasks = getDashboardTaskPreview(tasks, expanded);
  const hiddenCount = Math.max(0, tasks.length - DASHBOARD_TASK_PREVIEW_LIMIT);
  const listId = `dashboard-${blockKey}-tasks`;
  const canExpand = tasks.length > DASHBOARD_TASK_PREVIEW_LIMIT;
  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  const visibleGroups = groups
    ? groups.map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => visibleTaskIds.has(task.id)),
      }))
    : undefined;

  return (
    <>
      <SectionHeader
        title={title}
        icon={icon}
        iconColor={iconColor}
        badges={badges}
        linkHref={linkHref}
        linkLabel={linkLabel}
      />
      {tasks.length === 0 ? (
        <>
          {emptyContent}
          {truncated && truncationMessage && (
            <p className="text-xs text-muted-foreground">
              {truncationMessage}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{orderingHint}</p>
          <div id={listId} className="space-y-3">
            {visibleGroups
              ? visibleGroups
                  .filter((group) => group.tasks.length > 0)
                  .map((group) => (
                    <div key={group.title} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {group.title}
                      </p>
                      {group.tasks.map((task) => (
                        <TaskListItem
                          key={task.id}
                          task={task}
                          variant={group.itemVariant}
                          showAssignee={showAssignee}
                        />
                      ))}
                    </div>
                  ))
              : visibleTasks.map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    variant={
                      itemVariant === "default" && isOverdue(task)
                        ? "overdue"
                        : itemVariant
                    }
                    showAssignee={showAssignee}
                  />
                ))}
          </div>
          {truncated && truncationMessage && (
            <p className="text-xs text-muted-foreground">
              {truncationMessage}
            </p>
          )}
          {canExpand && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => onExpandedChange(!expanded)}
              className="w-full rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {expanded ? "Свернуть" : `Показать ещё ${hiddenCount}`}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function DashboardActivityCard({
  activity,
  selectedMetric,
  onSelectedMetricChange,
  showAssignee,
}: {
  activity: DashboardActivityAnalytics | null;
  selectedMetric: ActivityMetricKey | null;
  onSelectedMetricChange: (metric: ActivityMetricKey | null) => void;
  showAssignee: boolean;
}) {
  const emptyMetric: DashboardActivityMetric = {
    count: 0,
    tasks: [],
    truncated: false,
  };
  const metrics: Array<{
    key: ActivityMetricKey;
    label: string;
    metric: DashboardActivityMetric;
  }> = [
    {
      key: "completed",
      label: "Выполнено",
      metric: activity?.completed ?? emptyMetric,
    },
    {
      key: "created",
      label: "Создано",
      metric: activity?.created ?? emptyMetric,
    },
    {
      key: "in_progress_over_7_days",
      label: "В работе > 7 дней",
      metric: activity?.in_progress_over_7_days ?? emptyMetric,
    },
  ];
  const selected = metrics.find((metric) => metric.key === selectedMetric);
  const delta = activity?.completed_delta.delta ?? 0;
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

  return (
    <>
      <SectionHeader title="Активность за 7 дней" icon={CheckCircle2} />
      <div className="space-y-3">
        <div className="grid gap-2">
          {metrics.map(({ key, label, metric }) => (
            <button
              key={key}
              type="button"
              aria-pressed={selectedMetric === key}
              onClick={() =>
                onSelectedMetricChange(selectedMetric === key ? null : key)
              }
              disabled={metric.count === 0}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
                selectedMetric === key
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground"
              } ${metric.count === 0 ? "opacity-60" : ""}`}
            >
              <span className="text-sm font-medium">{label}</span>
              <span className="text-base font-semibold text-foreground">
                {metric.count}
              </span>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              К прошлой неделе
            </span>
            <span
              className={
                delta >= 0
                  ? "text-sm font-semibold text-emerald-600"
                  : "text-sm font-semibold text-destructive"
              }
            >
              {deltaLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Сравнение по выполненным задачам
          </p>
        </div>
        {selected && selected.metric.count > 0 && (
          <div className="space-y-2" aria-label={selected.label}>
            {selected.metric.tasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                variant={task.status === "done" ? "completed" : "default"}
                showAssignee={showAssignee}
              />
            ))}
            {selected.metric.truncated && (
              <p className="text-xs text-muted-foreground">
                Показаны первые {selected.metric.tasks.length} задач.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ────────────────────────────────────────────
// Upcoming meeting card (with Zoom link)
// ────────────────────────────────────────────

function UpcomingMeetingCard({
  meeting,
  staggerClass,
}: {
  meeting: Meeting;
  staggerClass: string;
}) {
  const safeJoinUrl = sanitizeZoomJoinUrl(
    meeting.zoom_join_url,
    meeting.zoom_meeting_id
  );
  const meetingTitle = meeting.title || "Встреча без названия";
  const { ref: titleRef, isTruncated: isTitleTruncated } =
    useIsTruncated<HTMLAnchorElement>(meetingTitle);
  const parsedMeetingDate = meeting.meeting_date
    ? parseUTCDate(meeting.meeting_date)
    : null;
  const meetingDate =
    parsedMeetingDate && !Number.isNaN(parsedMeetingDate.getTime())
      ? parsedMeetingDate
      : null;

  const dateStr = meetingDate
    ? meetingDate.toLocaleDateString("ru-RU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";

  const timeStr = meetingDate
    ? meetingDate.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={`animate-fade-in-up ${staggerClass} group rounded-2xl border border-border/60 bg-card p-4 transition-shadow duration-200 hover:shadow-md hover:shadow-primary/5`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isTitleTruncated ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  ref={titleRef}
                  href={`/meetings/${meeting.id}`}
                  className="text-sm font-heading font-semibold truncate block group-hover:text-primary transition-colors"
                >
                  {meetingTitle}
                </Link>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                className="max-w-[320px] break-words"
              >
                {meetingTitle}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              ref={titleRef}
              href={`/meetings/${meeting.id}`}
              className="text-sm font-heading font-semibold truncate block group-hover:text-primary transition-colors"
            >
              {meetingTitle}
            </Link>
          )}
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {dateStr} · {timeStr}
          </p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Video className="h-4 w-4" />
        </div>
      </div>
      {safeJoinUrl && (
        <a
          href={safeJoinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Подключиться к Zoom
        </a>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Main Dashboard
// ────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const { departments, loading: departmentsLoading } = useDepartments();
  const { toastError } = useToast();
  const [loading, setLoading] = useState(true);

  // Data
  const [dashboardTasksAnalytics, setDashboardTasksAnalytics] =
    useState<DashboardTasksAnalytics | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [departmentTasks, setDepartmentTasks] = useState<Task[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [myTasksTruncated, setMyTasksTruncated] = useState(false);
  const [departmentTasksTruncated, setDepartmentTasksTruncated] =
    useState(false);
  const [teamTasksTruncated, setTeamTasksTruncated] = useState(false);
  const [teamTasksTotal, setTeamTasksTotal] = useState(0);
  const [selectedActivityMetric, setSelectedActivityMetric] =
    useState<ActivityMetricKey | null>(null);
  const [dashboardActivity, setDashboardActivity] =
    useState<DashboardActivityAnalytics | null>(null);
  const [expandedTaskBlocks, setExpandedTaskBlocks] = useState<
    Record<DashboardTaskBlockKey, boolean>
  >({
    tasks: false,
  });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [taskScope, setTaskScope] = useState<DashboardActivityScope>("my");
  const [myUpcomingMeetings, setMyUpcomingMeetings] = useState<Meeting[]>([]);
  const [myUpcomingMeetingsTotal, setMyUpcomingMeetingsTotal] = useState(0);
  const [myPastMeetingsTotal, setMyPastMeetingsTotal] = useState(0);
  const [departmentUpcomingMeetings, setDepartmentUpcomingMeetings] = useState<Meeting[]>([]);
  const [departmentUpcomingMeetingsTotal, setDepartmentUpcomingMeetingsTotal] = useState(0);
  const [unassignedTasks, setUnassignedTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const isModerator = user ? PermissionService.isModerator(user) : false;
  const userId = user?.id || "";
  const userDepartmentId = user?.department_id || "";
  const userExtraDepartmentIds = useMemo(
    () => user?.extra_department_ids || [],
    [user?.extra_department_ids]
  );
  const userRole = user?.role || "";

  const accessibleDepartments = useMemo(
    () =>
      getAccessibleDepartments({
        departments,
        userId,
        userRole,
        userDepartmentId: userDepartmentId || null,
        userExtraDepartmentIds,
      }),
    [departments, userDepartmentId, userExtraDepartmentIds, userId, userRole]
  );
  const canSwitchDepartment = accessibleDepartments.length > 1;

  useEffect(() => {
    if (!userId || departmentsLoading) return;

    setSelectedDepartmentId((current) => {
      const availableIds = new Set(accessibleDepartments.map((d) => d.id));
      if (current && availableIds.has(current)) {
        return current;
      }
      if (userDepartmentId && availableIds.has(userDepartmentId)) {
        return userDepartmentId;
      }
      return accessibleDepartments[0]?.id || "";
    });
  }, [accessibleDepartments, departmentsLoading, userDepartmentId, userId]);

  const accessibleDepartmentIds = useMemo(
    () => new Set(accessibleDepartments.map((department) => department.id)),
    [accessibleDepartments]
  );

  const canUseDepartmentView =
    Boolean(selectedDepartmentId) &&
    (isModerator || accessibleDepartmentIds.has(selectedDepartmentId));
  const canUseTeamView = isModerator;

  const currentScope: DashboardActivityScope =
    canUseTeamView && taskScope === "team"
      ? "team"
      : canUseDepartmentView && taskScope === "department"
        ? "department"
        : "my";

  useEffect(() => {
    if (taskScope === "team" && !canUseTeamView) {
      setTaskScope("my");
      return;
    }
    if (taskScope === "department" && !canUseDepartmentView) {
      setTaskScope("my");
    }
  }, [canUseDepartmentView, canUseTeamView, taskScope]);

  useEffect(() => {
    setExpandedTaskBlocks({
      tasks: false,
    });
    setSelectedActivityMetric(null);
    setDashboardActivity(null);
  }, [currentScope, selectedDepartmentId]);

  useEffect(() => {
    if (!userId || departmentsLoading) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const catchLog = (label: string) => (err: unknown) => {
          if (process.env.NODE_ENV === "development") {
            console.error(`[Dashboard] ${label} failed:`, err);
          }
          return null;
        };

        const openStatuses = "new,in_progress,review";
        const selectedDepartmentParam = selectedDepartmentId || undefined;
        const emptyTasksPage = {
          items: [] as Task[],
          total: 0,
          page: 1,
          per_page: 0,
          pages: 1,
        };

        const results = await Promise.all([
          api
            .getDashboardTasksAnalytics(selectedDepartmentParam)
            .catch(catchLog("getDashboardTasksAnalytics")),
          api
            .getTasks({
              assignee_id: userId,
              ...(selectedDepartmentParam
                ? { department_id: selectedDepartmentParam }
                : {}),
              status: openStatuses,
              per_page: "200",
              sort: "created_at_desc",
            })
            .catch(catchLog("getMyTasks")),
          selectedDepartmentParam
            ? api
                .getTasks({
                  department_id: selectedDepartmentParam,
                  status: openStatuses,
                  per_page: "200",
                  sort: "created_at_desc",
                })
                .catch(catchLog("getDepartmentTasks"))
            : Promise.resolve(emptyTasksPage),
          isModerator && currentScope === "team"
            ? api
                .getTasks({
                  status: openStatuses,
                  per_page: "200",
                  sort: "created_at_desc",
                })
                .catch(catchLog("getTeamTasks"))
            : Promise.resolve(emptyTasksPage),
          api
            .getDashboardActivity({
              scope: currentScope,
              departmentId:
                currentScope === "department"
                  ? selectedDepartmentParam
                  : undefined,
              detailLimit: 20,
            })
            .catch(catchLog("getDashboardActivity")),
          api.getMeetings({ upcoming: true, member_id: userId }).catch(catchLog("getMyUpcomingMeetings")),
          api.getMeetings({ past: true, member_id: userId }).catch(catchLog("getMyPastMeetings")),
          selectedDepartmentParam
            ? api.getMeetings({ upcoming: true, department_id: selectedDepartmentParam }).catch(catchLog("getDeptUpcomingMeetings"))
            : Promise.resolve([]),
          api.getTeam().catch(catchLog("getTeam")),
          isModerator
            ? api
                .getTasks({
                  status: "new",
                  per_page: "20",
                  sort: "created_at_desc",
                })
                .catch(catchLog("getUnassignedTasks"))
            : Promise.resolve(emptyTasksPage),
        ]);

        if (cancelled) return;

        const dashboardData = results[0] as DashboardTasksAnalytics | null;
        const myTasksData = results[1] as {
          items: Task[];
          total?: number;
        } | null;
        const departmentTasksData = results[2] as {
          items: Task[];
          total?: number;
        } | null;
        const teamTasksData = results[3] as {
          items: Task[];
          total?: number;
        } | null;
        const activityData = results[4] as DashboardActivityAnalytics | null;
        const myMeetingsData = results[5] as Meeting[] | null;
        const myPastMeetingsData = results[6] as Meeting[] | null;
        const deptMeetingsData = results[7] as Meeting[] | null;
        const teamData = results[8] as TeamMember[] | null;
        const unassignedData = results[9] as { items: Task[] } | null;

        const hasError = results.some((r) => r === null);
        const myTaskItems = Array.isArray(myTasksData?.items)
          ? myTasksData.items.filter(Boolean)
          : [];
        const departmentTaskItems = Array.isArray(departmentTasksData?.items)
          ? departmentTasksData.items.filter(Boolean)
          : [];
        const teamTaskItems = Array.isArray(teamTasksData?.items)
          ? teamTasksData.items.filter(Boolean)
          : [];
        const myMeetings = Array.isArray(myMeetingsData)
          ? myMeetingsData.filter(Boolean)
          : [];
        const myPastMeetings = Array.isArray(myPastMeetingsData)
          ? myPastMeetingsData.filter(Boolean)
          : [];
        const departmentMeetings = Array.isArray(deptMeetingsData)
          ? deptMeetingsData.filter(Boolean)
          : [];
        const members = Array.isArray(teamData) ? teamData.filter(Boolean) : [];
        const unassignedItems = Array.isArray(unassignedData?.items)
          ? unassignedData.items.filter(Boolean)
          : [];
        const sortedMyTasks = sortDashboardActiveTasks(myTaskItems);
        const sortedDepartmentTasks =
          sortDashboardActiveTasks(departmentTaskItems);
        const sortedTeamTasks = sortDashboardActiveTasks(teamTaskItems);

        setDashboardTasksAnalytics(dashboardData);
        setDashboardActivity(activityData);
        setTeamMembers(members);

        // Keep full lists for derived slices (overdue/stale/preview)
        setMyTasks(sortedMyTasks);
        setMyTasksTruncated((myTasksData?.total ?? 0) > myTaskItems.length);

        // Department tasks
        setDepartmentTasks(sortedDepartmentTasks);
        setDepartmentTasksTruncated(
          (departmentTasksData?.total ?? 0) > departmentTaskItems.length,
        );

        // Team tasks
        setTeamTasks(sortedTeamTasks);
        setTeamTasksTruncated((teamTasksData?.total ?? 0) > teamTaskItems.length);
        setTeamTasksTotal(teamTasksData?.total ?? teamTaskItems.length);

        // Upcoming meetings (top 3, but keep total count for badge)
        setMyUpcomingMeetings(myMeetings.slice(0, 3));
        setMyUpcomingMeetingsTotal(myMeetings.length);
        setMyPastMeetingsTotal(myPastMeetings.length);
        setDepartmentUpcomingMeetings(departmentMeetings.slice(0, 3));
        setDepartmentUpcomingMeetingsTotal(departmentMeetings.length);

        // Moderator data
        if (isModerator) {
          setUnassignedTasks(
            unassignedItems.filter((t) => !t.assignee_id).slice(0, 5)
          );
        } else {
          setUnassignedTasks([]);
        }

        if (hasError) toastError("Не удалось загрузить часть данных");
      } catch {
        if (!cancelled) toastError("Не удалось загрузить данные");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [
    currentScope,
    departmentsLoading,
    isModerator,
    selectedDepartmentId,
    toastError,
    userId,
  ]);

  const scopedDashboardActivity = useMemo(() => {
    if (!dashboardActivity || dashboardActivity.scope !== currentScope) {
      return null;
    }

    if (currentScope === "department") {
      return dashboardActivity.selected_department_id === selectedDepartmentId
        ? dashboardActivity
        : null;
    }

    return dashboardActivity.selected_department_id === null
      ? dashboardActivity
      : null;
  }, [currentScope, dashboardActivity, selectedDepartmentId]);

  useEffect(() => {
    if (!selectedActivityMetric) return;

    const metric = scopedDashboardActivity?.[selectedActivityMetric];
    if (!metric || metric.count === 0) {
      setSelectedActivityMetric(null);
    }
  }, [scopedDashboardActivity, selectedActivityMetric]);

  if (!user) return null;

  if (loading || departmentsLoading) {
    return <DashboardSkeleton />;
  }

  const myMetrics = dashboardTasksAnalytics?.my;
  const departmentMetrics = dashboardTasksAnalytics?.department;

  const scopedTasks =
    currentScope === "team"
      ? teamTasks
      : currentScope === "department"
        ? departmentTasks
        : myTasks;
  const scopedTasksTruncated =
    currentScope === "team"
      ? teamTasksTruncated
      : currentScope === "department"
        ? departmentTasksTruncated
        : myTasksTruncated;
  const scopedOpenTaskGroups = splitDashboardOpenTasks(scopedTasks);
  const mergedTaskList = [
    ...scopedOpenTaskGroups.overdue,
    ...scopedOpenTaskGroups.active,
  ];

  const scopedMeetings = currentScope === "department" ? departmentUpcomingMeetings : myUpcomingMeetings;

  const taskListTitle =
    currentScope === "team"
      ? "Задачи команды"
      : currentScope === "department"
        ? "Задачи отдела"
        : "Мои задачи";
  const emptyTaskTitle =
    currentScope === "team"
      ? "В команде нет активных задач"
      : currentScope === "department"
      ? "В отделе нет активных задач"
      : "Нет активных задач";
  const emptyTaskDescription =
    currentScope === "team"
      ? "По команде сейчас нет активных задач."
      : currentScope === "department"
      ? "По выбранному отделу сейчас нет активных задач."
      : "Все задачи выполнены — отличная работа!";

  // Build badges for tasks section
  const scopedActiveTotal =
    currentScope === "team"
      ? teamTasksTotal
      : currentScope === "department"
        ? (departmentMetrics?.active ?? scopedTasks.length)
        : (myMetrics?.active ?? scopedTasks.length);
  const taskBadges: BadgeInfo[] = [
    { label: "активных", value: scopedActiveTotal, color: "default" },
  ];
  if (scopedOpenTaskGroups.overdue.length > 0) {
    taskBadges.push({
      label: "просрочено",
      value: scopedOpenTaskGroups.overdue.length,
      color: "red",
    });
  }

  const scopedMeetingsTotal = currentScope === "department" ? departmentUpcomingMeetingsTotal : myUpcomingMeetingsTotal;
  const meetingBadges: BadgeInfo[] = [];
  if (scopedMeetingsTotal > 0) {
    meetingBadges.push({ label: "предстоящих", value: scopedMeetingsTotal, color: "blue" });
  }

  const isMemberInMyScope = currentScope === "my" && userRole === "member";
  const hasMyUpcomingMeetings = myUpcomingMeetingsTotal > 0;
  const hasMyPastMeetings = myPastMeetingsTotal > 0;

  let meetingsLinkHref: string | undefined = "/meetings";
  let meetingsLinkLabel: string | undefined = "Все встречи";

  if (isMemberInMyScope) {
    if (hasMyUpcomingMeetings) {
      meetingsLinkHref = "/meetings?scope=my";
      meetingsLinkLabel = "Мои встречи";
    } else if (hasMyPastMeetings) {
      meetingsLinkHref = "/meetings?scope=my&tab=past";
      meetingsLinkLabel = "История встреч";
    } else {
      meetingsLinkHref = undefined;
      meetingsLinkLabel = undefined;
    }
  }

  if (scopedMeetingsTotal === 0 && meetingsLinkLabel === "Все встречи") {
    meetingsLinkHref = undefined;
    meetingsLinkLabel = undefined;
  }

  const todayStr = formatFullDate(new Date());

  const ACCENT_BLUE = "hsl(200, 65%, 48%)";

  const setTaskBlockExpanded = (
    blockKey: DashboardTaskBlockKey,
    expanded: boolean,
  ) => {
    setExpandedTaskBlocks((current) => ({
      ...current,
      [blockKey]: expanded,
    }));
  };

  return (
    <div className="space-y-6">
      {/* ═══════════ Compact Header ═══════════ */}
      <section className="animate-fade-in-up stagger-1">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="truncate text-lg font-bold font-heading tracking-tight">
              {firstName(user.full_name)}
            </h1>
            <span className="text-sm text-muted-foreground capitalize hidden sm:inline">
              {todayStr}
            </span>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
            {(canUseDepartmentView || canUseTeamView) && (
              <div className="inline-flex rounded-lg border border-border/60 bg-card p-0.5">
                <button
                  onClick={() => setTaskScope("my")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    currentScope === "my"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Мои
                </button>
                <button
                  onClick={() => setTaskScope("department")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    currentScope === "department"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Отдел
                </button>
                {canUseTeamView && (
                  <button
                    onClick={() => setTaskScope("team")}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      currentScope === "team"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Команда
                  </button>
                )}
              </div>
            )}

            {canSwitchDepartment && (
              <Select
                value={
                  selectedDepartmentId ||
                  (accessibleDepartments[0]?.id
                    ? accessibleDepartments[0].id
                    : "__none__")
                }
                onValueChange={(value) => {
                  if (value === "__none__") return;
                  setSelectedDepartmentId(value);
                }}
              >
                <SelectTrigger className="h-8 w-full border-border/60 bg-card text-sm shadow-sm sm:w-[200px]">
                  <SelectValue placeholder="Отдел" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleDepartments.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Нет доступных отделов
                    </SelectItem>
                  ) : (
                    accessibleDepartments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ Task Blocks ═══════════ */}
      <section className="animate-fade-in-up stagger-2">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Scoped Tasks */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 lg:col-span-2">
            <DashboardTaskBlock
              blockKey="tasks"
              title={taskListTitle}
              icon={ClipboardList}
              badges={taskBadges}
              tasks={mergedTaskList}
              expanded={expandedTaskBlocks.tasks}
              onExpandedChange={(expanded) =>
                setTaskBlockExpanded("tasks", expanded)
              }
              emptyContent={
                <DashboardEmptyState
                  icon={ClipboardList}
                  title={emptyTaskTitle}
                  description={emptyTaskDescription}
                  iconContainerClassName="bg-primary/10"
                  iconClassName="text-primary"
                />
              }
              itemVariant="default"
              showAssignee={currentScope !== "my"}
              orderingHint="Сначала просроченные, затем срочные и ближайшие дедлайны"
              truncated={scopedTasksTruncated}
              truncationMessage={`Загружены первые ${scopedTasks.length} задач; в полном списке может быть больше.`}
              linkHref="/tasks"
              linkLabel="На доску"
              groups={[
                {
                  title: "Просрочено",
                  tasks: scopedOpenTaskGroups.overdue,
                  itemVariant: "overdue",
                },
                {
                  title: "Активные",
                  tasks: scopedOpenTaskGroups.active,
                  itemVariant: "default",
                },
              ]}
            />
          </div>

          {/* Activity */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <DashboardActivityCard
              activity={scopedDashboardActivity}
              selectedMetric={selectedActivityMetric}
              onSelectedMetricChange={setSelectedActivityMetric}
              showAssignee={currentScope !== "my"}
            />
          </div>
        </div>
      </section>

      {/* ═══════════ Upcoming Meetings ═══════════ */}
      <section className="animate-fade-in-up stagger-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <SectionHeader
            title={currentScope === "department" ? "Встречи отдела" : "Мои встречи"}
            icon={Video}
            iconColor={ACCENT_BLUE}
            linkHref={meetingsLinkHref}
            linkLabel={meetingsLinkLabel}
            badges={meetingBadges}
          />
          {scopedMeetings.length === 0 ? (
            <EmptyState
              variant="meetings"
              compact
              title={currentScope === "department" ? "В отделе нет предстоящих встреч" : "У вас нет предстоящих встреч"}
              description={currentScope === "department" ? "По выбранному отделу нет запланированных встреч." : "Вы пока не являетесь участником ни одной предстоящей встречи."}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {scopedMeetings.map((meeting, i) => (
                <UpcomingMeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  staggerClass={`stagger-${i + 4}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ Upcoming Birthdays ═══════════ */}
      {teamMembers.length > 0 && (
        <section className="animate-fade-in-up stagger-4">
          <UpcomingBirthdays
            members={teamMembers}
            className=""
          />
        </section>
      )}

      {/* ═══════════ Moderator: Unassigned ═══════════ */}
      {isModerator && unassignedTasks.length > 0 && (
        <section className="animate-fade-in-up stagger-5">
          <div className="rounded-2xl border border-dashed border-muted-foreground/20 bg-card p-5">
            <SectionHeader
              title="Ожидают назначения"
              icon={UserX}
              count={unassignedTasks.length}
              linkHref="/tasks"
              linkLabel="Все задачи"
            />
            <div className="space-y-2">
              {unassignedTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  variant="unassigned"
                />
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
