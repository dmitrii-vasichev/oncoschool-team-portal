"use client";

import {
  Download as DownloadIcon,
  BrainCircuit,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AnalysisProgressProps {
  phase: "downloading" | "analyzing" | "completed" | "error" | null;
  progress: number;
  channel: string | null;
  chunk: number | null;
  totalChunks: number | null;
  error: string | null;
}

const PHASE_CONFIG = {
  downloading: {
    label: "Загрузка контента",
    icon: DownloadIcon,
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  analyzing: {
    label: "AI-анализ",
    icon: BrainCircuit,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  completed: {
    label: "Завершено",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  error: {
    label: "Ошибка",
    icon: AlertTriangle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

export function AnalysisProgress({
  phase,
  progress,
  channel,
  chunk,
  totalChunks,
  error,
}: AnalysisProgressProps) {
  if (!phase) return null;

  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
      {/* Phase header */}
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl ${config.bgColor} flex items-center justify-center`}
        >
          {phase === "downloading" || phase === "analyzing" ? (
            <Loader2 className={`h-5 w-5 ${config.color} animate-spin`} />
          ) : (
            <Icon className={`h-5 w-5 ${config.color}`} />
          )}
        </div>
        <div>
          <h3 className="font-medium text-sm">{config.label}</h3>
          {phase === "downloading" && channel && (
            <p className="text-xs text-muted-foreground">
              Канал: {channel}
            </p>
          )}
          {phase === "analyzing" && chunk && totalChunks && (
            <p className="text-xs text-muted-foreground">
              Чанк {chunk} из {totalChunks}
            </p>
          )}
          {phase === "analyzing" && totalChunks && totalChunks > 1 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Layers className="h-3 w-3" />
              Результаты будут синтезированы
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(phase === "downloading" || phase === "analyzing") && (
        <div className="space-y-1.5">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Error message */}
      {phase === "error" && error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
