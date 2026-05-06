"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plug,
  FileBarChart,
  Bot,
  Bell,
  Clock,
  Tags,
} from "lucide-react";
import { ModeratorGuard } from "@/components/shared/ModeratorGuard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PermissionService } from "@/lib/permissions";

import { AIFeatureConfigSection } from "@/components/settings/AIFeatureConfigSection";
import { GetCourseSection } from "@/components/settings/GetCourseSection";
import { ReportScheduleSection } from "@/components/settings/ReportScheduleSection";
import { TelegramConnectionSection } from "@/components/settings/TelegramConnectionSection";
import { ContentAccessSection } from "@/components/settings/ContentAccessSection";
import { TelegramTargetsSection } from "@/components/settings/TelegramTargetsSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { RemindersSection } from "@/components/settings/RemindersSection";
import { TaskLabelsSection } from "@/components/settings/TaskLabelsSection";

// ── Tab definitions ──

type TabId =
  | "integrations"
  | "reports"
  | "ai"
  | "notifications"
  | "reminders"
  | "task-labels";

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof Plug;
  adminOnly: boolean;
  /** requires canConfigureReminders instead of isAdmin */
  requireReminders?: boolean;
}

const TABS: TabDef[] = [
  { id: "integrations", label: "Интеграции", icon: Plug, adminOnly: true },
  { id: "reports", label: "Отчёты", icon: FileBarChart, adminOnly: true },
  { id: "ai", label: "AI", icon: Bot, adminOnly: true },
  { id: "notifications", label: "Уведомления", icon: Bell, adminOnly: false },
  { id: "reminders", label: "Напоминания", icon: Clock, adminOnly: false, requireReminders: true },
  { id: "task-labels", label: "Метки задач", icon: Tags, adminOnly: false },
];

// ── Page ──

export default function SettingsPage() {
  const { user } = useCurrentUser();
  const isAdmin = user ? PermissionService.isAdmin(user) : false;
  const canConfigureReminders = user
    ? PermissionService.canConfigureReminders(user)
    : false;

  const searchParams = useSearchParams();
  const router = useRouter();

  const visibleTabs = TABS.filter((tab) => {
    if (tab.requireReminders) return canConfigureReminders;
    if (tab.adminOnly) return isAdmin;
    return true;
  });

  const paramTab = searchParams.get("tab") as TabId | null;
  const defaultTab = visibleTabs[0]?.id ?? "notifications";
  const initialTab = paramTab && visibleTabs.some((t) => t.id === paramTab)
    ? paramTab
    : defaultTab;

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Sync URL when tab changes
  useEffect(() => {
    const currentParam = searchParams.get("tab");
    if (currentParam !== activeTab) {
      router.replace(`/settings?tab=${activeTab}`, { scroll: false });
    }
  }, [activeTab, searchParams, router]);

  // Ensure active tab is still visible if permissions change
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id ?? "notifications");
    }
  }, [visibleTabs, activeTab]);

  return (
    <ModeratorGuard>
      <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
        {/* ── Sidebar (desktop) / Horizontal tabs (mobile) ── */}
        <nav className="shrink-0 lg:w-52">
          {/* Mobile: horizontal scroll tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 lg:hidden">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Desktop: vertical sidebar */}
          <div className="hidden lg:flex lg:flex-col lg:gap-1 lg:sticky lg:top-6">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all text-left ${
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content area ── */}
        <div className="flex-1 min-w-0 max-w-3xl">
          <div className="space-y-6">
            <SettingsTabContent tab={activeTab} isAdmin={isAdmin} canConfigureReminders={canConfigureReminders} />
          </div>
        </div>
      </div>
    </ModeratorGuard>
  );
}

// ── Tab content renderer ──

function SettingsTabContent({
  tab,
  isAdmin,
  canConfigureReminders,
}: {
  tab: TabId;
  isAdmin: boolean;
  canConfigureReminders: boolean;
}) {
  switch (tab) {
    case "integrations":
      return (
        <>
          {isAdmin && <GetCourseSection />}
          {isAdmin && <TelegramConnectionSection />}
        </>
      );

    case "reports":
      return (
        <>
          {isAdmin && <ReportScheduleSection />}
          {isAdmin && <ContentAccessSection subSection="reports" />}
        </>
      );

    case "ai":
      return (
        <>
          {isAdmin && <AIFeatureConfigSection />}
          {isAdmin && <ContentAccessSection subSection="telegram_analysis" />}
        </>
      );

    case "notifications":
      return (
        <>
          <NotificationsSection />
          {isAdmin && <TelegramTargetsSection />}
        </>
      );

    case "reminders":
      return canConfigureReminders ? <RemindersSection /> : null;

    case "task-labels":
      return <TaskLabelsSection />;

    default:
      return null;
  }
}
