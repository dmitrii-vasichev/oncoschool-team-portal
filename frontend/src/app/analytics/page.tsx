"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { useToast } from "@/components/shared/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import type {
  OverviewAnalytics,
  MemberStats,
  MeetingAnalytics,
} from "@/lib/types";
import {
  CheckCircle2,
  ListTodo,
  Users,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Zap,
  AlertOctagon,
  Trophy,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ────────────────────────────────────────────
// Design system chart colors (matching CSS vars)
// ────────────────────────────────────────────

const CHART_TEAL = "hsl(174, 62%, 26%)";
const CHART_CORAL = "hsl(16, 76%, 58%)";
const CHART_VIOLET = "hsl(262, 52%, 55%)";
const CHART_AMBER = "hsl(43, 82%, 58%)";
const CHART_BLUE = "hsl(200, 65%, 48%)";

const STATUS_CHART: Record<string, { label: string; color: string }> = {
  new: { label: "Новые", color: "hsl(210, 30%, 60%)" },
  in_progress: { label: "В работе", color: CHART_TEAL },
  review: { label: "Ревью", color: CHART_AMBER },
  done: { label: "Готово", color: "hsl(152, 55%, 38%)" },
  cancelled: { label: "Отменено", color: "hsl(210, 10%, 60%)" },
};

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

// ────────────────────────────────────────────
// Custom tooltip for recharts
// ────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.payload.color }}
        />
        {item.name}: <span className="font-bold">{item.value}</span>
      </p>
    </div>
  );
}

function ChartLegendItem({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor(
    (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function daysSinceLabel(days: number): string {
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} дн. назад`;
}

// ────────────────────────────────────────────
// Metric Card (reusing dashboard pattern)
// ────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accentColor,
  isPulsing,
  stagger,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  accentColor: string;
  isPulsing?: boolean;
  stagger: number;
}) {
  return (
    <div
      className={`animate-fade-in-up stagger-${stagger} group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5`}
    >
      {/* Top accent bar */}
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
            {isPulsing && value > 0 && (
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

// ────────────────────────────────────────────
// Skeleton loading
// ────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

// ────────────────────────────────────────────
// Main Analytics Page
// ────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user } = useCurrentUser();
  const { toastError } = useToast();
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [meetingStats, setMeetingStats] = useState<MeetingAnalytics | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const isModerator = user?.role === "moderator";

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewData, membersData, meetingsData] = await Promise.all([
          api.getOverview(),
          api.getMembersAnalytics(),
          api.getMeetingsAnalytics(),
        ]);
        setOverview(overviewData);
        setMembers(membersData.members);
        setMeetingStats(meetingsData);
      } catch {
        toastError("Не удалось загрузить аналитику");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <AnalyticsSkeleton />;

  // Prepare chart data
  const statusData = overview
    ? Object.entries(STATUS_CHART)
        .map(([key, config]) => {
          const countMap: Record<string, number> = {
            new: overview.tasks_new,
            in_progress: overview.tasks_in_progress,
            review: overview.tasks_review,
            done: overview.tasks_done,
            cancelled: overview.tasks_cancelled,
          };
          return {
            name: config.label,
            value: countMap[key] || 0,
            color: config.color,
          };
        })
        .filter((d) => d.value > 0)
    : [];

  const sourceData = overview?.tasks_by_source
    ? Object.entries(overview.tasks_by_source)
        .map(([key, value]) => ({
          name: SOURCE_CHART[key]?.label || key,
          value,
          color: SOURCE_CHART[key]?.color || "hsl(210, 10%, 60%)",
        }))
        .filter((d) => d.value > 0)
    : [];

  const priorityData = overview?.tasks_by_priority
    ? Object.entries(overview.tasks_by_priority)
        .map(([key, value]) => ({
          name: PRIORITY_CHART[key]?.label || key,
          value,
          color: PRIORITY_CHART[key]?.color || "hsl(210, 10%, 60%)",
        }))
        .filter((d) => d.value > 0)
    : [];

  const completionRate =
    overview && overview.total_tasks > 0
      ? Math.round((overview.tasks_done / overview.total_tasks) * 100)
      : 0;

  // Inactive members (>3 days without update)
  const inactiveMembers = members.filter((m) => {
    const days = daysSince(m.last_update);
    return days === null || days > 3;
  });

  // Members sorted by tasks_done desc (leaderboard)
  const sortedMembers = [...members].sort(
    (a, b) => b.tasks_done - a.tasks_done
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ═══════════ Metric Cards ═══════════ */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Всего задач"
          value={overview?.total_tasks ?? 0}
          subtitle={`Активных: ${(overview?.total_tasks ?? 0) - (overview?.tasks_done ?? 0) - (overview?.tasks_cancelled ?? 0)}`}
          icon={ListTodo}
          accentColor={CHART_TEAL}
          stagger={1}
        />
        <MetricCard
          label="Выполнено"
          value={overview?.tasks_done ?? 0}
          subtitle={`${completionRate}% от всех задач`}
          icon={CheckCircle2}
          accentColor="hsl(152, 55%, 28%)"
          stagger={2}
        />
        <MetricCard
          label="Просрочено"
          value={overview?.tasks_overdue ?? 0}
          subtitle="Требуют внимания"
          icon={AlertTriangle}
          accentColor="hsl(0, 72%, 51%)"
          isPulsing
          stagger={3}
        />
        <MetricCard
          label="Встречи"
          value={meetingStats?.total_meetings ?? 0}
          subtitle={`В этом месяце: ${meetingStats?.meetings_this_month ?? 0}`}
          icon={Calendar}
          accentColor={CHART_BLUE}
          stagger={4}
        />
      </section>

      {/* ═══════════ Charts Row ═══════════ */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* Status Pie Chart */}
        <div className="animate-fade-in-up stagger-5 rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-0">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">
              Задачи по статусам
            </h3>
          </div>
          <div className="p-5">
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
                  {statusData.map((d) => (
                    <ChartLegendItem
                      key={d.name}
                      color={d.color}
                      label={`${d.name}: ${d.value}`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>

        {/* Source Donut Chart */}
        <div className="animate-fade-in-up stagger-6 rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-0">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">
              По источникам
            </h3>
          </div>
          <div className="p-5">
            {sourceData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
                  {sourceData.map((d) => (
                    <ChartLegendItem
                      key={d.name}
                      color={d.color}
                      label={`${d.name}: ${d.value}`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart />
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ Priority Bar Chart ═══════════ */}
      <section className="animate-fade-in-up stagger-7 rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2 p-5 pb-0">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading font-semibold text-sm">
            По приоритетам
          </h3>
        </div>
        <div className="p-5">
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityData} barCategoryGap="25%">
                <XAxis
                  dataKey="name"
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
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Задач" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </section>

      {/* ═══════════ Moderator: Attention Block ═══════════ */}
      {isModerator && inactiveMembers.length > 0 && (
        <section className="animate-fade-in-up stagger-8 rounded-2xl border border-amber-500/30 bg-amber-500/[0.03] overflow-hidden">
          <div className="flex items-center gap-3 p-5 pb-0">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <AlertOctagon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm">
                Требуют внимания
              </h3>
              <p className="text-xs text-muted-foreground">
                Участники без обновлений более 3 дней
              </p>
            </div>
          </div>
          <div className="p-5 pt-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {inactiveMembers.map((m) => {
                const days = daysSince(m.last_update);
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-card"
                  >
                    <UserAvatar name={m.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.full_name}
                      </p>
                      <p className="text-2xs text-amber-600 dark:text-amber-400">
                        {days !== null
                          ? `Посл. апдейт: ${daysSinceLabel(days)}`
                          : "Нет обновлений"}
                      </p>
                    </div>
                    {m.tasks_in_progress > 0 && (
                      <span className="text-2xs text-muted-foreground">
                        {m.tasks_in_progress} в работе
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ Members Leaderboard ═══════════ */}
      <section className="animate-fade-in-up stagger-8 rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-3 p-5 pb-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-sm">
              Рейтинг участников
            </h3>
            <p className="text-xs text-muted-foreground">
              По количеству выполненных задач
            </p>
          </div>
        </div>

        <div className="p-5 pt-4">
          {sortedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                <Users className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Нет данных</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Участник
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Всего
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Выполнено
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      В работе
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Просрочено
                    </th>
                    {isModerator && (
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Посл. апдейт
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedMembers.map((m, i) => {
                    const days = daysSince(m.last_update);
                    const isInactive = days !== null && days > 3;
                    const rank = i + 1;
                    return (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="px-3 py-3">
                          <span
                            className={`
                            inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold
                            ${
                              rank === 1
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : rank === 2
                                  ? "bg-border/60 text-muted-foreground"
                                  : rank === 3
                                    ? "bg-orange-500/10 text-orange-500"
                                    : "text-muted-foreground/50"
                            }
                          `}
                          >
                            {rank}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={m.full_name} size="sm" />
                            <span className="font-medium text-sm truncate">
                              {m.full_name}
                            </span>
                            <RoleBadge role={m.role} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs">
                          {m.total_tasks}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-mono text-xs text-status-done-fg font-medium">
                            {m.tasks_done}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs">
                          {m.tasks_in_progress}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {m.tasks_overdue > 0 ? (
                            <span className="font-mono text-xs text-destructive font-medium">
                              {m.tasks_overdue}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground/40">
                              0
                            </span>
                          )}
                        </td>
                        {isModerator && (
                          <td className="px-3 py-3 text-center">
                            {m.last_update ? (
                              <span
                                className={`text-xs ${
                                  isInactive
                                    ? "text-amber-600 dark:text-amber-400 font-medium"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {daysSinceLabel(days!)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">
                                —
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ Meeting Stats ═══════════ */}
      {meetingStats && (
        <section className="animate-fade-in-up stagger-8 rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 p-5 pb-0">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-heading font-semibold text-sm">
              Встречи и задачи
            </h3>
          </div>
          <div className="p-5 pt-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="text-center p-4 rounded-xl bg-muted/30">
                <div className="text-2xl font-bold font-heading">
                  {meetingStats.total_meetings}
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  Всего встреч
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/30">
                <div className="text-2xl font-bold font-heading">
                  {meetingStats.tasks_from_meetings}
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  Задач из встреч
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/30">
                <div className="text-2xl font-bold font-heading">
                  {meetingStats.meetings_this_month}
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  В этом месяце
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-xl bg-muted/60 flex items-center justify-center mb-2">
        <TrendingUp className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-xs text-muted-foreground">Нет данных</p>
    </div>
  );
}
