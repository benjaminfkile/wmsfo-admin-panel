import { expect, test } from "@playwright/test";
import { readAdmin, readDevCdnBase, signIn, waitForCdnJson } from "./helpers";

// Spec 3 (docs/admin.md § 9.3): create an event with inherit; set it
// current; walk planned → scheduled → live → ended through the
// confirmations; after each change `GET <dev cdn>/live/location.json`
// reports the new eventStatusId within 10 s.

type Live = { eventId: number | null; eventStatusId: number | null; publishedAt: string };

test.describe("events lifecycle", () => {
  test.setTimeout(180_000);

  test("create → current → planned → scheduled → live → ended, CDN follows", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    const cdnUrl = `${readDevCdnBase()}/live/location.json`;

    await page.getByRole("link", { name: /events/i }).click();
    await page.getByRole("button", { name: /new event/i }).click();

    const title = `e2e event ${Date.now()}`;
    await page.getByLabel(/title/i).fill(title);
    await page.getByLabel(/inherit/i).check();
    await page.getByRole("button", { name: /^create$/i }).click();

    const row = page.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: /set current/i }).click();

    // Planned (status 1) is the initial state after "set current".
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 1);

    await row.getByRole("button", { name: /schedule/i }).click();
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const iso = now.toISOString().slice(0, 16);
    await page.getByLabel(/scheduled at/i).fill(iso);
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 2);

    await row.getByRole("button", { name: /^go live$/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 3);

    await row.getByRole("button", { name: /^end$/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 4);

    await expect(row.getByText(/ended/i)).toBeVisible();
  });
});
