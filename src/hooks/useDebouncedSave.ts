import { useCallback, useEffect, useRef } from "react";

// Coalesce edits into one save (admin.md 6.14 autosave). Returns a
// `schedule(next)` and a `flush()` for immediate save on blur.
export function useDebouncedSave<T>(
  save: (value: T) => void,
  delayMs = 1000
): { schedule: (value: T) => void; flush: () => void; cancel: () => void } {
  const pendingRef = useRef<{ value: T } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const p = pendingRef.current;
    pendingRef.current = null;
    if (p !== null) saveRef.current(p.value);
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pendingRef.current = { value };
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const p = pendingRef.current;
        pendingRef.current = null;
        if (p !== null) saveRef.current(p.value);
      }, delayMs);
    },
    [delayMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return { schedule, flush, cancel };
}
