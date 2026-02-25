"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { InAppNotification } from "@/lib/types";

interface FetchOptions {
  silent?: boolean;
}

function normalizeNotifications(rawItems: unknown): InAppNotification[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.filter(
    (item): item is InAppNotification => !!item && typeof item === "object"
  );
}

export function useNotifications(limit = 30) {
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (options?: FetchOptions) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await api.getNotifications({ limit });
      const normalizedItems = normalizeNotifications(data?.items);
      const normalizedUnreadCount =
        typeof data?.unread_count === "number" && Number.isFinite(data.unread_count)
          ? Math.max(0, Math.floor(data.unread_count))
          : normalizedItems.reduce((acc, item) => acc + (item.is_read ? 0 : 1), 0);
      setItems(normalizedItems);
      setUnreadCount(normalizedUnreadCount);
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки уведомлений");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [limit]);

  const markRead = useCallback(async (notificationId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === notificationId && !item.is_read
          ? { ...item, is_read: true, read_at: new Date().toISOString() }
          : item
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.markNotificationRead(notificationId);
    } catch {
      await fetchNotifications({ silent: true });
    }
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    const unreadNow = items.reduce((acc, item) => acc + (item.is_read ? 0 : 1), 0);
    if (!unreadNow) return;

    setItems((prev) =>
      prev.map((item) =>
        item.is_read ? item : { ...item, is_read: true, read_at: new Date().toISOString() }
      )
    );
    setUnreadCount(0);

    try {
      await api.markAllNotificationsRead();
    } catch {
      await fetchNotifications({ silent: true });
    }
  }, [fetchNotifications, items]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications({ silent: true });
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    items,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
    markRead,
    markAllRead,
  };
}
