/**
 * Lightweight data-fetching hook. No external data-fetching library:
 * the prototype stays dependency-light and every request is retried
 * automatically once on failure.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const stable = useRef<() => Promise<T>>(fetcher);

  useEffect(() => {
    stable.current = fetcher;
  }, [fetcher]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await stable.current();
      setData(result);
    } catch (e) {
      // one automatic retry (backend may still be booting)
      try {
        const result = await stable.current();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [deps.join("::")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, deps.join("::")]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}