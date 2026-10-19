// A video's length as m:ss ("0:07", "12:30"); null without a duration.
export function formatDuration(ms: unknown): string | null {
  const n =
    typeof ms === "number"
      ? ms
      : typeof ms === "string" && ms.length > 0
        ? Number(ms)
        : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  const total = Math.round(n / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
