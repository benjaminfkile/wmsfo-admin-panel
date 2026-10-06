import type {
  Event,
  LiveObject,
  LiveState,
  SnapshotInfo,
} from "../api/types";

// Compare the CDN's live object against the API's snapshot and live
// state. The three fields checked are the ones the API is authoritative
// for; a difference means the CDN write is lagging or has failed
// (admin.md 5.1).
export type Mismatch = {
  field: "eventStatusId" | "snapshotUrl" | "publishedAt";
  cdn: unknown;
  api: unknown;
};

// When the CDN object and the live_state row were fetched, as the
// browser's clock (react-query's dataUpdatedAt). The two polls run on
// independent timers, so the samples can be seconds apart; the
// freshness rule below corrects for that.
export type SampledAt = { cdn: number; api: number };

// The CDN copy may legitimately trail the row's last write by the
// CloudFront s-maxage (1 s) plus the PUT-then-row-update ordering inside
// the writer. Anything older than this, after correcting for sample
// timing, is a copy the API did not just write.
export const CDN_LAG_TOLERANCE_MS = 3000;

export function compare(
  cdn: LiveObject,
  current: Event | null,
  snap: SnapshotInfo,
  state: LiveState,
  sampledAt: SampledAt
): Mismatch[] {
  const out: Mismatch[] = [];
  const apiStatus = current?.statusId ?? null;
  if (cdn.eventStatusId !== apiStatus) {
    out.push({ field: "eventStatusId", cdn: cdn.eventStatusId, api: apiStatus });
  }
  if (cdn.snapshotUrl !== snap.url) {
    out.push({ field: "snapshotUrl", cdn: cdn.snapshotUrl, api: snap.url });
  }
  if (cdnLagMs(cdn, state, sampledAt) > CDN_LAG_TOLERANCE_MS) {
    out.push({ field: "publishedAt", cdn: cdn.publishedAt, api: state.lastWriteAt });
  }
  return out;
}

// How much older the CDN copy is than the API's last write, in ms, with
// the sample instants factored out: the age of the CDN object at the
// moment it was fetched minus the age of the row's last write at the
// moment it was fetched. Both ages pair a server stamp with a browser
// instant, so the browser's clock offset cancels. Negative or small
// while the CDN serves what the API last wrote, however often it writes;
// grows without bound when the CDN serves a stale copy. 0 when the row
// has never recorded a write (nothing to be behind); Infinity when the
// CDN object carries no parsable publishedAt.
export function cdnLagMs(cdn: LiveObject, state: LiveState, sampledAt: SampledAt): number {
  if (state.lastWriteAt === null) return 0;
  const apiAt = Date.parse(state.lastWriteAt);
  if (Number.isNaN(apiAt)) return 0;
  const cdnAt = Date.parse(cdn.publishedAt);
  if (Number.isNaN(cdnAt)) return Number.POSITIVE_INFINITY;
  const cdnAge = sampledAt.cdn - cdnAt;
  const apiAge = sampledAt.api - apiAt;
  return cdnAge - apiAge;
}

export type PublishedState =
  | { kind: "loading" }
  | { kind: "cdn_unreachable"; status: number | null; error?: string | null }
  | { kind: "ok" }
  | { kind: "behind"; mismatches: Mismatch[] }
  | { kind: "write_error"; error: string };

export type ResolveInput = {
  // Current poll's fetch results. `cdn` is null when the CDN fetch
  // failed (with a status when the error was an HTTP one).
  cdn: LiveObject | null;
  cdnStatus: number | null;
  // True while the CDN query has never settled (first load): rendered as
  // loading, not as unreachable. A settled failure without an HTTP status
  // (network, CORS, a blocked host) carries the error text in `cdnError`.
  cdnPending?: boolean;
  cdnError?: string | null;
  current: Event | null;
  snapshot: SnapshotInfo | null;
  state: LiveState | null;
  // When `cdn` and `state` were fetched (browser clock).
  sampledAt: SampledAt;
  // Whether the previous poll produced a non-empty compare() result.
  previousMismatched: boolean;
};

export type Resolved = {
  state: PublishedState;
  // The next value of previousMismatched, to feed into the next poll.
  mismatchedNow: boolean;
};

// Resolve a poll into the display state and the flag to remember for
// the next poll. Rules from admin.md 5.1:
//   - CDN unreachable renders amber and does not count as a mismatch.
//   - lastWriteError renders red regardless of comparison.
//   - Two consecutive mismatched polls render "behind"; a single one
//     renders ok (an admin write lands on the CDN within a second of the
//     row, and the two polls may straddle it).
//   - A poll with no mismatch resets the flag.
export function resolvePublishedState(input: ResolveInput): Resolved {
  if (input.cdn === null) {
    if (input.cdnPending === true) {
      return { state: { kind: "loading" }, mismatchedNow: input.previousMismatched };
    }
    return {
      state: { kind: "cdn_unreachable", status: input.cdnStatus, error: input.cdnError ?? null },
      // A failed CDN fetch is not a mismatch and should not toggle the flag.
      mismatchedNow: input.previousMismatched,
    };
  }
  if (input.state === null || input.snapshot === null) {
    return { state: { kind: "loading" }, mismatchedNow: false };
  }
  if (input.state.lastWriteError !== null) {
    return {
      state: { kind: "write_error", error: input.state.lastWriteError },
      mismatchedNow: false,
    };
  }
  const mismatches = compare(input.cdn, input.current, input.snapshot, input.state, input.sampledAt);
  if (mismatches.length === 0) {
    return { state: { kind: "ok" }, mismatchedNow: false };
  }
  if (input.previousMismatched) {
    return { state: { kind: "behind", mismatches }, mismatchedNow: true };
  }
  return { state: { kind: "ok" }, mismatchedNow: true };
}
