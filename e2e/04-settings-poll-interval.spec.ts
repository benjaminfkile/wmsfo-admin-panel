import { expect, test } from "@playwright/test";
import { readAdmin, readDevCdnBase, signIn, waitForCdnJson } from "./helpers";

// Spec 4 (docs/admin.md § 9.3): change `poll_interval_ms`; the CDN object's
// `pollIntervalMs` follows within 10 s; restore it.

type Live = { pollIntervalMs: number; publishedAt: string };

test.describe("poll_interval_ms round-trips to the CDN", () => {
  test.setTimeout(120_000);

  test("change and restore", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    const cdnUrl = `${readDevCdnBase()}/live/location.json`;
    const before = await (await fetch(cdnUrl, { cache: "no-store" })).json() as Live;

    // "Site settings" is also a drawer entry; match the operational Settings exactly.
    await page.getByRole("link", { name: "Settings", exact: true }).click();

    const changed = before.pollIntervalMs === 1500 ? 2000 : 1500;
    // Settings saves through an explicit Save button per row, not blur or
    // Enter; fill the row's numeric input and click its Save. The CDN's
    // full refresh cycle needs longer than the default 15 s wait.
    const row = page.getByTestId("setting-row-poll_interval_ms");
    const input = row.getByRole("spinbutton");
    await input.fill(String(changed));
    await row.getByRole("button", { name: /^save$/i }).click();

    await waitForCdnJson<Live>(cdnUrl, (j) => j.pollIntervalMs === changed, 30_000);

    await input.fill(String(before.pollIntervalMs));
    await row.getByRole("button", { name: /^save$/i }).click();
    await waitForCdnJson<Live>(cdnUrl, (j) => j.pollIntervalMs === before.pollIntervalMs, 30_000);

    expect(true).toBe(true);
  });
});
