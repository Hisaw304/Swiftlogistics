// hooks/usePolitePolling.js
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * usePolitePolling(fetchFn, opts)
 * - fetchFn: async function that fetches data (should return value or throw)
 * - opts:
 *    - interval: nominal poll interval in ms (default 15000)
 *    - immediate: boolean — run fetch immediately on mount (default true)
 *    - pausedWhenHidden: boolean — pause when tab hidden (default true)
 */
export default function usePolitePolling(fetchFn, opts = {}) {
  const {
    interval = 15000,
    immediate = true,
    pausedWhenHidden = true,
    maxBackoff = 5 * 60 * 1000, // 5 min
  } = opts;

  const backoffRef = useRef(interval);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const nextRunRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [count, setCount] = useState(0);

  const doFetch = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFn(...args);
        if (!mountedRef.current) return null;
        setData(result);
        setCount((c) => c + 1);
        backoffRef.current = interval; // reset on success
        setLoading(false);
        return result;
      } catch (err) {
        if (!mountedRef.current) return null;
        setError(err);
        // increase backoff with jitter
        backoffRef.current = Math.min(
          maxBackoff,
          Math.floor(backoffRef.current * 1.8 + Math.random() * 1000)
        );
        setLoading(false);
        return null;
      }
    },
    [fetchFn, interval, maxBackoff]
  );

  const scheduleNext = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    nextRunRef.current = Date.now() + backoffRef.current;
    timerRef.current = setTimeout(async () => {
      await doFetch();
      scheduleNext();
    }, backoffRef.current);
  }, [doFetch]);

  useEffect(() => {
    mountedRef.current = true;

    const handleVisibility = () => {
      if (document.hidden && pausedWhenHidden) {
        // pause
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      } else {
        // resume: reset backoff and fetch immediately
        backoffRef.current = interval;
        (async () => {
          await doFetch();
          scheduleNext();
        })();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    (async () => {
      if (immediate) await doFetch();
      scheduleNext();
    })();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [doFetch, scheduleNext, pausedWhenHidden, immediate, interval]);

  const refresh = useCallback(async () => {
    backoffRef.current = interval;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const r = await doFetch();
    scheduleNext();
    return r;
  }, [doFetch, scheduleNext, interval]);

  return {
    loading,
    error,
    data,
    refresh,
    count,
    nextRunAt: nextRunRef.current,
  };
}
