"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  Eye,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import { AnalysisResult } from "./AnalysisResult";
import type { AnalysisRun } from "@/lib/types";
import {
  ANALYSIS_STATUS_LABELS,
} from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  preparing: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  downloading: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  analyzing: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

export function HistoryTab() {
  const { toastError } = useToast();
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewRun, setViewRun] = useState<AnalysisRun | null>(null);
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});
  const perPage = 10;

  // Load channel names for UUID → name resolution
  useEffect(() => {
    api.getChannels().then((channels) => {
      const map: Record<string, string> = {};
      for (const ch of channels) {
        map[ch.id] = ch.display_name;
      }
      setChannelNames(map);
    }).catch(() => {});
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAnalysisHistory({ page, per_page: perPage });
      setRuns(data.items);
      setTotal(data.total);
    } catch {
      toastError("Не удалось загрузить историю");
    } finally {
      setLoading(false);
    }
  }, [page, toastError]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.ceil(total / perPage);

  const handleView = async (run: AnalysisRun) => {
    if (run.result_markdown) {
      setViewRun(run);
      return;
    }
    // Fetch full result
    try {
      const full = await api.getAnalysisResult(run.id);
      setViewRun(full);
    } catch {
      toastError("Не удалось загрузить результат");
    }
  };

  const handleDownload = async (runId: string) => {
    try {
      const blob = await api.downloadAnalysisResult(runId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analysis-${runId.slice(0, 8)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Ошибка скачивания");
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">История анализов пуста</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Дата
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Каналы
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Период
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Статус
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Автор
                </th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {new Date(run.created_at).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(run.channels) &&
                        run.channels.map((ch: unknown, i: number) => {
                          const chStr = typeof ch === "string" ? ch : String(ch);
                          const name = channelNames[chStr] || chStr.slice(0, 8) + "…";
                          return (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-2xs"
                            >
                              {name}
                            </Badge>
                          );
                        })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {run.date_from} — {run.date_to}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <Badge
                        className={`text-xs ${STATUS_COLORS[run.status] || ""}`}
                      >
                        {ANALYSIS_STATUS_LABELS[run.status] || run.status}
                      </Badge>
                      {run.status === "failed" && run.error_message && (
                        <p className="text-2xs text-destructive/70 max-w-[200px] truncate" title={run.error_message}>
                          {run.error_message}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {run.run_by_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {run.status === "completed" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleView(run)}
                            title="Открыть"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDownload(run.id)}
                            title="Скачать"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Стр. {page} из {totalPages} ({total} записей)
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* View result dialog */}
      <Dialog
        open={!!viewRun}
        onOpenChange={(open) => !open && setViewRun(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Результат анализа от{" "}
              {viewRun &&
                new Date(viewRun.created_at).toLocaleDateString("ru-RU")}
            </DialogTitle>
          </DialogHeader>
          {viewRun?.result_markdown ? (
            <AnalysisResult
              markdown={viewRun.result_markdown}
              runId={viewRun.id}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Результат недоступен
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
