import { describe, expect, it } from "vitest";
import {
  CDN_LAG_TOLERANCE_MS,
  cdnLagMs,
  compare,
  resolvePublishedState,
  type ResolveInput,
  type SampledAt,
} from "./publishedState";
import type {
  Event,
  LiveObject,
  LiveState,
  SnapshotInfo,
} from "../api/types";

const NOW = "2026-12-22T01:31:07.412Z";
const NOW_MS = Date.parse(NOW);
// Both samples taken half a second after the stamps, on a browser clock
// that runs 40 s ahead of the servers (the offset must cancel).
const SKEW_MS = 40_000;
const sampled: SampledAt = { cdn: NOW_MS + SKEW_MS + 500, api: NOW_MS + SKEW_MS + 500 };
const iso = (ms: number) => new Date(ms).toISOString();

const baseSnap: SnapshotInfo = {
  version: 42,
  url: "https://cdn.test/snapshots/abc.json",
  s3Key: "snapshots/abc.json",
  builtAt: NOW,
};

const baseCurrent: Event = {
  id: 7,
  year: 2026,
  name: "Santa Flyover 2026",
  statusId: 3,
  isCurrent: true,
  scheduledAt: NOW,
  wentLiveAt: NOW,
  endedAt: null,
  fundsPercent: 63,
  routeId: 4,
  routeUrl: null,
  createdBy: "a@b",
  createdAt: NOW,
  updatedAt: NOW,
};

const baseCdn: LiveObject = {
  schemaVersion: 1,
  eventId: 7,
  eventStatusId: 3,
  pollIntervalMs: 5000,
  snapshotUrl: baseSnap.url ?? "",
  cookieTally: {},
  seq: 100,
  lat: null,
  lng: null,
  speedMps: null,
  altitudeM: null,
  headingDeg: null,
  accuracyM: null,
  recordedAt: null,
  receivedAt: null,
  publishedAt: NOW,
};

const baseState: LiveState = {
  lastWriteAt: NOW,
  lastWriteSeq: 100,
  lastWriteVersion: 42,
  lastWriteError: null,
  lastWriteNode: "node-1",
  node: {
    instance: "instance-a",
    isLeader: true,
    leaderEvaluatedAt: NOW,
    cacheRefreshedAt: NOW,
    live: baseCdn,
  },
};

const okInput = (): ResolveInput => ({
  cdn: { ...baseCdn },
  cdnStatus: null,
  current: { ...baseCurrent },
  snapshot: { ...baseSnap },
  state: { ...baseState, node: { ...baseState.node } },
  sampledAt: { ...sampled },
  previousMismatched: false,
});

describe("compare", () => {
  it("returns no mismatches when everything agrees", () => {
    expect(compare(baseCdn, baseCurrent, baseSnap, baseState, sampled)).toEqual([]);
  });

  it("detects eventStatusId mismatch", () => {
    const cdn = { ...baseCdn, eventStatusId: 2 };
    const mm = compare(cdn, baseCurrent, baseSnap, baseState, sampled);
    expect(mm).toEqual([
      { field: "eventStatusId", cdn: 2, api: 3 },
    ]);
  });

  it("treats a missing current event as null on the API side", () => {
    const cdn = { ...baseCdn, eventStatusId: 3 };
    const mm = compare(cdn, null, baseSnap, baseState, sampled);
    expect(mm).toContainEqual({ field: "eventStatusId", cdn: 3, api: null });
  });

  it("detects snapshotUrl mismatch", () => {
    const cdn = { ...baseCdn, snapshotUrl: "https://cdn.test/snapshots/other.json" };
    const mm = compare(cdn, baseCurrent, baseSnap, baseState, sampled);
    expect(mm).toEqual([
      {
        field: "snapshotUrl",
        cdn: "https://cdn.test/snapshots/other.json",
        api: baseSnap.url,
      },
    ]);
  });

  it("ignores a seq difference while the CDN copy is as fresh as the row", () => {
    // The ingest node writes several times a second; the two polls
    // straddle a write and the CDN sample is the newer one.
    const cdn = { ...baseCdn, seq: 106, publishedAt: iso(NOW_MS + 1500) };
    const at = { cdn: sampled.cdn + 1500, api: sampled.api };
    expect(compare(cdn, baseCurrent, baseSnap, baseState, at)).toEqual([]);
  });

  it("ignores a lower seq while the CDN copy is within the propagation tolerance", () => {
    // The CDN sample came first and CloudFront served a copy up to a
    // second old; the row sample came after the next write.
    const cdn = { ...baseCdn, seq: 97, publishedAt: iso(NOW_MS - 1000) };
    const state = { ...baseState, lastWriteSeq: 103, lastWriteAt: iso(NOW_MS + 1000) };
    const at = { cdn: sampled.cdn, api: sampled.api + 1000 };
    expect(compare(cdn, baseCurrent, baseSnap, state, at)).toEqual([]);
  });

  it("detects a CDN copy older than the API's last write beyond the tolerance", () => {
    const stale = iso(NOW_MS - CDN_LAG_TOLERANCE_MS - 1);
    const cdn = { ...baseCdn, seq: 42, publishedAt: stale };
    const mm = compare(cdn, baseCurrent, baseSnap, baseState, sampled);
    expect(mm).toEqual([{ field: "publishedAt", cdn: stale, api: NOW }]);
  });

  it("detects a stale copy even when seq did not move (rewrite without a fix)", () => {
    const stale = iso(NOW_MS - 20_000);
    const cdn = { ...baseCdn, publishedAt: stale };
    const mm = compare(cdn, baseCurrent, baseSnap, baseState, sampled);
    expect(mm).toEqual([{ field: "publishedAt", cdn: stale, api: NOW }]);
  });

  it("has nothing to compare when the row has never recorded a write", () => {
    const state = { ...baseState, lastWriteAt: null, lastWriteSeq: null };
    const cdn = { ...baseCdn, publishedAt: iso(NOW_MS - 60_000) };
    expect(compare(cdn, baseCurrent, baseSnap, state, sampled)).toEqual([]);
  });

  it("flags a CDN object without a parsable publishedAt", () => {
    const cdn = { ...baseCdn, publishedAt: "not-a-stamp" };
    const mm = compare(cdn, baseCurrent, baseSnap, baseState, sampled);
    expect(mm).toEqual([{ field: "publishedAt", cdn: "not-a-stamp", api: NOW }]);
  });
});

describe("cdnLagMs", () => {
  it("cancels the browser clock offset and the sample skew", () => {
    // CDN sampled 4 s after the API sample, on a clock 40 s ahead; the
    // CDN copy is the one written 4 s after the row's write. Lag is 0.
    const cdn = { ...baseCdn, publishedAt: iso(NOW_MS + 4000) };
    const at = { cdn: sampled.cdn + 4000, api: sampled.api };
    expect(cdnLagMs(cdn, baseState, at)).toBe(0);
  });

  it("measures how much older the CDN copy is than the row's last write", () => {
    const cdn = { ...baseCdn, publishedAt: iso(NOW_MS - 2500) };
    expect(cdnLagMs(cdn, baseState, sampled)).toBe(2500);
  });
});

describe("resolvePublishedState", () => {
  it("returns ok on a clean poll", () => {
    const r = resolvePublishedState(okInput());
    expect(r.state).toEqual({ kind: "ok" });
    expect(r.mismatchedNow).toBe(false);
  });

  it("keeps a single mismatched poll on ok", () => {
    const input = okInput();
    input.cdn = { ...baseCdn, seq: 42, publishedAt: iso(NOW_MS - 10_000) };
    const r = resolvePublishedState(input);
    expect(r.state.kind).toBe("ok");
    expect(r.mismatchedNow).toBe(true);
  });

  it("shows behind only after two mismatched polls in a row", () => {
    const input = okInput();
    const stale = iso(NOW_MS - 10_000);
    input.cdn = { ...baseCdn, seq: 42, publishedAt: stale };
    input.previousMismatched = true;
    const r = resolvePublishedState(input);
    expect(r.state.kind).toBe("behind");
    if (r.state.kind === "behind") {
      expect(r.state.mismatches).toEqual([
        { field: "publishedAt", cdn: stale, api: NOW },
      ]);
    }
    expect(r.mismatchedNow).toBe(true);
  });

  it("resets the flag on a clean poll after a mismatched one", () => {
    const input = okInput();
    input.previousMismatched = true;
    const r = resolvePublishedState(input);
    expect(r.state.kind).toBe("ok");
    expect(r.mismatchedNow).toBe(false);
  });

  it("write_error takes precedence over mismatch", () => {
    const input = okInput();
    input.state = { ...baseState, lastWriteError: "s3 timeout" };
    input.cdn = { ...baseCdn, seq: 42, publishedAt: iso(NOW_MS - 10_000) };
    input.previousMismatched = true;
    const r = resolvePublishedState(input);
    expect(r.state).toEqual({ kind: "write_error", error: "s3 timeout" });
    expect(r.mismatchedNow).toBe(false);
  });

  it("renders cdn_unreachable when the CDN fetch failed", () => {
    const input = okInput();
    input.cdn = null;
    input.cdnStatus = 502;
    const r = resolvePublishedState(input);
    expect(r.state).toEqual({ kind: "cdn_unreachable", status: 502, error: null });
  });

  it("cdn_unreachable does not toggle the mismatched flag", () => {
    const input = okInput();
    input.cdn = null;
    input.cdnStatus = null;
    input.previousMismatched = true;
    const r = resolvePublishedState(input);
    expect(r.state.kind).toBe("cdn_unreachable");
    expect(r.mismatchedNow).toBe(true);
  });

  it("returns loading when snapshot or state is missing", () => {
    const input = okInput();
    input.snapshot = null;
    const r = resolvePublishedState(input);
    expect(r.state).toEqual({ kind: "loading" });
  });
});

describe("resolvePublishedState: first load", () => {
  it("renders loading, not unreachable, while the CDN query is still pending", () => {
    const input = okInput();
    input.cdn = null;
    input.cdnStatus = null;
    input.cdnPending = true;
    const r = resolvePublishedState(input);
    expect(r.state).toEqual({ kind: "loading" });
  });

  it("carries the fetch error text when the failure had no HTTP status", () => {
    const input = okInput();
    input.cdn = null;
    input.cdnStatus = null;
    input.cdnError = "Failed to fetch";
    const r = resolvePublishedState(input);
    expect(r.state).toEqual({ kind: "cdn_unreachable", status: null, error: "Failed to fetch" });
  });
});
