import { expect, test } from "@playwright/test";
import {
  fetchAdminAccessToken,
  readAdmin,
  setWalkEventStatus,
  signIn,
} from "./helpers";

// Spec 5 (docs/admin.md § 9.3): with the event live, cookie type controls
// are disabled; after ended, a type can be edited.
//
// Precondition: the dev walk event (year 2100, site.md § 22.2) is set live
// through the API before the test runs and ended again after, so this spec
// carries its own environment and does not require any other spec to have
// run first.

test.describe("cookie types are locked while an event is live", () => {
  let adminToken: string | null = null;

  test.beforeAll(async ({ browser }) => {
    adminToken = await fetchAdminAccessToken(browser);
    await setWalkEventStatus(adminToken, 3);
  });

  test.afterAll(async () => {
    if (adminToken === null) return;
    // Idempotent: on 409 event_status_unchanged the event is already ended.
    await setWalkEventStatus(adminToken, 4).catch(() => undefined);
  });

  test("disabled while live, editable after end", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    await page.getByRole("link", { name: /cookie types/i }).click();

    // The banner is the panel's own signal that an event is live and the
    // section is read-only, per 6.7.
    await expect(page.getByText(/is live. Cookie types/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /new type/i })).toBeDisabled();

    // End the current event through the events page, then return.
    await page.getByRole("link", { name: "Events", exact: true }).click();
    const currentRow = page.getByRole("row", { name: /current/i }).first();
    await currentRow.getByRole("button", { name: /^end$/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();

    await page.getByRole("link", { name: /cookie types/i }).click();
    await expect(page.getByText(/is live. Cookie types/i)).toBeHidden();
    await expect(page.getByRole("button", { name: /new type/i })).toBeEnabled();

    // Editing a row must round-trip. Choose the first row's edit control.
    const firstRow = page.getByRole("row").nth(1);
    await firstRow.getByRole("button", { name: /edit/i }).click();
    const label = page.getByLabel(/label/i);
    const before = (await label.inputValue()) || "cookie";
    await label.fill(`${before} (edited)`);
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(firstRow.getByText(new RegExp(`${before} \\(edited\\)`))).toBeVisible();
  });
});
