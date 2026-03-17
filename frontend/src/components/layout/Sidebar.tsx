"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  BarChart3,
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
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  moderatorOnly?: boolean;
  contentAccess?: boolean;
  section: "main" | "content" | "manage";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/tasks", label: "Задачи", icon: CheckSquare, section: "main" },
  { href: "/meetings", label: "Встречи", icon: CalendarDays, section: "main" },
  { href: "/analytics", label: "Аналитика", icon: BarChart3, section: "main" },
  { href: "/team", label: "Команда", icon: Users, section: "main" },
  {
    href: "/content/telegram-analysis",
    label: "Telegram-анализ",
    icon: Search,
    contentAccess: true,
    section: "content",
  },
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

  const mainItems = NAV_ITEMS.filter(
    (i) => i.section === "main" && (!i.moderatorOnly || isModerator)
  );
  const contentItems = NAV_ITEMS.filter(
    (i) =>
      i.section === "content" &&
      (!i.contentAccess || hasContentAccess("telegram_analysis"))
  );
  const manageItems = NAV_ITEMS.filter(
    (i) => i.section === "manage" && (!i.moderatorOnly || isModerator)
  );

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
              Task Manager
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border/60 shrink-0" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className={cn("flex flex-col gap-1", collapsed ? "px-2" : "px-3")}>
          {mainItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Content section */}
        {contentItems.length > 0 && (
          <>
            <div className={cn("my-3", collapsed ? "mx-2" : "mx-3")}>
              <div className="h-px bg-border/60" />
            </div>
            {!collapsed && (
              <div className="px-4 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                  Контент
                </span>
              </div>
            )}
            <nav
              className={cn(
                "flex flex-col gap-1",
                collapsed ? "px-2" : "px-3"
              )}
            >
              {contentItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
          </>
        )}

        {/* Moderator section */}
        {manageItems.length > 0 && (
          <>
            <div className={cn("my-3", collapsed ? "mx-2" : "mx-3")}>
              <div className="h-px bg-border/60" />
            </div>
            {!collapsed && (
              <div className="px-4 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                  Управление
                </span>
              </div>
            )}
            <nav
              className={cn(
                "flex flex-col gap-1",
                collapsed ? "px-2" : "px-3"
              )}
            >
              {manageItems.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
          </>
        )}
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
