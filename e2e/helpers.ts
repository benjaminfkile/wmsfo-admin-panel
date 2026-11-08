import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { TOTP } from "otpauth";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// A dev admin and a dev editor, both with TOTP enabled on the dev Cognito
// pool. The workflow supplies these through the `dev` GitHub environment;
// running locally reads them from `.env.local`.
export type DevUser = {
  email: string;
  password: string;
  totpSecret: string;
};

export function readAdmin(): DevUser {
  return {
    email: required("E2E_ADMIN_EMAIL"),
    password: required("E2E_ADMIN_PASSWORD"),
    totpSecret: required("E2E_ADMIN_TOTP_SECRET"),
  };
}

export function readEditor(): DevUser {
  return {
    email: required("E2E_EDITOR_EMAIL"),
    password: required("E2E_EDITOR_PASSWORD"),
    totpSecret: required("E2E_EDITOR_TOTP_SECRET"),
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `${name} is not set. Populate .env.local or the dev GitHub environment.`,
    );
  }
  return v.trim();
}

export function totpCode(secret: string): string {
  return new TOTP({ secret, digits: 6, period: 30, algorithm: "SHA1" }).generate();
}

export function readDevCdnBase(): string {
  return required("VITE_CDN_BASE_URL").replace(/\/+$/, "");
}

export function readDevApiBase(): string {
  return required("VITE_API_BASE_URL").replace(/\/+$/, "");
}

// Sign in as admin in a throw-away browser context and hand back its OIDC
// ID token (the token the panel itself sends as the bearer, see
// src/api/client.ts), read out of the sessionStorage the panel writes on load.
// The key format `oidc.user:<authority>:<clientId>` is the WebStorageStateStore
// prefix ("oidc.") plus the User's own store key.
export async function fetchAdminAccessToken(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signIn(page, readAdmin());
    // signIn already waits for the OIDC user key to appear; reading it here
    // is a straight lookup, not a race.
    const token = await page.evaluate(() => {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith("oidc.user:")) {
          const raw = sessionStorage.getItem(key);
          if (raw !== null) {
            const parsed = JSON.parse(raw) as { id_token?: string };
            if (typeof parsed.id_token === "string") {
              return parsed.id_token;
            }
          }
        }
      }
      return null;
    });
    if (token === null) {
      throw new Error("OIDC user missing from sessionStorage after sign-in");
    }
    return token;
  } finally {
    await context.close();
  }
}

type EventRow = {
  id: number;
  year: number;
  name: string;
  statusId: number;
  isCurrent: boolean;
};

export async function adminApi(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${readDevApiBase()}${path}`, {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return text === "" ? null : (JSON.parse(text) as unknown);
}

// Read the current event's name through `/admin/events`, so specs can
// locate its row on the events page: the "Current" chip's label is not
// part of the row's accessible name and cannot be matched by row text.
export async function readCurrentEventName(token: string): Promise<string> {
  const list = (await adminApi(token, "GET", "/admin/events")) as {
    items: EventRow[];
  };
  const current = (list.items ?? []).find((e) => e.isCurrent);
  if (current === undefined) {
    throw new Error("No current event in /admin/events");
  }
  return current.name;
}

// Return every event row from `/admin/events`, in the order the API
// serves them. Specs use this to record the current event before a run
// and to find the walk event.
export async function listEvents(token: string): Promise<EventRow[]> {
  const list = (await adminApi(token, "GET", "/admin/events")) as {
    items: EventRow[];
  };
  return list.items ?? [];
}

// Set the given event current through the API. Idempotent for an event
// that is already current.
export async function setEventCurrent(
  token: string,
  eventId: number,
): Promise<void> {
  await adminApi(token, "POST", `/admin/events/${eventId}/current`);
}

// Delete an event through the API (`DELETE /admin/events/{id}`, contracts
// 4.5 Events). Specs use this in `afterAll` to remove the event they
// created so the dev events list stops accumulating rows. The API answers
// 409 for a live event or one that carries location rows; callers hand
// "current" and status back to another event first.
export async function deleteEvent(
  token: string,
  eventId: number,
): Promise<void> {
  await adminApi(token, "DELETE", `/admin/events/${eventId}`);
}

// Change an event's status without sending a notification. Used to bring
// the walk back to status 4 after a spec pushes it forward.
export async function setEventStatus(
  token: string,
  eventId: number,
  statusId: number,
): Promise<void> {
  await adminApi(token, "POST", `/admin/events/${eventId}/status`, {
    statusId,
    notify: false,
    message: null,
  });
}

// Return the id of the currently published content version, from
// `GET /admin/content/status` (admin.md 6.18). Spec 07 records this in
// `beforeAll` so its restore-and-publish step can put the same version
// back at the end of the run instead of clobbering the dev site with
// version 1.
export async function readPublishedContentVersionId(
  token: string,
): Promise<number | null> {
  const status = (await adminApi(token, "GET", "/admin/content/status")) as {
    published: { id?: number | string | null } | null;
  };
  const raw = status.published?.id ?? null;
  return raw === null ? null : Number(raw);
}

type BeaconRow = {
  id: number;
  keyPrefix: string;
  isActive: boolean;
  healthy: boolean;
};

type BeaconsListResponse = { items: BeaconRow[]; staleAfterS: number };

// Read the beacons list through `/admin/beacons`. Specs use this to
// record the currently active beacon, find the e2e beacon by its
// `keyPrefix`, and inspect the `healthy` flag the go-live gate reads.
export async function listBeacons(
  token: string,
): Promise<BeaconsListResponse> {
  return (await adminApi(token, "GET", "/admin/beacons")) as BeaconsListResponse;
}

// Activate the given beacon (`POST /admin/beacons/{id}/activate`). The
// API clears `is_active` on every other row in the same transaction, so
// this is enough to swap the active beacon.
export async function activateBeacon(
  token: string,
  beaconId: number,
): Promise<void> {
  await adminApi(token, "POST", `/admin/beacons/${beaconId}/activate`);
}

// Post a heartbeat with the given beacon key so the API's go-live gate
// (admin.md 6.3, 8.2 no_healthy_beacon) admits status 3 while that beacon is
// the active one. The beacon endpoints require the `X-Beacon-Key` header
// (contracts 4.2) and refuse a bearer key with 401.
export async function postBeaconHeartbeat(key: string): Promise<void> {
  const res = await fetch(`${readDevApiBase()}/beacons/heartbeat`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "X-Beacon-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sentAt: new Date().toISOString(),
      health: {
        batteryPercent: 90,
        lastFixAgeS: 1,
        socketState: "connected",
      },
      debug: null,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /beacons/heartbeat → ${res.status}: ${text}`);
  }
}

// Put "current" back the way a spec found it: the event that was current,
// or no current event at all when none was.
export async function restoreCurrentEvent(
  token: string,
  prevCurrentEventId: number | null,
): Promise<void> {
  if (prevCurrentEventId !== null) {
    await setEventCurrent(token, prevCurrentEventId);
    return;
  }
  const current = (await listEvents(token)).find((e) => e.isCurrent);
  if (current !== undefined) {
    await adminApi(token, "DELETE", `/admin/events/${current.id}/current`);
  }
}

const quiet = (p: Promise<unknown>) => p.catch(() => undefined);

// A beacon of the run's own, for the specs that go live: the go-live gate
// (admin.md 6.3) needs a healthy active beacon, and the dev fleet's beacons
// are real devices whose keys the suite does not hold. `enrollRunBeacon`
// records the active beacon and enrolls a fresh one (never heartbeated, so
// it starts stale); `releaseRunBeacon` puts the active beacon back and
// revokes the run's one.
export type RunBeacon = {
  token: string;
  id: number;
  key: string;
  prevActiveBeaconId: number | null;
  fixTimer?: ReturnType<typeof setInterval>;
};

// A fixed point over Missoula. Every fix repeats it, so the first one is
// stored and the rest are carried (contracts 4.2): published to the live
// object without adding rows.
const RUN_FIX = { lat: 46.8721, lng: -113.994 };
const RUN_FIX_INTERVAL_MS = 5_000;

// Post one location fix for the run's beacon (`POST /locations`, the HTTP
// door of contracts 4.2). Outside a live event the API answers
// `409 no_live_event`, which is ignored.
export async function postRunFix(b: RunBeacon): Promise<void> {
  await fetch(`${readDevApiBase()}/locations`, {
    method: "POST",
    cache: "no-store",
    headers: { "X-Beacon-Key": b.key, "Content-Type": "application/json" },
    body: JSON.stringify({ ...RUN_FIX, recordedAt: new Date().toISOString() }),
  }).catch(() => undefined);
}

// While an event is live the run's beacon posts a fix every 5 s, as a real
// flight would, so the dev "no location while live" alarm (live with no
// location published in two consecutive minutes) stays quiet during a run. Starts once;
// `releaseRunBeacon` stops it.
export function startRunFixes(b: RunBeacon): void {
  if (b.fixTimer !== undefined) return;
  void postRunFix(b);
  b.fixTimer = setInterval(() => void postRunFix(b), RUN_FIX_INTERVAL_MS);
}

function stopRunFixes(b: RunBeacon): void {
  if (b.fixTimer !== undefined) clearInterval(b.fixTimer);
  b.fixTimer = undefined;
}

export async function enrollRunBeacon(token: string): Promise<RunBeacon> {
  const beacons = await listBeacons(token);
  const prevActiveBeaconId = beacons.items.find((b) => b.isActive)?.id ?? null;
  const enrolled = (await adminApi(token, "POST", "/admin/beacons", {
    name: `e2e-run-${Date.now()}`,
    notes: "Created by the e2e suite for one run; revoked when the spec ends",
  })) as { beacon: { id: number }; key: string };
  return {
    token,
    id: Number(enrolled.beacon.id),
    key: enrolled.key,
    prevActiveBeaconId,
  };
}

// Make the run's beacon the active one and post a heartbeat for it, so the
// go-live gate sees a healthy active beacon, and start its fixes.
export async function activateRunBeacon(b: RunBeacon): Promise<void> {
  await activateBeacon(b.token, b.id);
  await postBeaconHeartbeat(b.key);
  startRunFixes(b);
}

export async function releaseRunBeacon(b: RunBeacon): Promise<void> {
  stopRunFixes(b);
  if (b.prevActiveBeaconId !== null) {
    await quiet(activateBeacon(b.token, b.prevActiveBeaconId));
  }
  await quiet(adminApi(b.token, "POST", `/admin/beacons/${b.id}/revoke`));
}

export const WALK_YEAR = 2100;
export const WALK_NAME = "E2E walk";

// What the walk specs (5 and 5a) need on the dev stack, created by the
// specs themselves: the walk event (year 2100; reused when one exists,
// created otherwise) and a run beacon. `setUpWalk` records the current
// event first; `tearDownWalk` ends the walk, restores the current event
// and the active beacon, revokes the run's beacon, and deletes the walk
// event when the run created it, so dev ends where it began.
export type WalkFixture = {
  token: string;
  walk: EventRow;
  createdWalk: boolean;
  beacon: RunBeacon;
  prevCurrentEventId: number | null;
};

export async function setUpWalk(token: string): Promise<WalkFixture> {
  const events = await listEvents(token);
  const prevCurrentEventId = events.find((e) => e.isCurrent)?.id ?? null;
  let walk = events.find((e) => Number(e.year) === WALK_YEAR);
  let createdWalk = false;
  if (walk === undefined) {
    walk = (await adminApi(token, "POST", "/admin/events", {
      year: WALK_YEAR,
      name: WALK_NAME,
    })) as EventRow;
    createdWalk = true;
  }
  return {
    token,
    walk,
    createdWalk,
    beacon: await enrollRunBeacon(token),
    prevCurrentEventId,
  };
}

export async function tearDownWalk(f: WalkFixture): Promise<void> {
  // Ended first: DELETE answers 409 event_live at status 3.
  await quiet(setEventStatus(f.token, f.walk.id, 4));
  await quiet(restoreCurrentEvent(f.token, f.prevCurrentEventId));
  await releaseRunBeacon(f.beacon);
  if (f.createdWalk) {
    // DELETE takes the event's locations with it.
    await quiet(deleteEvent(f.token, f.walk.id));
  } else {
    // A walk event that was already there keeps no rows from this run.
    // The dev fleet's own beacons (the Red-Nose phone, the simulator) post
    // to whichever event is live too, so clear every beacon's rows; the
    // walk event is the suite's own.
    await quiet(adminApi(f.token, "DELETE", `/admin/events/${f.walk.id}/locations`));
  }
}

// Drive the walk event into the requested status through the API. Status 3
// needs the walk current and a healthy active beacon, so both are arranged
// first.
export async function setWalkEventStatus(
  f: WalkFixture,
  statusId: number,
): Promise<void> {
  const walk = (await listEvents(f.token)).find((e) => e.id === f.walk.id);
  if (walk === undefined) {
    throw new Error(`walk event ${f.walk.id} is gone from /admin/events`);
  }
  if (statusId === 3) {
    if (!walk.isCurrent) await setEventCurrent(f.token, walk.id);
    await activateRunBeacon(f.beacon);
  }
  if (Number(walk.statusId) !== statusId) {
    await setEventStatus(f.token, walk.id, statusId);
  }
  // Publish a location the moment the walk is live, not on the next tick.
  if (statusId === 3) await postRunFix(f.beacon);
}

// Sign-in walks the Cognito managed login pages: username, password, TOTP.
// The pool domain runs managed login (branding version 2), whose forms carry
// real labels; anything more brittle than a name or label lookup will drift
// the moment AWS reflows the page.
// Cognito refuses a TOTP code that was already used, and consecutive specs sign
// in faster than the 30 s window turns over. Remember the last code per secret
// and wait for the next window when it would repeat.
// Playwright loads each spec file in a fresh module scope, so the memory lives
// in a temp file keyed by a hash of the secret.
function totpMemoryPath(secret: string): string {
  const key = createHash("sha256").update(secret).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), `wmsfo-e2e-totp-${key}`);
}
export async function freshTotpCode(secret: string): Promise<string> {
  const memory = totpMemoryPath(secret);
  const last = existsSync(memory) ? readFileSync(memory, "utf8").trim() : "";
  let code = totpCode(secret);
  while (last === code) {
    const wait = 30_000 - (Date.now() % 30_000) + 500;
    await new Promise((r) => setTimeout(r, wait));
    code = totpCode(secret);
  }
  writeFileSync(memory, code);
  return code;
}

export async function signIn(page: Page, user: DevUser): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /sign in/i }).first().click();
  // Managed login renders one form per step. The sign-in step's inputs are
  // named username and password; the MFA step has a single textbox labelled
  // "Code" and a submit button. Look the inputs up by name and label.
  await page.locator('input[name="username"]:visible').first().fill(user.email);
  await page.locator('input[name="password"]:visible').first().fill(user.password);
  const submit = 'button[type="submit"]:visible';
  await page.locator(submit).first().click();
  const code = page.getByRole("textbox", { name: /^code$/i });
  // Managed login occasionally re-renders the sign-in step with the email
  // field marked invalid instead of advancing to the code step. Retry the
  // credentials once (after a brief settle) before giving up on the code.
  try {
    await code.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    const username = page.locator('input[name="username"]:visible').first();
    if ((await username.count()) > 0) {
      await page.waitForTimeout(2_000);
      await username.fill(user.email);
      await page
        .locator('input[name="password"]:visible')
        .first()
        .fill(user.password);
      await page.locator(submit).first().click();
      await code.waitFor({ state: "visible" });
    } else {
      await code.waitFor({ state: "visible" });
    }
  }
  await code.fill(await freshTotpCode(user.totpSecret));
  await page.locator(submit).first().click();
  // The submit navigates out to Cognito and back through /auth/callback to
  // the app's landing route. Wait for that landing before probing the app's
  // sessionStorage; before the navigation completes, `sessionStorage` here
  // still points at Cognito's origin, not the panel's.
  await page.waitForURL((url) => !/\/oauth2\//.test(url.pathname) && !/\/auth\/callback\b/.test(url.pathname));
  // oidc-client-ts writes the user into sessionStorage as part of the
  // callback handler; the shell then transitions from `loading` to `member`
  // and renders the drawer. Wait for the storage key so callers can rely on
  // both signals: the access token is available and the panel has finished
  // the callback.
  await page.waitForFunction(() => {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("oidc.user:")) return true;
    }
    return false;
  });
  // The app bar mounts once AuthProvider has evaluated the user, and its
  // theme toggle is present at every viewport width (the permanent drawer
  // is hidden below md), so that button is the panel's "signed in" signal.
  await page.getByRole("button", { name: /toggle theme/i }).waitFor();
}

// Confirm a status change through StatusDialog's silent path (admin.md
// 6.3): press "Change without notifying", then confirm the nested dialog.
// The specs never take the notify path, so a run sends no email to the dev
// stack's subscribers.
export async function changeWithoutNotifying(page: Page): Promise<void> {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^change without notifying$/i })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^change without notifying$/i })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: /sign out/i }).click();
}

// Poll a JSON object at the dev CDN until `check` accepts it or `timeoutMs`
// elapses. Used to assert that a panel action shows up on the CDN within the
// documented 10-second window.
export async function waitForCdnJson<T>(
  url: string,
  check: (json: T) => boolean,
  timeoutMs = 15_000,
  intervalMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as T;
        if (check(json)) return json;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `CDN JSON at ${url} never satisfied the predicate within ${timeoutMs} ms` +
      (lastError ? ` (last error: ${String(lastError)})` : ""),
  );
}

// Attach an artefact to the test report so debugging a CI failure does not
// require a rerun. Small enough to be safe for text bodies.
export async function attachText(
  info: TestInfo,
  name: string,
  body: string,
): Promise<void> {
  await info.attach(name, { body, contentType: "text/plain" });
}
