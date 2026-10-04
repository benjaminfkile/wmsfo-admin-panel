import { describe, expect, it } from "vitest";
import type { StatusHistory } from "../../api/types";
import type { EventMessage } from "../../api/types";
import {
  HISTORY_POLL_MS,
  HISTORY_POLL_WINDOW_MS,
  historyPollInterval,
} from "./historyPolling";

const NOW = Date.parse("2026-12-22T02:00:00.000Z");

function row(over: Partial<StatusHistory>): StatusHistory {
  return {
    id: 1,
    eventId: 7,
    fromStatusId: 2,
    toStatusId: 3,
    changedBy: "admin@example.com",
    changedAt: new Date(NOW - 5_000).toISOString(),
    notify: true,
    message: null,
    sentCount: 0,
    ...over,
  } as StatusHistory;
}

describe("historyPollInterval (admin.md 6.3)", () => {
  it("polls while a fresh notified row is below the verified count", () => {
    expect(historyPollInterval([row({ sentCount: 12 })], 800, NOW)).toBe(
      HISTORY_POLL_MS
    );
  });

  it("polls for the window when the verified count is unknown", () => {
    expect(historyPollInterval([row({ sentCount: 900 })], undefined, NOW)).toBe(
      HISTORY_POLL_MS
    );
  });

  it("stops once the sent count reaches the verified count", () => {
    expect(historyPollInterval([row({ sentCount: 800 })], 800, NOW)).toBe(
      false
    );
    expect(historyPollInterval([row({ sentCount: "800" })], 800, NOW)).toBe(
      false
    );
  });

  it("does not poll for a row older than ten minutes", () => {
    const old = row({
      changedAt: new Date(NOW - HISTORY_POLL_WINDOW_MS - 1_000).toISOString(),
    });
    expect(historyPollInterval([old], 800, NOW)).toBe(false);
    expect(historyPollInterval([old], undefined, NOW)).toBe(false);
  });

  it("does not poll when the newest row has notify false", () => {
    expect(historyPollInterval([row({ notify: false })], 800, NOW)).toBe(false);
  });

  it("reads the newest row by changedAt, whatever the order", () => {
    const older = row({
      id: 1,
      changedAt: new Date(NOW - 60_000).toISOString(),
      notify: true,
    });
    const newer = row({ id: 2, notify: false });
    expect(historyPollInterval([older, newer], 800, NOW)).toBe(false);
  });

  it("does not poll an empty history", () => {
    expect(historyPollInterval([], 800, NOW)).toBe(false);
  });
});

function msg(over: Partial<EventMessage>): EventMessage {
  return {
    id: 12,
    eventId: 7,
    body: "Santa is airborne.",
    createdBy: "admin@example.com",
    createdAt: new Date(NOW - 5_000).toISOString(),
    updatedAt: new Date(NOW - 5_000).toISOString(),
    notify: true,
    sentCount: 0,
    audit: null,
    ...over,
  } as EventMessage;
}

function asRows(items: EventMessage[]) {
  return items.map((m) => ({
    notify: m.notify,
    changedAt: m.createdAt,
    sentCount: m.sentCount,
  }));
}

describe("historyPollInterval over event messages (admin.md 6.3)", () => {
  it("polls every 3 s while a fresh notified message is below the verified count", () => {
    expect(historyPollInterval(asRows([msg({ sentCount: 3 })]), 812, NOW)).toBe(
      3000
    );
  });

  it("stops once the sent count reaches the verified count", () => {
    expect(
      historyPollInterval(asRows([msg({ sentCount: 812 })]), 812, NOW)
    ).toBe(false);
  });

  it("does not poll for a message older than ten minutes", () => {
    const old = msg({
      createdAt: new Date(NOW - HISTORY_POLL_WINDOW_MS - 1_000).toISOString(),
    });
    expect(historyPollInterval(asRows([old]), 812, NOW)).toBe(false);
  });

  it("does not poll when the newest message was posted without notify", () => {
    const older = msg({ id: 1, createdAt: new Date(NOW - 60_000).toISOString() });
    const newer = msg({ id: 2, notify: false });
    expect(historyPollInterval(asRows([older, newer]), 812, NOW)).toBe(false);
  });
});
