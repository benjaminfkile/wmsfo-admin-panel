import { expect, test } from "@playwright/test";
import {
  fetchAdminAccessToken,
  listEvents,
  readAdmin,
  setEventCurrent,
  setWalkEventStatus,
  signIn,
} from "./helpers";

// Spec 5 (docs/admin.md § 9.3): with the event live, cookie type controls
// are disabled; after ended, a type can be edited, a fresh type can be
// created and deleted, and Delete is disabled on a type with cookies.
//
// Precondition: the dev walk event (year 2100, site.md § 22.2) is set live
// through the API before the test runs and ended again after, so this spec
// carries its own environment and does not require any other spec to have
// run first. The event that was current when the spec started is restored
// in `afterAll` so the dev stack ends where it began.

test.describe("cookie types are locked while an event is live", () => {
  let adminToken: string | null = null;
  let prevCurrentEventId: number | null = null;

  test.beforeAll(async ({ browser }) => {
    adminToken = await fetchAdminAccessToken(browser);
    const events = await listEvents(adminToken);
    prevCurrentEventId = events.find((e) => e.isCurrent)?.id ?? null;
    await setWalkEventStatus(adminToken, 3);
  });

  test.afterAll(async () => {
    if (adminToken === null) return;
    // Idempotent: on 409 event_status_unchanged the event is already ended.
    await setWalkEventStatus(adminToken, 4).catch(() => undefined);
    if (prevCurrentEventId !== null) {
      await setEventCurrent(adminToken, prevCurrentEventId).catch(() => undefined);
    }
  });

  test("disabled while live, editable and deletable after end", async ({ page }) => {
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
    const currentRow = page
      .getByTestId(/^event-row-/)
      .filter({ has: page.getByText("Current", { exact: true }) })
      .first();
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

    // Editing a row must round-trip. The row's pencil is the discoverable
    // edit control (admin.md 1, edit-pencil convention).
    const firstRow = page.getByTestId(/^cookie-type-row-/).first();
    await firstRow.getByRole("button", { name: /^edit /i }).click();
    const dialog = page.getByRole("dialog");
    const nameField = dialog.getByLabel(/^name/i);
    const before = (await nameField.inputValue()) || "cookie";
    const after = before.endsWith(" (edited)")
      ? before.slice(0, -" (edited)".length)
      : `${before} (edited)`;
    await nameField.fill(after);
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(firstRow.getByText(after, { exact: true })).toBeVisible();

    // Delete is disabled in the row menu when cookieCount > 0. The first
    // row's cookieCount is nonzero on the seeded dev dataset.
    await firstRow.getByRole("button", { name: /actions for/i }).click();
    const deleteItem = page.getByRole("menuitem", { name: /^delete$/i });
    await expect(deleteItem).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");

    // A fresh type with cookieCount === 0 can be created and deleted round-trip.
    const freshName = `e2e-delete-${Date.now()}`;
    await page.getByRole("button", { name: /new type/i }).click();
    await dialog.getByLabel(/^name/i).fill(freshName);
    // The panel requires an icon; pick from the library through the picker.
    await dialog.getByRole("button", { name: /choose/i }).click();
    const iconPicker = page.getByRole("dialog", { name: /icon/i });
    await iconPicker.locator("img").first().click();
    await dialog.getByRole("button", { name: /^save$/i }).click();
    await expect(dialog).toBeHidden();
    const freshRow = page
      .getByTestId(/^cookie-type-row-/)
      .filter({ hasText: freshName })
      .first();
    await expect(freshRow).toBeVisible();
    await freshRow.getByRole("button", { name: /actions for/i }).click();
    await page.getByRole("menuitem", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog", { name: /delete cookie type/i })
      .getByRole("button", { name: /^delete$/i })
      .click();
    await expect(freshRow).toBeHidden();
  });
});
