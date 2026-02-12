"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@/lib/api";
import type { OverviewAnalytics, MemberStats, MeetingAnalytics } from "@/lib/types";
import {
  CheckSquare,
  ListTodo,
  Users,
  Calendar,
  AlertTriangle,
  TrendingUp,
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
  Legend,
} from "recharts";

const SOURCE_LABELS: Record<string, string> = {
  text: "Текст",
  voice: "Голос",
  summary: "Summary",
  web: "Веб",
};

const SOURCE_COLORS: Record<string, string> = {
  text: "#3b82f6",
  voice: "#8b5cf6",
  summary: "#f59e0b",
  web: "#10b981",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Новые",
  in_progress: "В работе",
  review: "Ревью",
  done: "Готово",
  cancelled: "Отменено",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#6366f1",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  done: "#10b981",
  cancelled: "#6b7280",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Срочный",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export default function AnalyticsPage() {
  const { user } = useCurrentUser();
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null);
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [meetingStats, setMeetingStats] = useState<MeetingAnalytics | null>(null);
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
        // handle error
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Prepare chart data
  const sourceData = overview?.tasks_by_source
    ? Object.entries(overview.tasks_by_source).map(([key, value]) => ({
        name: SOURCE_LABELS[key] || key,
        value,
        color: SOURCE_COLORS[key] || "#6b7280",
      }))
    : [];

  const statusData = overview
    ? [
        { name: STATUS_LABELS.new, value: overview.tasks_new, color: STATUS_COLORS.new },
        { name: STATUS_LABELS.in_progress, value: overview.tasks_in_progress, color: STATUS_COLORS.in_progress },
        { name: STATUS_LABELS.review, value: overview.tasks_review, color: STATUS_COLORS.review },
        { name: STATUS_LABELS.done, value: overview.tasks_done, color: STATUS_COLORS.done },
        { name: STATUS_LABELS.cancelled, value: overview.tasks_cancelled, color: STATUS_COLORS.cancelled },
      ].filter((d) => d.value > 0)
    : [];

  const priorityData = overview?.tasks_by_priority
    ? Object.entries(overview.tasks_by_priority).map(([key, value]) => ({
        name: PRIORITY_LABELS[key] || key,
        value,
        color: PRIORITY_COLORS[key] || "#6b7280",
      }))
    : [];

  const completionRate =
    overview && overview.total_tasks > 0
      ? Math.round((overview.tasks_done / overview.total_tasks) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего задач
            </CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.total_tasks ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              активных: {(overview?.total_tasks ?? 0) - (overview?.tasks_done ?? 0) - (overview?.tasks_cancelled ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Выполнено
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {overview?.tasks_done ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">{completionRate}% от всех</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Просрочено
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {overview?.tasks_overdue ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">требуют внимания</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Встречи
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meetingStats?.total_meetings ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              в этом месяце: {meetingStats?.meetings_this_month ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Task Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Задачи по статусам</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={statusData} layout="vertical">
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Задач" radius={[0, 4, 4, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет данных
              </p>
            )}
          </CardContent>
        </Card>

        {/* Source Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              По источникам
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Нет данных
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Priority Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">По приоритетам</CardTitle>
        </CardHeader>
        <CardContent>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priorityData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Задач" radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Нет данных
            </p>
          )}
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Участники
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Участник</th>
                  <th className="px-4 py-3 text-center font-medium">Всего</th>
                  <th className="px-4 py-3 text-center font-medium">Выполнено</th>
                  <th className="px-4 py-3 text-center font-medium">В работе</th>
                  <th className="px-4 py-3 text-center font-medium">Просрочено</th>
                  {isModerator && (
                    <th className="px-4 py-3 text-center font-medium">
                      Посл. апдейт
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m) => {
                  const days = daysSince(m.last_update);
                  const isInactive = days !== null && days > 3;
                  return (
                    <tr key={m.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={m.full_name} size="sm" />
                          <span className="font-medium">{m.full_name}</span>
                          <RoleBadge role={m.role} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{m.total_tasks}</td>
                      <td className="px-4 py-3 text-center text-green-600">
                        {m.tasks_done}
                      </td>
                      <td className="px-4 py-3 text-center">{m.tasks_in_progress}</td>
                      <td className="px-4 py-3 text-center">
                        {m.tasks_overdue > 0 ? (
                          <span className="text-destructive font-medium">
                            {m.tasks_overdue}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      {isModerator && (
                        <td className="px-4 py-3 text-center">
                          {m.last_update ? (
                            <span
                              className={
                                isInactive
                                  ? "text-destructive font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {days === 0
                                ? "сегодня"
                                : days === 1
                                  ? "вчера"
                                  : `${days} дн. назад`}
                              {isInactive && " \u26a0\ufe0f"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Meeting Stats (bottom card) */}
      {meetingStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Встречи и задачи
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-2xl font-bold">{meetingStats.total_meetings}</div>
                <p className="text-xs text-muted-foreground">Всего встреч</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{meetingStats.tasks_from_meetings}</div>
                <p className="text-xs text-muted-foreground">Задач из встреч</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{meetingStats.meetings_this_month}</div>
                <p className="text-xs text-muted-foreground">Встреч в этом месяце</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
