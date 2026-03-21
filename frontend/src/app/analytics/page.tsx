"use client";

import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useToast } from "@/components/shared/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDepartments } from "@/hooks/useDepartments";
import { PermissionService } from "@/lib/permissions";
import { getAccessibleDepartments } from "@/lib/departmentAccess";
import { api } from "@/lib/api";
import type {
  MemberStats,
  MeetingAnalytics,
  OverviewAnalytics,
} from "@/lib/types";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Layers3,
  Lightbulb,
  ListTodo,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_TEAL = "hsl(174, 62%, 26%)";
const CHART_CORAL = "hsl(16, 76%, 58%)";
const CHART_VIOLET = "hsl(262, 52%, 55%)";
const CHART_AMBER = "hsl(43, 82%, 58%)";
const CHART_BLUE = "hsl(200, 65%, 48%)";

const SOURCE_CHART: Record<string, { label: string; color: string }> = {
  text: { label: "Текст", color: CHART_BLUE },
  voice: { label: "Голос", color: CHART_VIOLET },
  summary: { label: "Summary", color: CHART_AMBER },
  web: { label: "Веб", color: CHART_TEAL },
};

const PRIORITY_CHART: Record<string, { label: string; color: string }> = {
  urgent: { label: "Срочный", color: "hsl(0, 72%, 51%)" },
  high: { label: "Высокий", color: CHART_CORAL },
  medium: { label: "Средний", color: CHART_AMBER },
  low: { label: "Низкий", color: "hsl(210, 10%, 60%)" },
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function daysSinceLabel(days: number): string {
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} дн. назад`;
}

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  isAlert,
  stagger,
}: {
  label: string;
  value: number | string;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  isAlert?: boolean;
  stagger: number;
}) {
  return (
    <div
      className={`animate-fade-in-up stagger-${stagger} group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5`}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80 group-hover:opacity-100"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="animate-count-up text-3xl font-bold font-heading tracking-tight">
              {value}
            </span>
            {isAlert && (
              <span className="animate-pulse-glow inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl opacity-70 group-hover:opacity-100"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          <Icon className="h-5 w-5" style={{ color: accentColor }} />
        </div>
      </div>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-foreground">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <p key={item.name} className="text-xs text-muted-foreground">
            <span
              className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
              style={{ backgroundColor: item.color || "hsl(var(--muted-foreground))" }}
            />
            {item.name}: <span className="font-semibold text-foreground">{item.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function DistributionBars({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: number; color: string }>;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-4">
      <h4 className="text-sm font-semibold font-heading">{title}</h4>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Нет данных</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row) => {
            const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;
            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground">
                    {row.value} ({percent}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/70">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.max(percent, row.value > 0 ? 6 : 0)}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

function EmptyPanel({
  title = "Нет данных",
  description = "Для этого блока пока недостаточно данных.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/30 px-4 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function MemberDepartmentBadge({
  name,
  color,
}: {
  name: string | null;
  color: string | null;
}) {
  const label = name || "Без отдела";

  if (!color) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
        {label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}55`,
        color,
      }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export default function AnalyticsPage() {
  const { user } = useCurrentUser();
  const { departments, loading: departmentsLoading } = useDepartments();
  const { toastError } = useToast();

  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [meetingStats, setMeetingStats] = useState<MeetingAnalytics | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);

  const isModerator = user ? PermissionService.isModerator(user) : false;
  const userId = user?.id || "";
  const userRole = user?.role || "";
  const userDepartmentId = user?.department_id || "";
  const userExtraDepartmentIds = useMemo(
    () => user?.extra_department_ids || [],
    [user?.extra_department_ids]
  );

  const accessibleDepartments = useMemo(
    () =>
      getAccessibleDepartments({
        departments,
        userId,
        userRole,
        userDepartmentId: userDepartmentId || null,
        userExtraDepartmentIds,
      }),
    [departments, userExtraDepartmentIds, userId, userRole, userDepartmentId]
  );

  useEffect(() => {
    if (!userId || departmentsLoading) return;

    setSelectedDepartmentId((current) => {
      const availableIds = new Set(accessibleDepartments.map((d) => d.id));

      if (isModerator) {
        if (!current) return "";
        return availableIds.has(current) ? current : "";
      }

      if (current && availableIds.has(current)) {
        return current;
      }
      if (userDepartmentId && availableIds.has(userDepartmentId)) {
        return userDepartmentId;
      }
      return accessibleDepartments[0]?.id || "";
    });
  }, [
    accessibleDepartments,
    departmentsLoading,
    isModerator,
    userDepartmentId,
    userId,
  ]);

  useEffect(() => {
    if (!userId || departmentsLoading) return;
    if (!isModerator && accessibleDepartments.length > 0 && !selectedDepartmentId) return;

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const departmentParam = selectedDepartmentId || undefined;
        const [overviewData, membersData, meetingsData] = await Promise.all([
          api.getOverview(departmentParam),
          isModerator
            ? api.getMembersAnalytics(departmentParam)
            : Promise.resolve({ members: [] }),
          api.getMeetingsAnalytics(),
        ]);

        if (cancelled) return;
        setOverview(overviewData);
        setMembers(membersData.members);
        setMeetingStats(meetingsData);
      } catch {
        if (!cancelled) {
          toastError("Не удалось загрузить аналитику");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [
    accessibleDepartments.length,
    departmentsLoading,
    isModerator,
    selectedDepartmentId,
    toastError,
    userId,
  ]);

  const boardColumns = useMemo(() => overview?.board_columns ?? [], [overview]);
  const monthlyFlow = useMemo(() => overview?.monthly_flow ?? [], [overview]);
  const departmentRows = useMemo(() => overview?.departments ?? [], [overview]);

  const completionRate = overview?.completion_rate ?? 0;
  const activeTasks = overview?.active_tasks ?? 0;
  const doneWeek = overview?.tasks_done_week ?? 0;
  const overdueTasks = overview?.tasks_overdue ?? 0;

  const sourceRows = useMemo(
    () =>
      overview?.tasks_by_source
        ? Object.entries(overview.tasks_by_source)
            .map(([key, value]) => ({
              label: SOURCE_CHART[key]?.label || key,
              value,
              color: SOURCE_CHART[key]?.color || "hsl(210, 10%, 60%)",
            }))
            .filter((row) => row.value > 0)
            .sort((a, b) => b.value - a.value)
        : [],
    [overview]
  );

  const priorityRows = useMemo(
    () =>
      overview?.tasks_by_priority
        ? Object.entries(overview.tasks_by_priority)
            .map(([key, value]) => ({
              label: PRIORITY_CHART[key]?.label || key,
              value,
              color: PRIORITY_CHART[key]?.color || "hsl(210, 10%, 60%)",
            }))
            .filter((row) => row.value > 0)
            .sort((a, b) => b.value - a.value)
        : [],
    [overview]
  );

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (b.tasks_done !== a.tasks_done) return b.tasks_done - a.tasks_done;
        return b.total_tasks - a.total_tasks;
      }),
    [members]
  );

  const insights = useMemo(() => {
    if (!overview) return [] as Array<{ title: string; description: string; action: string }>;

    const result: Array<{ title: string; description: string; action: string }> = [];

    if (overview.tasks_overdue > 0) {
      result.push({
        title: "Зона риска по срокам",
        description: `Просрочено ${overview.tasks_overdue} задач в текущем срезе.`,
        action:
          "Соберите отдельный weekly-спринт по просрочкам и зафиксируйте owner на каждую задачу.",
      });
    }

    if (overview.tasks_review >= overview.tasks_in_progress && overview.tasks_review > 0) {
      result.push({
        title: "Узкое место на этапе согласования",
        description: `На согласовании ${overview.tasks_review}, в работе ${overview.tasks_in_progress}.`,
        action:
          "Выделите отдельные слоты согласования и ограничьте входящий поток задач до разгрузки очереди.",
      });
    }

    const topDepartment = departmentRows[0];
    if (topDepartment) {
      result.push({
        title: "Лидер нагрузки по отделам",
        description: `${topDepartment.department_name}: ${topDepartment.active_tasks} активных задач.`,
        action:
          "Проверьте баланс между отделами и перераспределите высокоприоритетные задачи.",
      });
    }

    const topSource = sourceRows[0];
    if (topSource) {
      result.push({
        title: "Основной канал поступления",
        description: `Больше всего задач приходит через «${topSource.label}».`,
        action:
          "Добавьте quality-check для этого канала, чтобы снизить шум и дубли в backlog.",
      });
    }

    return result.slice(0, 4);
  }, [departmentRows, overview, sourceRows]);

  const blockInventory = [
    {
      title: "Контур борда",
      description:
        "Блок «Статусы борда» показывает, где копится очередь внутри Kanban-цикла (Новые → В работе → На согласовании → Готово).",
      usage:
        "Используйте его ежедневно на standup для оперативного управления потоком задач.",
      extension:
        "Новое объединение: добавить связку «статус + приоритет», чтобы видеть, где зависают критичные задачи.",
    },
    {
      title: "Контур отделов",
      description:
        "Сводка по отделам даёт быстрый снимок загрузки, просрочек и результата за неделю по каждой функции.",
      usage:
        "Используйте его еженедельно для балансировки ресурсов и выбора фокуса руководителей.",
      extension:
        "Новое объединение: добавить связку «отдел + источник», чтобы понять, откуда в отдел приходит перегруз.",
    },
    {
      title: "Контур потока",
      description:
        "График динамики «создано/завершено» показывает сезонность и разрыв между входом и выходом задач.",
      usage:
        "Используйте его для ретроспективы и планирования нагрузки на следующий цикл.",
      extension:
        "Новое изучение: добавить 30-дневный rolling коэффициент завершения для раннего сигнала перегрева.",
    },
  ];

  const canSelectDepartment = isModerator || accessibleDepartments.length > 1;

  if (!user) return null;
  if (loading || departmentsLoading) return <AnalyticsSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <section className="animate-fade-in-up stagger-1 rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          {canSelectDepartment && (
            <div className="w-full md:w-[320px]">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Отдел</p>
              <Select
                value={selectedDepartmentId || "__all__"}
                onValueChange={(value) => {
                  if (value === "__all__") {
                    setSelectedDepartmentId("");
                    return;
                  }
                  setSelectedDepartmentId(value);
                }}
              >
                <SelectTrigger className="h-10 border-border/60 bg-background/70">
                  <SelectValue placeholder="Выберите отдел" />
                </SelectTrigger>
                <SelectContent>
                  {isModerator && <SelectItem value="__all__">Все отделы</SelectItem>}
                  {accessibleDepartments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Активные задачи"
          value={activeTasks}
          subtitle={`Всего в срезе: ${overview?.total_tasks ?? 0}`}
          icon={ListTodo}
          accentColor={CHART_TEAL}
          stagger={2}
        />
        <StatCard
          label="Сделано за 7 дней"
          value={doneWeek}
          subtitle="Недельная продуктивность"
          icon={CheckCircle2}
          accentColor="hsl(152, 55%, 35%)"
          stagger={3}
        />
        <StatCard
          label="Процент завершения"
          value={`${completionRate}%`}
          subtitle="Done от общего числа задач"
          icon={TrendingUp}
          accentColor={CHART_BLUE}
          stagger={4}
        />
        <StatCard
          label="Просроченные"
          value={overdueTasks}
          subtitle="Требуют приоритезации"
          icon={AlertTriangle}
          accentColor="hsl(0, 72%, 51%)"
          isAlert={overdueTasks > 0}
          stagger={5}
        />
        <StatCard
          label="Встречи (месяц)"
          value={meetingStats?.meetings_this_month ?? 0}
          subtitle={`Всего встреч: ${meetingStats?.total_meetings ?? 0}`}
          icon={Calendar}
          accentColor={CHART_VIOLET}
          stagger={6}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-7 rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">Статусы борда</h3>
          </div>
          {boardColumns.length === 0 ? (
            <EmptyPanel />
          ) : (
            <div className="space-y-3">
              {boardColumns.map((column) => (
                <div key={column.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{column.label}</span>
                    <span className="font-medium text-foreground">
                      {column.count} ({column.share_percent}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/70">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.max(column.share_percent, column.count > 0 ? 6 : 0)}%`,
                        backgroundColor:
                          column.key === "new"
                            ? "hsl(210, 20%, 62%)"
                            : column.key === "in_progress"
                              ? CHART_TEAL
                              : column.key === "review"
                                ? CHART_AMBER
                                : "hsl(152, 55%, 38%)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="animate-fade-in-up stagger-8 rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">
              Динамика потока (6 месяцев)
            </h3>
          </div>
          {monthlyFlow.length === 0 ? (
            <EmptyPanel />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyFlow} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  type="monotone"
                  dataKey="created"
                  name="Создано"
                  stroke={CHART_BLUE}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Завершено"
                  stroke="hsl(152, 55%, 38%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-8 rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">Срез по отделам</h3>
          </div>
          {departmentRows.length === 0 ? (
            <EmptyPanel
              title="Нет данных по отделам"
              description="Проверьте доступ к отделам или измените фильтр."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                      Отдел
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                      Активные
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                      Просроч.
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                      Done 7д
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                      Всего
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {departmentRows.map((row) => {
                    const isSelected = selectedDepartmentId === row.department_id;
                    return (
                      <tr
                        key={row.department_id}
                        className={isSelected ? "bg-primary/5" : "hover:bg-muted/30"}
                      >
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  row.department_color || "hsl(var(--muted-foreground))",
                              }}
                            />
                            <span className="font-medium">{row.department_name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          {row.active_tasks}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          {row.overdue_tasks > 0 ? (
                            <span className="font-medium text-destructive">
                              {row.overdue_tasks}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">0</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          {row.done_week}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          {row.total_tasks}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="animate-fade-in-up stagger-9 rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">
              Источники и приоритеты
            </h3>
          </div>
          <div className="space-y-4">
            <DistributionBars title="По источникам" rows={sourceRows} />
            <DistributionBars title="По приоритетам" rows={priorityRows} />
          </div>
        </div>
      </section>

      {isModerator && (
        <section className="animate-fade-in-up stagger-9 rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">
              Рейтинг участников
            </h3>
          </div>
          {sortedMembers.length === 0 ? (
            <EmptyPanel title="Нет данных по участникам" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                      Участник
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                      Done
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                      В работе
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                      Просроч.
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                      Посл. апдейт
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedMembers.map((member) => {
                    const days = daysSince(member.last_update);
                    return (
                      <tr key={member.id} className="hover:bg-muted/30">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              name={member.full_name}
                              avatarUrl={member.avatar_url}
                              size="sm"
                            />
                            <span className="font-medium">{member.full_name}</span>
                            <MemberDepartmentBadge
                              name={member.department_name}
                              color={member.department_color}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs text-status-done-fg">
                          {member.tasks_done}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          {member.tasks_in_progress}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-xs">
                          {member.tasks_overdue > 0 ? (
                            <span className="font-medium text-destructive">
                              {member.tasks_overdue}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">0</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center text-xs">
                          {days === null ? (
                            <span className="text-muted-foreground/50">—</span>
                          ) : (
                            <span
                              className={
                                days > 3
                                  ? "font-medium text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                              }
                            >
                              {daysSinceLabel(days)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-10 rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">Инсайты по текущему срезу</h3>
          </div>
          {insights.length === 0 ? (
            <EmptyPanel
              title="Недостаточно сигналов"
              description="Когда накопятся данные, здесь появятся управленческие подсказки."
            />
          ) : (
            <div className="space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.title}
                  className="rounded-xl border border-border/60 bg-background/40 p-3"
                >
                  <p className="text-sm font-heading font-semibold">{insight.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {insight.description}
                  </p>
                  <p className="mt-1.5 text-xs text-foreground/80">{insight.action}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="animate-fade-in-up stagger-10 rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">Инвентаризация блоков</h3>
          </div>
          <div className="space-y-3">
            {blockInventory.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <p className="text-sm font-heading font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                <p className="mt-1.5 text-xs text-foreground/80">{item.usage}</p>
                <p className="mt-1.5 text-xs text-primary/90">{item.extension}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
