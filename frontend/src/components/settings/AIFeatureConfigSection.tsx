"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Loader2,
  Save,
  Info,
  Sparkles,
  Zap,
  BrainCircuit,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { AISettingsResponse } from "@/lib/types";

const PROVIDER_META: Record<
  string,
  { label: string; icon: typeof Sparkles; color: string }
> = {
  anthropic: { label: "Anthropic", icon: BrainCircuit, color: "hsl(24, 70%, 50%)" },
  openai: { label: "OpenAI", icon: Sparkles, color: "hsl(152, 55%, 38%)" },
  gemini: { label: "Gemini", icon: Zap, color: "hsl(220, 65%, 55%)" },
};

interface FeatureRow {
  feature_key: string;
  display_name: string;
  provider: string;
  model: string;
  original_provider: string;
  original_model: string;
  saving: boolean;
}

/**
 * Per-feature AI configuration table.
 * Replaces the old 3-card provider selector with a table showing
 * Default, Meetings: Summary, Telegram Analysis rows.
 */
export function AIFeatureConfigSection() {
  const { toastSuccess, toastError } = useToast();
  const [rows, setRows] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSettings, setAiSettings] = useState<AISettingsResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [configs, settings] = await Promise.all([
        api.getAIFeatureConfigs(),
        api.getAiSettings(),
      ]);
      setAiSettings(settings);
      setRows(
        configs.map((c) => ({
          feature_key: c.feature_key,
          display_name: c.display_name,
          provider: c.provider || "",
          model: c.model || "",
          original_provider: c.provider || "",
          original_model: c.model || "",
          saving: false,
        }))
      );
    } catch {
      toastError("Не удалось загрузить конфигурацию AI");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableProviders = aiSettings?.available_providers || {};
  const providersConfig = aiSettings?.providers_config || {};

  const allProviders = Object.keys(PROVIDER_META);

  const modelsForProvider = (provider: string): string[] => {
    return providersConfig[provider]?.models || [];
  };

  const updateRow = (key: string, updates: Partial<FeatureRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.feature_key === key ? { ...r, ...updates } : r))
    );
  };

  const handleProviderChange = (key: string, provider: string) => {
    const models = modelsForProvider(provider);
    const defaultModel = providersConfig[provider]?.default || models[0] || "";
    updateRow(key, { provider, model: defaultModel });
  };

  const handleSave = async (row: FeatureRow) => {
    updateRow(row.feature_key, { saving: true });
    try {
      await api.updateAIFeatureConfig(row.feature_key, {
        provider: row.provider || null,
        model: row.model || null,
      });
      updateRow(row.feature_key, {
        saving: false,
        original_provider: row.provider,
        original_model: row.model,
      });
      toastSuccess(`${row.display_name}: настройки сохранены`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сохранения";
      toastError(msg);
      updateRow(row.feature_key, { saving: false });
    }
  };

  const handleReset = (key: string) => {
    updateRow(key, { provider: "", model: "" });
  };

  const hasChanges = (row: FeatureRow) =>
    row.provider !== row.original_provider || row.model !== row.original_model;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up stagger-1 rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-6 pb-0">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-heading font-semibold text-base">
            AI-модели по фичам
          </h2>
          <p className="text-xs text-muted-foreground">
            Настройте провайдера и модель для каждой функции отдельно
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Table */}
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Функция
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Провайдер
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    Модель
                  </th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isDefault = row.feature_key === "default";
                  const isInheriting =
                    !isDefault && !row.provider && !row.model;

                  return (
                    <tr
                      key={row.feature_key}
                      className={`border-b border-border/40 last:border-b-0 ${
                        isDefault ? "bg-primary/[0.03]" : ""
                      }`}
                    >
                      {/* Feature name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {row.display_name}
                          </span>
                          {isDefault && (
                            <Badge
                              variant="secondary"
                              className="text-2xs px-1.5 py-0"
                            >
                              fallback
                            </Badge>
                          )}
                          {isInheriting && (
                            <Badge
                              variant="outline"
                              className="text-2xs px-1.5 py-0 text-muted-foreground"
                            >
                              наследует
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Provider select */}
                      <td className="px-4 py-3">
                        <Select
                          value={row.provider || "__inherit__"}
                          onValueChange={(v) =>
                            v === "__inherit__"
                              ? handleReset(row.feature_key)
                              : handleProviderChange(row.feature_key, v)
                          }
                        >
                          <SelectTrigger className="h-9 rounded-lg w-[160px]">
                            <SelectValue placeholder="По умолчанию" />
                          </SelectTrigger>
                          <SelectContent>
                            {!isDefault && (
                              <SelectItem value="__inherit__">
                                <span className="text-muted-foreground">
                                  По умолчанию
                                </span>
                              </SelectItem>
                            )}
                            {allProviders.map((p) => {
                              const meta = PROVIDER_META[p];
                              const available = availableProviders[p];
                              return (
                                <SelectItem
                                  key={p}
                                  value={p}
                                  disabled={!available}
                                >
                                  <span className="flex items-center gap-2">
                                    <meta.icon
                                      className="h-3.5 w-3.5"
                                      style={{ color: meta.color }}
                                    />
                                    {meta.label}
                                    {!available && (
                                      <span className="text-muted-foreground text-xs">
                                        (нет ключа)
                                      </span>
                                    )}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Model select */}
                      <td className="px-4 py-3">
                        {row.provider ? (
                          <Select
                            value={row.model}
                            onValueChange={(v) =>
                              updateRow(row.feature_key, { model: v })
                            }
                          >
                            <SelectTrigger className="h-9 rounded-lg w-[200px]">
                              <SelectValue placeholder="Выберите модель" />
                            </SelectTrigger>
                            <SelectContent>
                              {modelsForProvider(row.provider).map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {!isDefault && row.provider && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleReset(row.feature_key)}
                              title="Сбросить (наследовать)"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {hasChanges(row) && (
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-xs"
                              disabled={row.saving}
                              onClick={() => handleSave(row)}
                            >
                              {row.saving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Whisper note */}
        <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/40 p-3.5 rounded-xl border border-border/40">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
          <span>
            Whisper (распознавание голоса) всегда использует OpenAI, независимо
            от выбранного провайдера. Функции без явной настройки наследуют
            значение из строки &quot;Default&quot;.
          </span>
        </div>
      </div>
    </div>
  );
}
