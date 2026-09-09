import { expect, test } from "@playwright/test";
import { readAdmin, signIn } from "./helpers";

// Spec 2 (docs/admin.md § 9.3): create a beacon; the key dialog shows a
// `wbk_` key and a PNG data URL; rotate it; revoke it.

test.describe("beacons", () => {
  test("create, rotate, revoke; key dialog shows wbk_ key and QR", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    await page.getByRole("link", { name: /beacons/i }).click();
    await page.getByRole("button", { name: /new beacon/i }).click();

    const name = `e2e-${Date.now()}`;
    await page.getByLabel(/name/i).fill(name);
    await page.getByLabel(/notes/i).fill("Created by end-to-end spec 2");
    await page.getByLabel(/beacon/i).check();
    await page.getByRole("button", { name: /^create$/i }).click();

    const keyDialog = page.getByRole("dialog", { name: /key/i });
    await expect(keyDialog).toBeVisible();
    await expect(keyDialog.getByText(/^wbk_[A-Za-z0-9_-]+/)).toBeVisible();
    const qr = keyDialog.locator("img");
    await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);
    await keyDialog.getByRole("button", { name: /i have stored the key/i }).click();

    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: /rotate/i }).click();
    await page.getByRole("button", { name: /^rotate$/i }).click();
    const rotated = page.getByRole("dialog", { name: /key/i });
    await expect(rotated).toBeVisible();
    await expect(rotated.getByText(/^wbk_/)).toBeVisible();
    await rotated.getByRole("button", { name: /i have stored the key/i }).click();

    await row.getByRole("button", { name: /revoke/i }).click();
    await page.getByRole("button", { name: /^revoke$/i }).click();
    await expect(row.getByText(/revoked/i)).toBeVisible();
  });
});
