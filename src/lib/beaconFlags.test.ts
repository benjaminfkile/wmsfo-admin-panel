import { describe, expect, it } from "vitest";
import { beaconFlags } from "./beaconFlags";
import type { Beacon, Heartbeat, HeartbeatHealth } from "../api/types";
import { thresholds } from "./thresholds";

const NOW_ISO = "2026-12-22T01:31:07.000Z";
const NOW_MS = Date.parse(NOW_ISO);

function makeBeacon(overrides: Partial<Beacon> = {}): Beacon {
  return {
    id: 5,
    name: "b",
    notes: "",
    keyPrefix: "wbk_a",
    isActive: true,
    revokedAt: null,
    lastSeenAt: NOW_ISO,
    lastLocationAt: NOW_ISO,
    lastHeartbeatAt: NOW_ISO,
    staleSince: null,
    telemetry: null,
    hubConnected: true,
    healthy: true,
    createdBy: "a@b",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  } as Beacon;
}

function makeHeartbeat(health: HeartbeatHealth | null = {
  batteryPercent: 90,
  lastFixAgeS: 1,
  socketState: "connected",
}, debug: Record<string, unknown> | null = null): Heartbeat {
  return { sentAt: NOW_ISO, health, debug };
}

describe("beaconFlags", () => {
  it("returns no flags for a healthy beacon", () => {
    const beacon = makeBeacon({ telemetry: makeHeartbeat() });
    expect(beaconFlags(beacon, 60, true, NOW_MS)).toEqual([]);
  });

  it("returns [] for a revoked beacon regardless of state", () => {
    const beacon = makeBeacon({
      revokedAt: NOW_ISO,
      telemetry: makeHeartbeat({
        batteryPercent: 1,
        lastFixAgeS: 999,
        socketState: "disconnected",
      }),
      hubConnected: false,
      staleSince: NOW_ISO,
      lastHeartbeatAt: "2020-01-01T00:00:00.000Z",
    });
    expect(beaconFlags(beacon, 60, true, NOW_MS)).toEqual([]);
  });

  it("flags battery_low when batteryPercent < threshold and not below when >=", () => {
    const low = makeBeacon({
      telemetry: makeHeartbeat({
        batteryPercent: thresholds.batteryLowPercent - 1,
        lastFixAgeS: 1,
        socketState: "connected",
      }),
    });
    expect(beaconFlags(low, 60, false, NOW_MS)).toContain("battery_low");
    const at = makeBeacon({
      telemetry: makeHeartbeat({
        batteryPercent: thresholds.batteryLowPercent,
        lastFixAgeS: 1,
        socketState: "connected",
      }),
    });
    expect(beaconFlags(at, 60, false, NOW_MS)).not.toContain("battery_low");
  });

  it("flags no_recent_fix when lastFixAgeS exceeds noFixAgeS", () => {
    const b = makeBeacon({
      telemetry: makeHeartbeat({
        batteryPercent: 90,
        lastFixAgeS: thresholds.noFixAgeS + 1,
        socketState: "connected",
      }),
    });
    expect(beaconFlags(b, 60, false, NOW_MS)).toContain("no_recent_fix");
  });

  it("gates no_recent_fix on lastLocationAt only when anyEventLive is true", () => {
    const oldLocationIso = new Date(
      NOW_MS - (thresholds.noLocationAgeS + 5) * 1000
    ).toISOString();
    const withOldLoc = makeBeacon({
      lastLocationAt: oldLocationIso,
      telemetry: makeHeartbeat(),
    });
    expect(beaconFlags(withOldLoc, 60, false, NOW_MS)).not.toContain(
      "no_recent_fix"
    );
    expect(beaconFlags(withOldLoc, 60, true, NOW_MS)).toContain(
      "no_recent_fix"
    );
  });

  it("does not flag a missing health leaf", () => {
    const b = makeBeacon({
      telemetry: makeHeartbeat({
        // no batteryPercent, no lastFixAgeS
        socketState: "connected",
      }),
    });
    const flags = beaconFlags(b, 60, false, NOW_MS);
    expect(flags).not.toContain("battery_low");
    expect(flags).not.toContain("no_recent_fix");
    expect(flags).not.toContain("socket_down");
  });

  it("never reads the debug object", () => {
    const alarmingDebug = {
      power: { batteryPercent: 1 },
      transport: { socketState: "disconnected" },
      gps: { lastFixAgeS: 9999 },
    };
    const b = makeBeacon({
      telemetry: makeHeartbeat(
        { batteryPercent: 90, lastFixAgeS: 1, socketState: "connected" },
        alarmingDebug
      ),
    });
    expect(beaconFlags(b, 60, false, NOW_MS)).toEqual([]);
  });

  it("flags socket_down when hubConnected is false", () => {
    const b = makeBeacon({
      hubConnected: false,
      telemetry: makeHeartbeat(),
    });
    expect(beaconFlags(b, 60, false, NOW_MS)).toContain("socket_down");
  });

  it("flags socket_down from socketState when hubConnected is null", () => {
    const b = makeBeacon({
      hubConnected: null,
      telemetry: makeHeartbeat({
        batteryPercent: 90,
        lastFixAgeS: 1,
        socketState: "reconnecting",
      }),
    });
    expect(beaconFlags(b, 60, false, NOW_MS)).toContain("socket_down");
  });

  it("does not flag socket_down when hubConnected true and socket connected", () => {
    const b = makeBeacon({
      hubConnected: true,
      telemetry: makeHeartbeat(),
    });
    expect(beaconFlags(b, 60, false, NOW_MS)).not.toContain("socket_down");
  });

  it("flags stale when staleSince is set", () => {
    const b = makeBeacon({ staleSince: NOW_ISO, telemetry: makeHeartbeat() });
    expect(beaconFlags(b, 60, false, NOW_MS)).toContain("stale");
  });

  it("flags heartbeat_old when lastHeartbeatAt age exceeds staleAfterS", () => {
    const staleAfterS = 30;
    const oldIso = new Date(NOW_MS - (staleAfterS + 5) * 1000).toISOString();
    const b = makeBeacon({
      lastHeartbeatAt: oldIso,
      telemetry: makeHeartbeat(),
    });
    expect(beaconFlags(b, staleAfterS, false, NOW_MS)).toContain(
      "heartbeat_old"
    );
  });

  it("handles null telemetry without throwing and no telemetry-driven flags", () => {
    const b = makeBeacon({ telemetry: null });
    const flags = beaconFlags(b, 60, false, NOW_MS);
    expect(flags).not.toContain("battery_low");
    expect(flags).not.toContain("no_recent_fix");
    expect(flags).not.toContain("socket_down");
  });
});
