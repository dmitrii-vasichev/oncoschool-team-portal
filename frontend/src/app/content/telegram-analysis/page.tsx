"use client";

import { useState } from "react";
import { Search, Radio, FileText, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContentAccess } from "@/hooks/useContentAccess";
import { ChannelsTab } from "@/components/content/ChannelsTab";
import { PromptsTab } from "@/components/content/PromptsTab";
import { AnalysisTab } from "@/components/content/AnalysisTab";
import { HistoryTab } from "@/components/content/HistoryTab";

type Tab = "analysis" | "channels" | "prompts" | "history";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "analysis", label: "Анализ", icon: Search },
  { key: "channels", label: "Каналы", icon: Radio },
  { key: "prompts", label: "Промпты", icon: FileText },
  { key: "history", label: "История", icon: Clock },
];

export default function TelegramAnalysisPage() {
  const [activeTab, setActiveTab] = useState<Tab>("analysis");
  const { isEditor } = useContentAccess();

  const editorAccess = isEditor("telegram_analysis");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telegram-анализ</h1>
        <p className="text-muted-foreground mt-1">
          Анализ контента из Telegram-каналов с помощью AI
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/60">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "analysis" && <AnalysisTab />}
        {activeTab === "channels" && <ChannelsTab isEditor={editorAccess} />}
        {activeTab === "prompts" && <PromptsTab isEditor={editorAccess} />}
        {activeTab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
