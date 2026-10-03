import type { StatusHistory } from "../../api/types";

export const HISTORY_POLL_MS = 3000;
export const HISTORY_POLL_WINDOW_MS = 10 * 60 * 1000;

// The API's alert-send chore raises `sentCount` on the newest notifying row as
// the emails go out, so the history polls while that row is under ten minutes
// old and its count is below the verified subscriber count (for the whole ten
// minutes when the count is unknown).
export function historyPollInterval(
  items: StatusHistory[],
  verified: number | undefined,
  nowMs: number = Date.now()
): number | false {
  let newest: StatusHistory | undefined;
  let newestMs = -Infinity;
  for (const h of items) {
    const ms = h.changedAt ? Date.parse(h.changedAt) : NaN;
    if (Number.isFinite(ms) && ms > newestMs) {
      newest = h;
      newestMs = ms;
    }
  }
  if (!newest || newest.notify !== true) return false;
  if (nowMs - newestMs > HISTORY_POLL_WINDOW_MS) return false;
  const sent = Number(newest.sentCount ?? 0);
  if (verified !== undefined && sent >= verified) return false;
  return HISTORY_POLL_MS;
}
