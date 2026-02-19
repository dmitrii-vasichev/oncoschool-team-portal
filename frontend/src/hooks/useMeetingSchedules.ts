"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { MeetingSchedule } from "@/lib/types";

export function useMeetingSchedules() {
  const [schedules, setSchedules] = useState<MeetingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getMeetingSchedules();
      setSchedules(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { schedules, loading, error, refetch: fetch };
}
