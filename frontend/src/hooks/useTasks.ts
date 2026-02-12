"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Task, PaginatedResponse } from "@/lib/types";

export function useTasks(params?: Record<string, string>) {
  const [data, setData] = useState<PaginatedResponse<Task> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = params ? JSON.stringify(params) : "";

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getTasks(params);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useTask(shortId: number | null) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (shortId === null) return;
    try {
      setLoading(true);
      setError(null);
      const result = await api.getTask(shortId);
      setTask(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [shortId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { task, loading, error, refetch: fetch };
}
