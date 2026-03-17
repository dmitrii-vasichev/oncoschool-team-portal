"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/components/shared/Toast";

interface AnalysisResultProps {
  markdown: string;
  runId: string;
}

export function AnalysisResult({ markdown, runId }: AnalysisResultProps) {
  const { toastError } = useToast();

  const handleDownload = async () => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Результат анализа</h3>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" />
          Скачать .md
        </Button>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-6 prose prose-sm dark:prose-invert max-w-none overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
