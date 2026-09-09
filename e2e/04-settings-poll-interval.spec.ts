import { expect, test } from "@playwright/test";
import { readAdmin, readDevCdnBase, signIn, waitForCdnJson } from "./helpers";

// Spec 4 (docs/admin.md § 9.3): change `poll_interval_ms`; the CDN object's
// `pollIntervalMs` follows within 10 s; restore it.

type Live = { pollIntervalMs: number; publishedAt: string };

test.describe("poll_interval_ms round-trips to the CDN", () => {
  test.setTimeout(90_000);

  test("change and restore", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    const cdnUrl = `${readDevCdnBase()}/live/location.json`;
    const before = await (await fetch(cdnUrl, { cache: "no-store" })).json() as Live;

    await page.getByRole("link", { name: /settings/i }).click();

    const changed = before.pollIntervalMs === 1500 ? 2000 : 1500;
    const input = page.getByLabel(/poll_interval_ms/i);
    await input.fill(String(changed));
    await input.blur();

    await waitForCdnJson<Live>(cdnUrl, (j) => j.pollIntervalMs === changed);

    await input.fill(String(before.pollIntervalMs));
    await input.blur();
    await waitForCdnJson<Live>(cdnUrl, (j) => j.pollIntervalMs === before.pollIntervalMs);

    expect(true).toBe(true);
  });
});
