"use client";

import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  BarChart3,
  FileText,
  Users,
  Settings,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { MobileMenuTrigger } from "./Sidebar";
import { Button } from "@/components/ui/button";

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
  "/summary": { title: "Zoom Summary", icon: FileText },
  "/team": { title: "Команда", icon: Users },
  "/settings": { title: "Настройки", icon: Settings },
};

function getPageMeta(pathname: string): PageMeta & { crumbs: { label: string; href?: string }[] } {
  // Check for detail pages like /tasks/42
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length >= 2) {
    const parentPath = `/${segments[0]}`;
    const parentMeta = PAGE_META[parentPath];
    if (parentMeta) {
      return {
        ...parentMeta,
        title: `#${segments[1]}`,
        parent: parentPath,
        crumbs: [
          { label: parentMeta.title, href: parentPath },
          { label: `#${segments[1]}` },
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
  const pageMeta = getPageMeta(pathname);

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
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            {/* Badge — hidden for now, ready for real notifications */}
            {/* <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
              3
            </span> */}
          </Button>

          {/* User avatar */}
          {user && (
            <div className="ml-1">
              <UserAvatar name={user.full_name} size="sm" />
            </div>
          )}
        </div>
      </header>
    </>
  );
}
