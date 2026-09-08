import { useEffect, useState } from "react";

// One-second ticker used for "N s ago" displays without triggering a
// fetch (admin.md 5.2). Returns the current epoch in milliseconds.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
