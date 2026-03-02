"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarCheck2,
  CalendarDays,
  BarChart3,
  CheckCheck,
  CheckSquare,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  MessageSquareWarning,
  Megaphone,
  RefreshCw,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNotifications } from "@/hooks/useNotifications";
import { usePageTitle } from "@/hooks/usePageTitle";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseUTCDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { MobileMenuTrigger } from "./Sidebar";

/* ------------------------------------------------
   Page config — titles and breadcrumbs
   ------------------------------------------------ */
interface PageMeta {
  title: string;
  icon: React.ElementType;
  parent?: string;
}

const PAGE_META: Record<string, PageMeta> = {
  "/": { title: "Dashboard", icon: LayoutDashboard },
  "/tasks": { title: "Задачи", icon: CheckSquare },
  "/meetings": { title: "Встречи", icon: CalendarDays },
  "/analytics": { title: "Аналитика", icon: BarChart3 },
  "/team": { title: "Команда", icon: Users },
  "/broadcasts": { title: "Рассылки", icon: Megaphone },
  "/settings": { title: "Настройки", icon: Settings },
};

function getPageMeta(
  pathname: string,
  pageTitle: string | null,
): PageMeta & { crumbs: { label: string; href?: string }[] } {
  // Check for detail pages like /tasks/42
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length >= 2) {
    const parentPath = `/${segments[0]}`;
    const parentMeta = PAGE_META[parentPath];
    if (parentMeta) {
      // For tasks, show #short_id; for meetings and others, use pageTitle from context
      const detailLabel =
        parentPath === "/tasks"
          ? `#${segments[1]}`
          : pageTitle || parentMeta.title;
      return {
        ...parentMeta,
        title: detailLabel,
        parent: parentPath,
        crumbs: [
          { label: parentMeta.title, href: parentPath },
          { label: detailLabel },
        ],
      };
    }
  }

  const meta = PAGE_META[pathname] || { title: "Онкошкола", icon: LayoutDashboard };
  return {
    ...meta,
    crumbs: [{ label: meta.title }],
  };
}

/* ------------------------------------------------
   Header
   ------------------------------------------------ */
export function Header() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const { pageTitle } = usePageTitle();
  const pageMeta = getPageMeta(pathname, pageTitle);

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b bg-card/60 backdrop-blur-sm px-4 md:px-6 shrink-0">
        {/* Left — Mobile menu + Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          <MobileMenuTrigger />

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 min-w-0">
            {pageMeta.crumbs.map((crumb, i) => (
              <div key={i} className="flex items-center gap-1 min-w-0">
                {i > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <h1 className="text-sm font-semibold truncate">
                    {crumb.label}
                  </h1>
                )}
              </div>
            ))}
          </nav>
        </div>

        {/* Right — Notifications, Avatar */}
        <div className="flex items-center gap-1">
          <NotificationBell />

          {/* User avatar */}
          {user && (
            <div className="ml-1">
              <UserAvatar name={user.full_name} avatarUrl={user.avatar_url} size="sm" />
            </div>
          )}
        </div>
      </header>
    </>
  );
}

type NotificationFilter = "all" | "unread";

const EVENT_META: Record<
  string,
  {
    icon: React.ElementType;
    label: string;
  }
> = {
  task_assigned: { icon: UserPlus, label: "Назначение" },
  task_blocker_added: { icon: MessageSquareWarning, label: "Блокер" },
  task_deadline_tomorrow: { icon: CalendarCheck2, label: "Дедлайн" },
  task_deadline_today: { icon: AlertTriangle, label: "Дедлайн" },
  task_overdue_started: { icon: AlertTriangle, label: "Просрочка" },
  task_status_changed_by_other: { icon: RefreshCw, label: "Статус" },
  task_review_requested: { icon: CheckSquare, label: "На согласовании" },
  task_created_unassigned: { icon: AlertTriangle, label: "Без исполнителя" },
  meeting_created: { icon: CalendarDays, label: "Встреча" },
};

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return "—";
  const date = parseUTCDate(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const { items, unreadCount, loading, error, refetch, markRead, markAllRead } =
    useNotifications(40);

  const visibleItems = useMemo(
    () => (filter === "unread" ? items.filter((item) => !item.is_read) : items),
    [items, filter]
  );

  const badgeValue = unreadCount > 99 ? "99+" : String(unreadCount);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      await refetch({ silent: true });
    }
  }

  async function handleItemClick(notification: (typeof items)[number]) {
    if (!notification.is_read) {
      await markRead(notification.id);
    }
    if (notification.action_url) {
      router.push(notification.action_url);
      setOpen(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {badgeValue}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[calc(100vw-1rem)] max-w-[360px] overflow-hidden p-0 sm:w-[360px]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">Уведомления</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} непрочитанных`
                : "Все уведомления прочитаны"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Прочитать все
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 border-b bg-muted/20 p-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium",
              filter === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Все
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium",
              filter === "unread"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Непрочитанные
          </button>
        </div>

        <ScrollArea className="max-h-[440px]">
          {loading ? (
            <div className="flex items-center justify-center p-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">Загрузка…</span>
            </div>
          ) : error ? (
            <div className="space-y-3 p-5">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => void refetch()}
              >
                Повторить
              </Button>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Нет уведомлений по выбранному фильтру
            </div>
          ) : (
            <div className="divide-y">
              {visibleItems.map((notification) => {
                const meta = EVENT_META[notification.event_type] || {
                  icon: Bell,
                  label: "Событие",
                };
                const Icon = meta.icon;
                return (
                  <button
                    key={notification.id}
                    onClick={() => void handleItemClick(notification)}
                    className={cn(
                      "w-full p-3 text-left transition-colors hover:bg-muted/40",
                      !notification.is_read && "bg-accent/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                          notification.priority === "high"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : "border-border bg-muted/30 text-muted-foreground"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-medium leading-tight text-foreground">
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                          )}
                        </div>
                        {notification.body && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {notification.body}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-2 text-2xs text-muted-foreground">
                          <span>{meta.label}</span>
                          <span>•</span>
                          <span>{formatRelativeDate(notification.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
