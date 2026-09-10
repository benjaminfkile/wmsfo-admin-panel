import type { Browser, Page, TestInfo } from "@playwright/test";
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
// access token, read out of the sessionStorage the panel writes on load.
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
            const parsed = JSON.parse(raw) as { access_token?: string };
            if (typeof parsed.access_token === "string") {
              return parsed.access_token;
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

async function adminApi(
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

// Find the dev walk event (year 2100, site.md § 22.2) and drive it into the
// requested status through the API. `isCurrent` is set first if needed since
// status 3 requires the current flag.
export async function setWalkEventStatus(
  token: string,
  statusId: number,
): Promise<EventRow> {
  const list = (await adminApi(token, "GET", "/admin/events")) as {
    items: EventRow[];
  };
  const walk = (list.items ?? []).find((e) => Number(e.year) === 2100);
  if (walk === undefined) {
    throw new Error(
      "dev walk event (year 2100, site.md § 22.2) not found in /admin/events",
    );
  }
  if (statusId === 3 && !walk.isCurrent) {
    await adminApi(token, "POST", `/admin/events/${walk.id}/current`);
  }
  if (Number(walk.statusId) !== statusId) {
    return (await adminApi(
      token,
      "POST",
      `/admin/events/${walk.id}/status`,
      { statusId, notify: false },
    )) as EventRow;
  }
  return walk;
}

// Sign-in walks the Cognito hosted UI: username, password, TOTP. Selectors
// are the shared "amplify auth" screens the pool uses; anything more brittle
// than a text/label lookup will drift the moment AWS reflows the page.
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
  // The classic hosted UI renders the form twice (one copy hidden per
  // breakpoint) and its visible inputs carry no associated label, so every
  // lookup goes by field name and takes the visible copy.
  await page.locator('input[name="username"]:visible').first().fill(user.email);
  await page.locator('input[name="password"]:visible').first().fill(user.password);
  const submit = 'input[type="submit" i]:visible, button[type="submit"]:visible';
  await page.locator(submit).first().click();
  await page.locator('input[name="totpCode"]:visible, input#totpCodeInput:visible').first().fill(await freshTotpCode(user.totpSecret));
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
  // The drawer only mounts once AuthProvider has evaluated the user, so this
  // second wait is the panel's "signed in" signal for callers driving the UI.
  await page.getByRole("navigation").first().waitFor();
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
