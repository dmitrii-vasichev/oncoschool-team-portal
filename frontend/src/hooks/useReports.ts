"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { ReportSummary, DailyMetricWithDelta } from "@/lib/types";

export function useReports(days: number = 30) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [today, setToday] = useState<DailyMetricWithDelta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryData, todayData] = await Promise.allSettled([
        api.getReportSummary(days),
        api.getReportToday(),
      ]);
      setSummary(
        summaryData.status === "fulfilled" ? summaryData.value : null
      );
      setToday(
        todayData.status === "fulfilled" ? todayData.value : null
      );
      if (
        summaryData.status === "rejected" &&
        todayData.status === "rejected"
      ) {
        setError("Не удалось загрузить данные отчётов");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { summary, today, loading, error, refetch: fetch };
}
