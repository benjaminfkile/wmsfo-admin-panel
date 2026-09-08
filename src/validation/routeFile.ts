import type { RoutePoint, RouteUploadBody } from "../api/resources/routes";

// Client-side check for the route JSON dropped into the upload dialog.
// Mirrors the API's route object rules; the API remains the authority
// and its 400 renders the same way (admin.md 7.3).

export type RouteIssue = { path: string; message: string };

export type RouteSummary = {
  points: number;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  firstAt: string | null;
  lastAt: string | null;
};

export type RouteCheck =
  | { ok: true; body: RouteUploadBody; summary: RouteSummary }
  | { ok: false; issues: RouteIssue[]; total: number };

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export const ROUTE_MAX_BYTES = 5 * 1024 * 1024;
export const ROUTE_MIN_POINTS = 2;
export const ROUTE_MAX_POINTS = 50_000;
export const MAX_ISSUES_SHOWN = 20;

const ALLOWED_TOP_KEYS = new Set(["name", "points"]);
const ALLOWED_POINT_KEYS = new Set(["lat", "lng", "recordedAt"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function checkRouteFile(text: string, byteLength: number): RouteCheck {
  // 1. Size cap.
  if (byteLength > ROUTE_MAX_BYTES) {
    return {
      ok: false,
      issues: [{ path: "file", message: "exceeds 5 MB" }],
      total: 1,
    };
  }

  // 2. JSON.parse.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      issues: [{ path: "file", message: `not valid JSON: ${msg}` }],
      total: 1,
    };
  }

  // 3. Top level shape.
  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      issues: [{ path: "file", message: "expected a JSON object" }],
      total: 1,
    };
  }

  const issues: RouteIssue[] = [];
  let total = 0;
  const add = (issue: RouteIssue) => {
    total += 1;
    if (issues.length < MAX_ISSUES_SHOWN) issues.push(issue);
  };

  // Missing required keys.
  if (!Object.prototype.hasOwnProperty.call(parsed, "name")) {
    add({ path: "name", message: "required" });
  }
  if (!Object.prototype.hasOwnProperty.call(parsed, "points")) {
    add({ path: "points", message: "required" });
  }
  // Unknown top-level keys.
  for (const key of Object.keys(parsed)) {
    if (!ALLOWED_TOP_KEYS.has(key)) {
      add({ path: key, message: "unknown field" });
    }
  }

  // 4. name: string, trimmed 1..200.
  let nameOk = false;
  let trimmedName = "";
  const rawName = parsed.name;
  if ("name" in parsed) {
    if (typeof rawName !== "string") {
      add({ path: "name", message: "must be a string" });
    } else {
      trimmedName = rawName.trim();
      if (trimmedName.length < 1) {
        add({ path: "name", message: "must not be empty" });
      } else if (trimmedName.length > 200) {
        add({ path: "name", message: "at most 200 characters" });
      } else {
        nameOk = true;
      }
    }
  }

  // 5. points: array of the required size.
  const rawPoints = parsed.points;
  let pointsOk = false;
  const cleanPoints: RoutePoint[] = [];
  if ("points" in parsed) {
    if (!Array.isArray(rawPoints)) {
      add({ path: "points", message: "must be an array" });
    } else if (rawPoints.length < ROUTE_MIN_POINTS) {
      add({
        path: "points",
        message: `at least ${ROUTE_MIN_POINTS} points required`,
      });
    } else if (rawPoints.length > ROUTE_MAX_POINTS) {
      add({
        path: "points",
        message: `at most ${ROUTE_MAX_POINTS} points allowed`,
      });
    } else {
      pointsOk = true;
    }
  }

  if (pointsOk && Array.isArray(rawPoints)) {
    for (let i = 0; i < rawPoints.length; i++) {
      const p = rawPoints[i];
      if (!isPlainObject(p)) {
        add({ path: `points[${i}]`, message: "must be an object" });
        continue;
      }
      // Unknown keys.
      for (const key of Object.keys(p)) {
        if (!ALLOWED_POINT_KEYS.has(key)) {
          add({ path: `points[${i}].${key}`, message: "unknown field" });
        }
      }
      // Required keys and value checks.
      let lat: number | null = null;
      let lng: number | null = null;
      let recordedAt: string | null = null;
      let pointOk = true;

      if (!Object.prototype.hasOwnProperty.call(p, "lat")) {
        add({ path: `points[${i}].lat`, message: "required" });
        pointOk = false;
      } else {
        const v = p.lat;
        if (typeof v !== "number" || !Number.isFinite(v)) {
          add({ path: `points[${i}].lat`, message: "must be a finite number" });
          pointOk = false;
        } else if (v < -90 || v > 90) {
          add({ path: `points[${i}].lat`, message: "must be between -90 and 90" });
          pointOk = false;
        } else {
          lat = v;
        }
      }

      if (!Object.prototype.hasOwnProperty.call(p, "lng")) {
        add({ path: `points[${i}].lng`, message: "required" });
        pointOk = false;
      } else {
        const v = p.lng;
        if (typeof v !== "number" || !Number.isFinite(v)) {
          add({ path: `points[${i}].lng`, message: "must be a finite number" });
          pointOk = false;
        } else if (v < -180 || v > 180) {
          add({
            path: `points[${i}].lng`,
            message: "must be between -180 and 180",
          });
          pointOk = false;
        } else {
          lng = v;
        }
      }

      if (!Object.prototype.hasOwnProperty.call(p, "recordedAt")) {
        add({ path: `points[${i}].recordedAt`, message: "required" });
        pointOk = false;
      } else {
        const v = p.recordedAt;
        if (v === null) {
          recordedAt = null;
        } else if (typeof v !== "string") {
          add({
            path: `points[${i}].recordedAt`,
            message: "must be a string or null",
          });
          pointOk = false;
        } else if (!RFC3339.test(v) || Number.isNaN(Date.parse(v))) {
          add({
            path: `points[${i}].recordedAt`,
            message: "not a valid RFC 3339 timestamp",
          });
          pointOk = false;
        } else {
          recordedAt = v;
        }
      }

      if (pointOk && lat !== null && lng !== null) {
        cleanPoints.push({ lat, lng, recordedAt });
      }
    }
  }

  if (total > 0 || !nameOk || !pointsOk) {
    return { ok: false, issues, total };
  }

  const summary = summarize(cleanPoints);
  return {
    ok: true,
    body: { name: trimmedName, points: cleanPoints },
    summary,
  };
}

function summarize(points: RoutePoint[]): RouteSummary {
  let latMin = Number.POSITIVE_INFINITY;
  let latMax = Number.NEGATIVE_INFINITY;
  let lngMin = Number.POSITIVE_INFINITY;
  let lngMax = Number.NEGATIVE_INFINITY;
  let firstAt: string | null = null;
  let lastAt: string | null = null;
  for (const p of points) {
    if (p.lat < latMin) latMin = p.lat;
    if (p.lat > latMax) latMax = p.lat;
    if (p.lng < lngMin) lngMin = p.lng;
    if (p.lng > lngMax) lngMax = p.lng;
    if (p.recordedAt !== null) {
      if (firstAt === null || p.recordedAt < firstAt) firstAt = p.recordedAt;
      if (lastAt === null || p.recordedAt > lastAt) lastAt = p.recordedAt;
    }
  }
  return {
    points: points.length,
    latMin,
    latMax,
    lngMin,
    lngMax,
    firstAt,
    lastAt,
  };
}
