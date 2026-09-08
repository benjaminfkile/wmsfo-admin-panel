import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkRouteFile,
  MAX_ISSUES_SHOWN,
  ROUTE_MAX_BYTES,
  ROUTE_MAX_POINTS,
  ROUTE_MIN_POINTS,
} from "./routeFile";

const fixturePath = join(process.cwd(), "contracts/fixtures/route.json");
const fixtureText = readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText) as {
  schemaVersion: number;
  name: string;
  points: Array<{ lat: number; lng: number; recordedAt: string | null }>;
};

function encodeLen(text: string): number {
  return new TextEncoder().encode(text).length;
}

describe("checkRouteFile", () => {
  it("accepts the route fixture with schemaVersion removed", () => {
    const stripped = { name: fixture.name, points: fixture.points };
    const text = JSON.stringify(stripped);
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body.name).toBe(fixture.name);
      expect(r.body.points).toEqual(fixture.points);
      expect(r.summary.points).toBe(fixture.points.length);
      expect(r.summary.latMin).toBeCloseTo(46.8721);
      expect(r.summary.latMax).toBeCloseTo(46.873);
    }
  });

  it("rejects the raw fixture with schemaVersion as an unknown field", () => {
    const r = checkRouteFile(fixtureText, encodeLen(fixtureText));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toEqual(
        expect.arrayContaining([
          { path: "schemaVersion", message: "unknown field" },
        ])
      );
    }
  });

  it("rejects a single point", () => {
    const body = {
      name: "x",
      points: [
        { lat: 46.87, lng: -114, recordedAt: null },
      ],
    };
    const text = JSON.stringify(body);
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toEqual(
        expect.arrayContaining([
          {
            path: "points",
            message: `at least ${ROUTE_MIN_POINTS} points required`,
          },
        ])
      );
    }
  });

  it("rejects too many points", () => {
    const points = Array.from({ length: ROUTE_MAX_POINTS + 1 }, () => ({
      lat: 1,
      lng: 1,
      recordedAt: null,
    }));
    const body = { name: "x", points };
    const text = JSON.stringify(body);
    // Force pass the size check by lying about byteLength - we want the
    // point-count rule to fire specifically (the real 50,001-point JSON
    // is comfortably under 5 MB anyway).
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toEqual(
        expect.arrayContaining([
          {
            path: "points",
            message: `at most ${ROUTE_MAX_POINTS} points allowed`,
          },
        ])
      );
    }
  });

  it("rejects lat 91", () => {
    const body = {
      name: "x",
      points: [
        { lat: 91, lng: 0, recordedAt: null },
        { lat: 46.87, lng: -114, recordedAt: null },
      ],
    };
    const text = JSON.stringify(body);
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toEqual(
        expect.arrayContaining([
          {
            path: "points[0].lat",
            message: "must be between -90 and 90",
          },
        ])
      );
    }
  });

  it("rejects a missing recordedAt key", () => {
    const body = {
      name: "x",
      points: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4, recordedAt: null },
      ],
    };
    const text = JSON.stringify(body);
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toEqual(
        expect.arrayContaining([
          { path: "points[0].recordedAt", message: "required" },
        ])
      );
    }
  });

  it("rejects a bad RFC 3339 recordedAt", () => {
    const body = {
      name: "x",
      points: [
        { lat: 1, lng: 2, recordedAt: "not a date" },
        { lat: 3, lng: 4, recordedAt: null },
      ],
    };
    const text = JSON.stringify(body);
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toEqual(
        expect.arrayContaining([
          {
            path: "points[0].recordedAt",
            message: "not a valid RFC 3339 timestamp",
          },
        ])
      );
    }
  });

  it("rejects files over 5 MB with a single file issue", () => {
    const text = "{}";
    const r = checkRouteFile(text, ROUTE_MAX_BYTES + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toEqual([{ path: "file", message: "exceeds 5 MB" }]);
      expect(r.total).toBe(1);
    }
  });

  it("caps issues shown but keeps the total count", () => {
    const points = Array.from({ length: MAX_ISSUES_SHOWN + 5 }, () => ({
      lat: 91,
      lng: 0,
      recordedAt: null,
    }));
    const body = { name: "x", points };
    const text = JSON.stringify(body);
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.length).toBe(MAX_ISSUES_SHOWN);
      expect(r.total).toBe(MAX_ISSUES_SHOWN + 5);
    }
  });

  it("reports invalid JSON with the parser message", () => {
    const text = "{not json";
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues[0]?.path).toBe("file");
      expect(r.issues[0]?.message).toMatch(/^not valid JSON:/);
    }
  });

  it("reports missing name as required", () => {
    const text = JSON.stringify({ points: fixture.points });
    const r = checkRouteFile(text, encodeLen(text));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues).toEqual(
        expect.arrayContaining([{ path: "name", message: "required" }])
      );
    }
  });
});
