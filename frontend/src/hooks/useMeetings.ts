"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Meeting } from "@/lib/types";

export function useMeetings(params?: {
  upcoming?: boolean;
  past?: boolean;
  member_id?: string;
  department_id?: string;
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getMeetings(params);
      setMeetings(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params?.upcoming,
    params?.past,
    params?.member_id,
    params?.department_id,
  ]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { meetings, loading, error, refetch: fetch };
}
