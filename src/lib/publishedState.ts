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
  field: "eventStatusId" | "snapshotUrl" | "seq";
  cdn: unknown;
  api: unknown;
};

export function compare(
  cdn: LiveObject,
  current: Event | null,
  snap: SnapshotInfo,
  state: LiveState
): Mismatch[] {
  const out: Mismatch[] = [];
  const apiStatus = current?.statusId ?? null;
  if (cdn.eventStatusId !== apiStatus) {
    out.push({ field: "eventStatusId", cdn: cdn.eventStatusId, api: apiStatus });
  }
  if (cdn.snapshotUrl !== snap.url) {
    out.push({ field: "snapshotUrl", cdn: cdn.snapshotUrl, api: snap.url });
  }
  if (cdn.seq !== state.lastWriteSeq) {
    out.push({ field: "seq", cdn: cdn.seq, api: state.lastWriteSeq });
  }
  return out;
}

export type PublishedState =
  | { kind: "loading" }
  | { kind: "cdn_unreachable"; status: number | null }
  | { kind: "ok" }
  | { kind: "behind"; mismatches: Mismatch[] }
  | { kind: "write_error"; error: string };

export type ResolveInput = {
  // Current poll's fetch results. `cdn` is null when the CDN fetch
  // failed (with a status when the error was an HTTP one).
  cdn: LiveObject | null;
  cdnStatus: number | null;
  current: Event | null;
  snapshot: SnapshotInfo | null;
  state: LiveState | null;
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
//     renders ok (the CDN copy lags an ingest write by up to a second).
//   - A poll with no mismatch resets the flag.
export function resolvePublishedState(input: ResolveInput): Resolved {
  if (input.cdn === null) {
    return {
      state: { kind: "cdn_unreachable", status: input.cdnStatus },
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
  const mismatches = compare(input.cdn, input.current, input.snapshot, input.state);
  if (mismatches.length === 0) {
    return { state: { kind: "ok" }, mismatchedNow: false };
  }
  if (input.previousMismatched) {
    return { state: { kind: "behind", mismatches }, mismatchedNow: true };
  }
  return { state: { kind: "ok" }, mismatchedNow: true };
}
