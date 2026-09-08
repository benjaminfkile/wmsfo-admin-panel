import { describe, expect, it } from "vitest";
import { beaconFlags } from "./beaconFlags";
import type { Beacon, Heartbeat } from "../api/types";
import { thresholds } from "./thresholds";

const NOW_ISO = "2026-12-22T01:31:07.000Z";
const NOW_MS = Date.parse(NOW_ISO);

function makeBeacon(overrides: Partial<Beacon> = {}): Beacon {
  return {
    id: 5,
    name: "b",
    notes: "",
    role: "beacon",
    keyPrefix: "wbk_a",
    isActive: true,
    revokedAt: null,
    lastSeenAt: NOW_ISO,
    lastLocationAt: NOW_ISO,
    lastHeartbeatAt: NOW_ISO,
    staleSince: null,
    telemetry: null,
    hubConnected: true,
    createdBy: "a@b",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  } as Beacon;
}

function makeHeartbeat(overrides: Partial<Heartbeat> = {}): Heartbeat {
  return {
    sentAt: NOW_ISO,
    power: {
      batteryPercent: 90,
      charging: true,
      batteryTempC: 30,
      thermalStatus: "none",
    },
    radio: {
      networkType: "LTE",
      signalDbm: -80,
      signalLevel: 4,
      airplaneMode: false,
      connected: true,
    },
    gps: {
      provider: "fused",
      satellitesUsed: 9,
      satellitesInView: 12,
      lastFixAccuracyM: 5,
      lastFixAgeS: 1,
      fixesLastMinute: 60,
      permission: { foreground: true, background: true, precise: true },
    },
    transport: {
      socketState: "connected",
      reconnectCount: 0,
      httpFallbackSeconds: 0,
      lastReceiptLatencyMs: 100,
      sendsFailedSinceBoot: 0,
    },
    process: {
      deviceUptimeS: 1000,
      serviceUptimeS: 500,
      serviceRestartCount: 0,
      memoryPressure: "normal",
      batteryOptimizationExempt: true,
      notificationPermission: true,
      systemApp: true,
      rootAvailable: false,
    },
    identity: {
      deviceModel: "Pixel",
      androidVersion: "14",
      appVersion: "1.0.0",
      clockSkewMs: 0,
    },
    ...overrides,
  };
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
        power: {
          batteryPercent: 1,
          charging: false,
          batteryTempC: 90,
          thermalStatus: "critical",
        },
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
        power: {
          batteryPercent: thresholds.batteryLowPercent - 1,
          charging: false,
          batteryTempC: 30,
          thermalStatus: "none",
        },
      }),
    });
    expect(beaconFlags(low, 60, false, NOW_MS)).toContain("battery_low");
    const at = makeBeacon({
      telemetry: makeHeartbeat({
        power: {
          batteryPercent: thresholds.batteryLowPercent,
          charging: false,
          batteryTempC: 30,
          thermalStatus: "none",
        },
      }),
    });
    expect(beaconFlags(at, 60, false, NOW_MS)).not.toContain("battery_low");
  });

  it("flags no_recent_fix when lastFixAgeS exceeds noFixAgeS", () => {
    const b = makeBeacon({
      telemetry: makeHeartbeat({
        gps: {
          provider: "fused",
          satellitesUsed: 0,
          satellitesInView: 0,
          lastFixAccuracyM: 100,
          lastFixAgeS: thresholds.noFixAgeS + 1,
          fixesLastMinute: 0,
          permission: { foreground: true, background: true, precise: true },
        },
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

  it("flags permission_missing when any permission is false", () => {
    for (const key of ["foreground", "background", "precise"] as const) {
      const perm = { foreground: true, background: true, precise: true };
      perm[key] = false;
      const b = makeBeacon({
        telemetry: makeHeartbeat({
          gps: {
            provider: null,
            satellitesUsed: null,
            satellitesInView: null,
            lastFixAccuracyM: null,
            lastFixAgeS: null,
            fixesLastMinute: null,
            permission: perm,
          },
        }),
      });
      expect(beaconFlags(b, 60, false, NOW_MS)).toContain("permission_missing");
    }
  });

  it("does not flag permission_missing when permission is null", () => {
    const b = makeBeacon({
      telemetry: makeHeartbeat({
        gps: {
          provider: null,
          satellitesUsed: null,
          satellitesInView: null,
          lastFixAccuracyM: null,
          lastFixAgeS: null,
          fixesLastMinute: null,
          permission: null,
        },
      }),
    });
    expect(beaconFlags(b, 60, false, NOW_MS)).not.toContain(
      "permission_missing"
    );
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
        transport: {
          socketState: "reconnecting",
          reconnectCount: 4,
          httpFallbackSeconds: 20,
          lastReceiptLatencyMs: 500,
          sendsFailedSinceBoot: 2,
        },
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
    expect(flags).not.toContain("permission_missing");
  });
});
