import { describe, expect, it } from "vitest";
import type { Beacon, Event } from "../api/types";
import * as f from "../test/msw/fixtures";
import {
  SCHEDULED_AT_PAST_REASON,
  healthyBeaconReason,
  statusDisabledReason,
} from "./statusGate";
import { formatStamp } from "./time";

const NOW = Date.parse("2026-10-22T12:00:00.000Z");

const planned: Event = {
  ...f.events[0]!,
  id: 9,
  name: "Santa Flyover 2027",
  statusId: 1,
  isCurrent: true,
  scheduledAt: "2026-12-22T01:00:00.000Z",
  wentLiveAt: null,
};
const beacon: Beacon = f.beacons[0]!;
const otherLive: Event = { ...f.events[1]!, id: 3, name: "Other", statusId: 3 };

describe("statusDisabledReason (admin.md 6.3)", () => {
  it("allows Scheduled when the time is still ahead", () => {
    expect(statusDisabledReason(2, planned, [planned], beacon, NOW)).toBeNull();
  });

  it("asks for a scheduled time when there is none", () => {
    expect(
      statusDisabledReason(2, { ...planned, scheduledAt: null }, [], beacon, NOW)
    ).toBe("Set a scheduled time first");
  });

  it("refuses Scheduled once the time has passed", () => {
    const past = { ...planned, scheduledAt: "2026-10-22T11:59:59.000Z" };
    expect(statusDisabledReason(2, past, [], beacon, NOW)).toBe(
      "The scheduled time has passed. Set a new one first"
    );
    expect(SCHEDULED_AT_PAST_REASON).toBe(
      "The scheduled time has passed. Set a new one first"
    );
  });

  it("refuses Scheduled when the time is exactly now", () => {
    const atNow = { ...planned, scheduledAt: new Date(NOW).toISOString() };
    expect(statusDisabledReason(2, atNow, [], beacon, NOW)).toBe(
      SCHEDULED_AT_PAST_REASON
    );
    expect(statusDisabledReason(2, atNow, [], beacon, NOW - 1)).toBeNull();
  });

  it("does not gate other targets on a past time", () => {
    const past = { ...planned, statusId: 2, scheduledAt: "2026-01-01T00:00:00Z" };
    for (const t of [1, 4, 5, 6] as const) {
      expect(statusDisabledReason(t, past, [], null, NOW)).toBeNull();
    }
  });

  it("Live needs the event current", () => {
    expect(
      statusDisabledReason(3, { ...planned, isCurrent: false }, [], beacon, NOW)
    ).toBe("Set this event current first");
  });

  it("Live is refused while another event is live, by name", () => {
    expect(
      statusDisabledReason(3, planned, [planned, otherLive], beacon, NOW)
    ).toBe("Other is live");
    expect(
      statusDisabledReason(
        3,
        planned,
        [{ ...otherLive, name: undefined } as unknown as Event],
        beacon,
        NOW
      )
    ).toBe("Another event is live");
  });

  it("Live needs a healthy active beacon", () => {
    expect(statusDisabledReason(3, planned, [planned], null, NOW)).toBe(
      "No healthy active beacon: none is active"
    );
    expect(statusDisabledReason(3, planned, [planned], beacon, NOW)).toBeNull();
  });
});

describe("healthyBeaconReason", () => {
  it("names every beacon problem", () => {
    expect(healthyBeaconReason(null)).toBe("none is active");
    expect(
      healthyBeaconReason({ ...beacon, revokedAt: "2026-10-01T00:00:00Z" })
    ).toBe("Helicopter phone is revoked");
    expect(
      healthyBeaconReason({ ...beacon, staleSince: "2026-10-01T00:00:00Z" })
    ).toBe(`Helicopter phone is stale since ${formatStamp("2026-10-01T00:00:00Z")}`);
    expect(healthyBeaconReason({ ...beacon, lastHeartbeatAt: null })).toBe(
      "Helicopter phone has never been heard from"
    );
    expect(healthyBeaconReason({ ...beacon, healthy: false })).toBe(
      "Helicopter phone is not healthy"
    );
    expect(healthyBeaconReason({ ...beacon, name: undefined })).toBeNull();
    expect(
      healthyBeaconReason({ ...beacon, name: undefined, healthy: false })
    ).toBe("the active beacon is not healthy");
    expect(healthyBeaconReason(beacon)).toBeNull();
  });
});
