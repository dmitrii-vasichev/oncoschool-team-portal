"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useIsTruncated<T extends HTMLElement>(watchValue: unknown) {
  const ref = useRef<T | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkOverflow = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    const overflowX = element.scrollWidth - element.clientWidth > 1;
    const overflowY = element.scrollHeight - element.clientHeight > 1;
    setIsTruncated(overflowX || overflowY);
  }, []);

  useEffect(() => {
    checkOverflow();
    const frameId = window.requestAnimationFrame(checkOverflow);
    return () => window.cancelAnimationFrame(frameId);
  }, [checkOverflow, watchValue]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      checkOverflow();
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [checkOverflow]);

  return { ref, isTruncated };
}
