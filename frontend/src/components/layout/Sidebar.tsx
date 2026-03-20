"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  BarChart3,
  FileBarChart,
  Users,
  Settings,
  Megaphone,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  GraduationCap,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useContentAccess } from "@/hooks/useContentAccess";
import type { ContentSubSection } from "@/lib/types";
import { PermissionService } from "@/lib/permissions";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

/* ------------------------------------------------
   Sidebar collapse context — shared with AppShell
   ------------------------------------------------ */
export const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}>({
  collapsed: false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setCollapsed: () => {},
  mobileOpen: false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setMobileOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

/* ------------------------------------------------
   Navigation items
   ------------------------------------------------ */
type SidebarSection = "dashboard" | "work" | "analytics" | "content" | "manage";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  moderatorOnly?: boolean;
  contentAccess?: boolean;
  contentSubSection?: ContentSubSection;
  section: SidebarSection;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "dashboard" },
  { href: "/tasks", label: "Задачи", icon: CheckSquare, section: "work" },
  { href: "/meetings", label: "Встречи", icon: CalendarDays, section: "work" },
  { href: "/analytics", label: "Статистика задач", icon: BarChart3, section: "analytics" },
  {
    href: "/reports",
    label: "Отчёты",
    icon: FileBarChart,
    contentAccess: true,
    contentSubSection: "reports",
    section: "analytics",
  },
  {
    href: "/content/telegram-analysis",
    label: "Telegram-анализ",
    icon: Search,
    contentAccess: true,
    contentSubSection: "telegram_analysis",
    section: "content",
  },
  { href: "/team", label: "Команда", icon: Users, moderatorOnly: true, section: "manage" },
  {
    href: "/broadcasts",
    label: "Рассылки",
    icon: Megaphone,
    moderatorOnly: true,
    section: "manage",
  },
  {
    href: "/settings",
    label: "Настройки",
    icon: Settings,
    moderatorOnly: true,
    section: "manage",
  },
];

const SECTION_LABELS: Partial<Record<SidebarSection, string>> = {
  work: "Операционное",
  analytics: "Аналитика",
  content: "Контент",
  manage: "Управление",
};

const SECTION_ORDER: SidebarSection[] = ["dashboard", "work", "analytics", "content", "manage"];

/* ------------------------------------------------
   Mobile trigger (hamburger)
   ------------------------------------------------ */
export function MobileMenuTrigger() {
  const { setMobileOpen } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden shrink-0"
      onClick={() => setMobileOpen(true)}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Меню</span>
    </Button>
  );
}

/* ------------------------------------------------
   Sidebar inner content (reused in desktop & mobile)
   ------------------------------------------------ */
function SidebarInner({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useCurrentUser();
  const { hasAccess: hasContentAccess } = useContentAccess();

  if (!user) return null;

  const isModerator = PermissionService.isModerator(user);

  const visibleItems = NAV_ITEMS.filter((i) => {
    if (i.moderatorOnly && !isModerator) return false;
    if (i.contentAccess && !hasContentAccess(i.contentSubSection ?? "telegram_analysis")) return false;
    return true;
  });

  const sections = SECTION_ORDER.map((key) => ({
    key,
    label: SECTION_LABELS[key],
    items: visibleItems.filter((i) => i.section === key),
  })).filter((s) => s.items.length > 0);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    const link = (
      <Link
        href={item.href}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {/* Left accent bar for active item */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />
        )}
        <item.icon
          className={cn(
            "shrink-0 h-[18px] w-[18px] transition-colors duration-200",
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        {!collapsed && (
          <span className="truncate">{item.label}</span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center gap-2.5 shrink-0 px-5",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <GraduationCap className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-heading font-bold text-[15px] leading-tight tracking-tight">
              Онкошкола
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
              Портал
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border/60 shrink-0" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        {sections.map((section, idx) => (
          <div key={section.key}>
            {/* Divider between sections (not before the first) */}
            {idx > 0 && (
              <div className={cn("my-3", collapsed ? "mx-2" : "mx-3")}>
                <div className="h-px bg-border/60" />
              </div>
            )}
            {/* Section label (dashboard has none; collapsed mode shows no labels) */}
            {section.label && !collapsed && (
              <div className="px-4 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                  {section.label}
                </span>
              </div>
            )}
            <nav className={cn("flex flex-col gap-1", collapsed ? "px-2" : "px-3")}>
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
          </div>
        ))}
      </ScrollArea>

      {/* Divider */}
      <div className="mx-4 h-px bg-border/60 shrink-0" />

      {/* User footer */}
      <div className={cn("p-3 shrink-0", collapsed && "flex flex-col items-center py-3 px-2")}>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                className="flex flex-col items-center gap-2 rounded-lg p-1.5 hover:bg-muted transition-colors"
              >
                <UserAvatar name={user.full_name} avatarUrl={user.avatar_url} size="default" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
              <p className="font-medium">{user.full_name}</p>
              <p className="text-xs opacity-70">Выйти</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3">
            <UserAvatar name={user.full_name} avatarUrl={user.avatar_url} size="default" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight">
                {user.full_name}
              </p>
              <div className="mt-0.5">
                <RoleBadge role={user.role} />
              </div>
            </div>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Выйти</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------
   Desktop sidebar
   ------------------------------------------------ */
function DesktopSidebar() {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen flex-col border-r bg-card/80 backdrop-blur-sm relative shrink-0",
        "transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <TooltipProvider>
        <SidebarInner collapsed={collapsed} />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "absolute -right-3 top-20 z-10",
            "flex h-6 w-6 items-center justify-center",
            "rounded-full border bg-card shadow-sm",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-all duration-200"
          )}
        >
          {collapsed ? (
            <ChevronsRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronsLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </TooltipProvider>
    </aside>
  );
}

/* ------------------------------------------------
   Mobile sidebar (Sheet / Drawer)
   ------------------------------------------------ */
function MobileSidebar() {
  const { mobileOpen, setMobileOpen } = useSidebar();

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetTitle className="sr-only">Навигация</SheetTitle>
        <TooltipProvider>
          <div onClick={() => setMobileOpen(false)}>
            <SidebarInner collapsed={false} />
          </div>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------
   Exported Sidebar component
   ------------------------------------------------ */
export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileSidebar />
    </>
  );
}
