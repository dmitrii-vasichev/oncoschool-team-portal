"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface UsePullToRefreshResult {
  isRefreshing: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function usePullToRefresh(
  onRefresh: () => Promise<void>
): UsePullToRefreshResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pulling = useRef(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      if (el.scrollTop <= 0) {
        touchStartY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const onTouchMove = () => {
      if (!pulling.current || isRefreshing) return;
      // Re-check scrollTop — user may have scrolled
      if (el.scrollTop > 0) {
        pulling.current = false;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!pulling.current || isRefreshing) return;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchEndY - touchStartY.current;
      pulling.current = false;

      if (deltaY > 60 && el.scrollTop <= 0) {
        handleRefresh();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isRefreshing, handleRefresh]);

  return { isRefreshing, containerRef };
}
