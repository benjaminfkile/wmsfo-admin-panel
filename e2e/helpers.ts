import type { Page, TestInfo } from "@playwright/test";
import { TOTP } from "otpauth";

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

// Sign-in walks the Cognito hosted UI: username, password, TOTP. Selectors
// are the shared "amplify auth" screens the pool uses; anything more brittle
// than a text/label lookup will drift the moment AWS reflows the page.
export async function signIn(page: Page, user: DevUser): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.getByLabel(/email|username/i).fill(user.email);
  await page.getByLabel(/^password$/i).fill(user.password);
  await page.getByRole("button", { name: /sign in|continue/i }).click();
  await page.getByLabel(/one-time|authenticator|code/i).fill(totpCode(user.totpSecret));
  await page.getByRole("button", { name: /confirm|verify|sign in/i }).click();
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
