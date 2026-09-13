import type { Beacon, Heartbeat } from "../api/types";
import { ageS } from "./time";
import { thresholds as defaultThresholds, type Thresholds } from "./thresholds";

// The flag set rendered on beacon rows and used to colour the
// telemetry page (admin.md 5.2). Read from the typed `health`
// leaves only; the beacon's `debug` object is never consulted.
export type BeaconFlag =
  | "battery_low"
  | "no_recent_fix"
  | "socket_down"
  | "stale"
  | "heartbeat_old";

export function beaconFlags(
  b: Beacon,
  staleAfterS: number,
  anyEventLive: boolean,
  nowMs: number,
  t: Thresholds = defaultThresholds
): BeaconFlag[] {
  if (b.revokedAt !== null && b.revokedAt !== undefined) return [];

  const flags: BeaconFlag[] = [];
  const tel = (b.telemetry as Heartbeat | null | undefined) ?? null;
  const h = tel?.health ?? null;

  const battery = h?.batteryPercent ?? null;
  if (battery !== null && battery < t.batteryLowPercent) {
    flags.push("battery_low");
  }

  const fixAge = h?.lastFixAgeS ?? null;
  const locAge = ageS(b.lastLocationAt ?? null, nowMs);
  const fixTooOld = fixAge !== null && fixAge > t.noFixAgeS;
  const locTooOld =
    anyEventLive && locAge !== null && locAge > t.noLocationAgeS;
  if (fixTooOld || locTooOld) flags.push("no_recent_fix");

  const socketState = h?.socketState ?? null;
  const hub = b.hubConnected ?? null;
  if (hub === false || (hub === null && socketState !== "connected")) {
    flags.push("socket_down");
  }

  if (b.staleSince !== null && b.staleSince !== undefined) {
    flags.push("stale");
  }

  const hbAge = ageS(b.lastHeartbeatAt ?? null, nowMs);
  if (hbAge !== null && hbAge > staleAfterS) flags.push("heartbeat_old");

  return flags;
}

// Human labels for the FlagChip UI.
export const FLAG_LABEL: Record<BeaconFlag, string> = {
  battery_low: "Battery low",
  no_recent_fix: "No recent fix",
  socket_down: "Socket down",
  stale: "Stale",
  heartbeat_old: "Heartbeat old",
};
