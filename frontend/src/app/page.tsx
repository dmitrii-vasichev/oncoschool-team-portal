"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Mic,
  FileText,
  Clock,
  UserX,
  AlertOctagon,
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
import { StatusIcon } from "@/components/shared/StatusBadge";
import { PriorityIcon } from "@/components/shared/PriorityBadge";
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
import { PermissionService } from "@/lib/permissions";
import { getAccessibleDepartments } from "@/lib/departmentAccess";
import { api } from "@/lib/api";
import { sanitizeZoomJoinUrl } from "@/lib/zoomLink";
import { UpcomingBirthdays } from "./team/components/UpcomingBirthdays";
import type {
  DashboardTasksAnalytics,
  Task,
  Meeting,
  TeamMember,
} from "@/lib/types";
import { parseLocalDate, parseUTCDate } from "@/lib/dateUtils";

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("ru-RU", {
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

function isStale(task: Task): boolean {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return new Date(task.updated_at) < threeDaysAgo;
}

function firstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

function firstAndLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
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
  variant?: "default" | "overdue" | "unassigned" | "stale";
  showAssignee?: boolean;
}) {
  const overdue = variant === "overdue" || isOverdue(task);
  const borderClass = overdue
    ? "border border-destructive/35 bg-destructive/[0.06] hover:bg-destructive/[0.1] shadow-[0_0_0_1px_hsl(var(--destructive)/0.12)_inset]"
    : variant === "unassigned"
      ? "border border-dashed border-muted-foreground/20 hover:bg-secondary/50"
      : variant === "stale"
        ? "border border-amber-500/25 bg-amber-500/[0.03] hover:bg-amber-500/[0.07]"
        : "border border-border/60 hover:bg-secondary/50";

  const sourceIcon =
    task.source === "voice" ? (
      <Mic className="h-3 w-3 text-muted-foreground" />
    ) : task.source === "summary" ? (
      <FileText className="h-3 w-3 text-muted-foreground" />
    ) : null;
  const checklist = task.checklist || [];
  const completedChecklist = checklist.filter((item) => item.is_completed).length;

  return (
    <TooltipProvider delayDuration={120}>
      <Link
        href={`/tasks/${task.short_id}`}
        className={`block rounded-xl p-3 transition-all duration-150 ${borderClass}`}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex items-center gap-1.5 shrink-0">
            <StatusIcon
              status={task.status}
              className={`h-6 w-6 rounded-[10px] ${overdue ? "ring-destructive/35" : ""}`}
            />
            <PriorityIcon priority={task.priority} className="h-6 w-6 rounded-[10px]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="min-w-0 flex items-start gap-1.5">
              {sourceIcon}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <span
                    className={`text-sm font-heading font-semibold leading-tight line-clamp-2 ${
                      overdue ? "text-destructive" : ""
                    }`}
                  >
                    {task.title}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  className="max-w-[320px] break-words"
                >
                  {task.title}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="mt-2 flex items-center gap-x-2 gap-y-1.5 flex-wrap">
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
                <UserAvatar name={task.created_by.full_name} avatarUrl={task.created_by.avatar_url} size="sm" />
                {task.created_by.full_name}
              </span>
            )}
            {variant === "stale" && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Обновлено: {formatDate(task.updated_at)}
              </span>
            )}
            {showAssignee && (
              task.assignee ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                  <UserAvatar
                    name={task.assignee.full_name}
                    avatarUrl={task.assignee.avatar_url}
                    size="sm"
                  />
                  <span className="truncate max-w-[150px]">
                    {firstAndLastName(task.assignee.full_name)}
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
  icon?: React.ElementType;
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
  const meetingDate = meeting.meeting_date
    ? parseUTCDate(meeting.meeting_date)
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
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
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
  const [myOverdueTasks, setMyOverdueTasks] = useState<Task[]>([]);
  const [departmentTasks, setDepartmentTasks] = useState<Task[]>([]);
  const [departmentOverdueTasks, setDepartmentOverdueTasks] = useState<Task[]>(
    []
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [taskScope, setTaskScope] = useState<"my" | "department">("my");
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

  useEffect(() => {
    if (!canUseDepartmentView && taskScope === "department") {
      setTaskScope("my");
    }
  }, [canUseDepartmentView, taskScope]);

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
              per_page: "50",
              sort: "created_at_desc",
            })
            .catch(catchLog("getMyTasks")),
          selectedDepartmentParam
            ? api
                .getTasks({
                  department_id: selectedDepartmentParam,
                  status: openStatuses,
                  per_page: "50",
                  sort: "created_at_desc",
                })
                .catch(catchLog("getDepartmentTasks"))
            : Promise.resolve(emptyTasksPage),
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
        const myTasksData = results[1] as { items: Task[] } | null;
        const departmentTasksData = results[2] as { items: Task[] } | null;
        const myMeetingsData = results[3] as Meeting[] | null;
        const myPastMeetingsData = results[4] as Meeting[] | null;
        const deptMeetingsData = results[5] as Meeting[] | null;
        const teamData = results[6] as TeamMember[] | null;
        const unassignedData = results[7] as { items: Task[] } | null;

        const hasError = results.some((r) => r === null);

        setDashboardTasksAnalytics(dashboardData);
        setTeamMembers(teamData ?? []);

        // Keep full lists for derived slices (overdue/stale/preview)
        if (myTasksData) {
          setMyTasks(myTasksData.items);
          setMyOverdueTasks(myTasksData.items.filter(isOverdue));
        } else {
          setMyTasks([]);
          setMyOverdueTasks([]);
        }

        // Department tasks
        if (departmentTasksData) {
          setDepartmentTasks(departmentTasksData.items);
          setDepartmentOverdueTasks(departmentTasksData.items.filter(isOverdue));
        } else {
          setDepartmentTasks([]);
          setDepartmentOverdueTasks([]);
        }

        // Upcoming meetings (top 3, but keep total count for badge)
        setMyUpcomingMeetings(myMeetingsData ? myMeetingsData.slice(0, 3) : []);
        setMyUpcomingMeetingsTotal(myMeetingsData ? myMeetingsData.length : 0);
        setMyPastMeetingsTotal(myPastMeetingsData ? myPastMeetingsData.length : 0);
        setDepartmentUpcomingMeetings(deptMeetingsData ? (deptMeetingsData as Meeting[]).slice(0, 3) : []);
        setDepartmentUpcomingMeetingsTotal(deptMeetingsData ? (deptMeetingsData as Meeting[]).length : 0);

        // Moderator data
        if (isModerator) {
          setUnassignedTasks(
            unassignedData
              ? unassignedData.items.filter((t) => !t.assignee_id).slice(0, 5)
              : []
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
  }, [departmentsLoading, isModerator, selectedDepartmentId, toastError, userId]);

  if (!user) return null;

  if (loading || departmentsLoading) {
    return <DashboardSkeleton />;
  }

  const myMetrics = dashboardTasksAnalytics?.my;
  const departmentMetrics = dashboardTasksAnalytics?.department;

  const activeTasks = myMetrics?.active ?? 0;
  const completedThisWeek = myMetrics?.done_week ?? 0;

  const currentScope =
    canUseDepartmentView && taskScope === "department" ? "department" : "my";
  const scopedTasks = currentScope === "department" ? departmentTasks : myTasks;
  const scopedOverdueTasks =
    currentScope === "department" ? departmentOverdueTasks : myOverdueTasks;
  const scopedStaleTasks = scopedTasks
    .filter((task) => task.status === "in_progress" || task.status === "review")
    .filter(isStale);

  const scopedMeetings = currentScope === "department" ? departmentUpcomingMeetings : myUpcomingMeetings;

  const taskListTitle = currentScope === "department" ? "Задачи отдела" : "Мои задачи";
  const overdueListTitle =
    currentScope === "department"
      ? "Просроченные задачи отдела"
      : "Просроченные задачи";
  const emptyTaskTitle =
    currentScope === "department"
      ? "В отделе нет активных задач"
      : "Нет активных задач";
  const emptyTaskDescription =
    currentScope === "department"
      ? "По выбранному отделу сейчас нет активных задач."
      : "Все задачи выполнены — отличная работа!";

  // Build badges for tasks section
  const taskBadges: BadgeInfo[] = [];
  if (currentScope === "my") {
    taskBadges.push({ label: "активных", value: activeTasks, color: "default" });
    if (completedThisWeek > 0) {
      taskBadges.push({ label: "за неделю", value: completedThisWeek, color: "green" });
    }
  } else {
    taskBadges.push({ label: "активных", value: departmentMetrics?.active ?? 0, color: "default" });
    if ((departmentMetrics?.done_total ?? 0) > 0) {
      taskBadges.push({ label: "выполнено", value: departmentMetrics?.done_total ?? 0, color: "green" });
    }
  }

  const overdueBadges: BadgeInfo[] = [];
  if (scopedOverdueTasks.length > 0) {
    overdueBadges.push({ label: "просрочено", value: scopedOverdueTasks.length, color: "red" });
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

  const ACCENT_DESTRUCTIVE = "hsl(0, 72%, 51%)";
  const ACCENT_BLUE = "hsl(200, 65%, 48%)";

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
            {canUseDepartmentView && (
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
          {/* Active Tasks */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <SectionHeader
              title={taskListTitle}
              icon={Zap}
              badges={taskBadges}
              linkHref="/tasks"
              linkLabel="Все задачи"
            />

            {scopedTasks.length === 0 ? (
              <EmptyState
                variant="tasks"
                title={emptyTaskTitle}
                description={emptyTaskDescription}
                className="py-6"
              />
            ) : (
              <div className="space-y-2">
                {scopedTasks.slice(0, 5).map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    variant={isOverdue(task) ? "overdue" : "default"}
                    showAssignee={currentScope === "department"}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Overdue Tasks */}
          <div
            className={`rounded-2xl border p-4 ${
              scopedOverdueTasks.length > 0
                ? "border-destructive/20 bg-destructive/[0.02]"
                : "border-border/60 bg-card"
            }`}
          >
            <SectionHeader
              title={overdueListTitle}
              icon={AlertTriangle}
              iconColor={ACCENT_DESTRUCTIVE}
              badges={overdueBadges}
            />

            {scopedOverdueTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-done-bg">
                  <CheckCircle2 className="h-5 w-5 text-status-done-fg" />
                </div>
                <p className="mb-0.5 text-sm font-heading font-semibold text-foreground">
                  Всё в срок
                </p>
                <p className="text-xs text-muted-foreground">
                  Нет просроченных задач
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {scopedOverdueTasks.slice(0, 5).map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    variant="overdue"
                    showAssignee={currentScope === "department"}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stale Tasks */}
          <div
            className={`rounded-2xl border p-4 ${
              scopedStaleTasks.length > 0
                ? "border-amber-500/25 bg-amber-500/[0.03]"
                : "border-border/60 bg-card"
            }`}
          >
            <SectionHeader
              title="Не обновлялись"
              icon={AlertOctagon}
              iconColor="hsl(38, 80%, 52%)"
              count={scopedStaleTasks.length}
              linkHref="/tasks"
              linkLabel="Все задачи"
            />
            {scopedStaleTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-done-bg">
                  <CheckCircle2 className="h-5 w-5 text-status-done-fg" />
                </div>
                <p className="mb-0.5 text-sm font-heading font-semibold text-foreground">
                  Актуально
                </p>
                <p className="text-xs text-muted-foreground">
                  Задач без обновлений более 3 дней нет
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {scopedStaleTasks.slice(0, 5).map((task) => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    variant="stale"
                    showAssignee={currentScope === "department"}
                  />
                ))}
              </div>
            )}
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
