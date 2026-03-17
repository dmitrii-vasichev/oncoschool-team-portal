"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { AnalysisProgressEvent } from "@/lib/types";

interface AnalysisStreamState {
  /** Current phase of the analysis */
  phase: AnalysisProgressEvent["phase"] | null;
  /** Download/analysis progress 0-100 */
  progress: number;
  /** Current channel being downloaded */
  channel: string | null;
  /** Current chunk / total chunks */
  chunk: number | null;
  totalChunks: number | null;
  /** Completed run ID */
  runId: string | null;
  /** Error message */
  error: string | null;
  /** Whether the stream is currently active */
  isRunning: boolean;
  /** Start streaming for a run ID */
  start: (runId: string) => void;
  /** Stop streaming */
  stop: () => void;
}

/**
 * Custom hook wrapping EventSource for analysis progress SSE.
 * Auto-cleanup on unmount.
 */
export function useAnalysisStream(): AnalysisStreamState {
  const [phase, setPhase] = useState<AnalysisProgressEvent["phase"] | null>(null);
  const [progress, setProgress] = useState(0);
  const [channel, setChannel] = useState<string | null>(null);
  const [chunk, setChunk] = useState<number | null>(null);
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const start = useCallback(
    (newRunId: string) => {
      // Clean up previous
      stop();

      // Reset state
      setPhase(null);
      setProgress(0);
      setChannel(null);
      setChunk(null);
      setTotalChunks(null);
      setRunId(newRunId);
      setError(null);
      setIsRunning(true);

      const es = api.streamAnalysisProgress(newRunId);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const data: AnalysisProgressEvent = JSON.parse(event.data);

          setPhase(data.phase);

          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          if (data.channel !== undefined) {
            setChannel(data.channel);
          }
          if (data.chunk !== undefined) {
            setChunk(data.chunk);
          }
          if (data.total_chunks !== undefined) {
            setTotalChunks(data.total_chunks);
          }
          if (data.run_id) {
            setRunId(data.run_id);
          }

          if (data.phase === "completed") {
            stop();
          }

          if (data.phase === "error") {
            setError(data.error || "Unknown error");
            stop();
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setError("Connection lost");
        stop();
      };
    },
    [stop]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  return {
    phase,
    progress,
    channel,
    chunk,
    totalChunks,
    runId,
    error,
    isRunning,
    start,
    stop,
  };
}
