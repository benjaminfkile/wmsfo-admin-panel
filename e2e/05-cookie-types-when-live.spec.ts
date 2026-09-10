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

    // End the current event from its detail page (the list has no status
    // controls): open the row carrying the Current chip, then the status
    // card's Ended button and its confirmation.
    await page.getByRole("navigation").locator('a[href="/events"]').click();
    const currentRow = page.getByTestId(/^event-row-/).filter({ has: page.getByText("Current", { exact: true }) }).first();
    await currentRow.getByRole("link", { name: /^open$/i }).click();
    await page.getByRole("button", { name: /^ended$/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^change status$/i })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("link", { name: /cookie types/i }).click();
    await expect(page.getByText(/is live. Cookie types/i)).toBeHidden();
    await expect(page.getByRole("button", { name: /new type/i })).toBeEnabled();

    // Editing a row must round-trip. Choose the first row's edit control.
    const firstRow = page.getByRole("row").nth(1);
    await firstRow.getByRole("button", { name: /edit/i }).click();
    // The edit dialog's field is "Name"; toggle an "(edited)" suffix so
    // repeated runs do not grow the name.
    const dialog = page.getByRole("dialog");
    // MUI renders the required label as "Name *".
    const nameField = dialog.getByLabel(/^name/i);
    const before = (await nameField.inputValue()) || "cookie";
    const after = before.endsWith(" (edited)") ? before.slice(0, -" (edited)".length) : `${before} (edited)`;
    await nameField.fill(after);
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(firstRow.getByText(after, { exact: true })).toBeVisible();
  });
});
