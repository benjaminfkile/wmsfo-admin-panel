import { describe, expect, it } from "vitest";
import {
  compare,
  resolvePublishedState,
  type ResolveInput,
} from "./publishedState";
import type {
  Event,
  LiveObject,
  LiveState,
  SnapshotInfo,
} from "../api/types";

const NOW = "2026-12-22T01:31:07.412Z";

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
  previousMismatched: false,
});

describe("compare", () => {
  it("returns no mismatches when everything agrees", () => {
    expect(compare(baseCdn, baseCurrent, baseSnap, baseState)).toEqual([]);
  });

  it("detects eventStatusId mismatch", () => {
    const cdn = { ...baseCdn, eventStatusId: 2 };
    const mm = compare(cdn, baseCurrent, baseSnap, baseState);
    expect(mm).toEqual([
      { field: "eventStatusId", cdn: 2, api: 3 },
    ]);
  });

  it("treats a missing current event as null on the API side", () => {
    const cdn = { ...baseCdn, eventStatusId: 3 };
    const mm = compare(cdn, null, baseSnap, baseState);
    expect(mm).toContainEqual({ field: "eventStatusId", cdn: 3, api: null });
  });

  it("detects snapshotUrl mismatch", () => {
    const cdn = { ...baseCdn, snapshotUrl: "https://cdn.test/snapshots/other.json" };
    const mm = compare(cdn, baseCurrent, baseSnap, baseState);
    expect(mm).toEqual([
      {
        field: "snapshotUrl",
        cdn: "https://cdn.test/snapshots/other.json",
        api: baseSnap.url,
      },
    ]);
  });

  it("detects seq mismatch", () => {
    const cdn = { ...baseCdn, seq: 99 };
    const mm = compare(cdn, baseCurrent, baseSnap, baseState);
    expect(mm).toEqual([{ field: "seq", cdn: 99, api: 100 }]);
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
    input.cdn = { ...baseCdn, seq: 42 };
    const r = resolvePublishedState(input);
    expect(r.state.kind).toBe("ok");
    expect(r.mismatchedNow).toBe(true);
  });

  it("shows behind only after two mismatched polls in a row", () => {
    const input = okInput();
    input.cdn = { ...baseCdn, seq: 42 };
    input.previousMismatched = true;
    const r = resolvePublishedState(input);
    expect(r.state.kind).toBe("behind");
    if (r.state.kind === "behind") {
      expect(r.state.mismatches).toEqual([
        { field: "seq", cdn: 42, api: 100 },
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
    input.cdn = { ...baseCdn, seq: 42 };
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
