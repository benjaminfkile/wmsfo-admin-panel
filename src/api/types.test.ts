import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Heartbeat, LiveObject } from "./types";

const contractsDir = path.resolve(__dirname, "../../contracts/fixtures");

function load<T>(name: string): T {
  const raw = readFileSync(path.join(contractsDir, name), "utf8");
  return JSON.parse(raw) as T;
}

const LIVE_KEYS: (keyof LiveObject)[] = [
  "schemaVersion",
  "eventId",
  "eventStatusId",
  "pollIntervalMs",
  "snapshotUrl",
  "cookieTally",
  "seq",
  "lat",
  "lng",
  "speedMps",
  "altitudeM",
  "headingDeg",
  "accuracyM",
  "recordedAt",
  "receivedAt",
  "publishedAt",
];

const HEARTBEAT_TOP_KEYS: (keyof Heartbeat)[] = [
  "sentAt",
  "power",
  "radio",
  "gps",
  "transport",
  "process",
  "identity",
];

describe("LiveObject fixture", () => {
  const live = load<LiveObject>("live-object.json");

  it("satisfies the hand-declared LiveObject type", () => {
    // compile-time
    const check: LiveObject = live;
    expect(check.schemaVersion).toBe(1);
  });

  it("carries every documented key", () => {
    for (const k of LIVE_KEYS) {
      expect(Object.hasOwn(live, k)).toBe(true);
    }
  });

  it("has canonical timestamp shape (three fractional digits, Z)", () => {
    expect(live.publishedAt).toMatch(/\.\d{3}Z$/);
  });
});

describe("Snapshot fixture", () => {
  // The doc calls out a snapshot fixture check too; there is no exported
  // Snapshot type in this task, but the fixture must parse cleanly and
  // announce schemaVersion 1.
  const snap = load<{ schemaVersion: number }>("snapshot.json");

  it("declares schemaVersion 1", () => {
    expect(snap.schemaVersion).toBe(1);
  });
});

describe("Heartbeat fixture", () => {
  const hb = load<Heartbeat>("heartbeat.json");

  it("satisfies the hand-declared Heartbeat type", () => {
    const check: Heartbeat = hb;
    expect(typeof check.sentAt).toBe("string");
  });

  it("has every top-level key", () => {
    for (const k of HEARTBEAT_TOP_KEYS) {
      expect(Object.hasOwn(hb, k)).toBe(true);
    }
  });

  it("uses the documented socketState lookup", () => {
    expect(hb.transport?.socketState).toBe("connected");
  });
});
