"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { ActivityEvent } from "@/lib/types";

export function useActivity() {
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const fetch = useCallback(async () => {
    try {
      if (!initialized.current) setLoading(true);
      setError(null);
      const res = await api.getActivity({ limit: 100 });
      setItems(res.items);
      initialized.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { items, loading, error, refetch: fetch };
}
