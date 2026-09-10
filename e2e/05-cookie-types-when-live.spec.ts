import { expect, test } from "@playwright/test";
import { readAdmin, signIn } from "./helpers";

// Spec 5 (docs/admin.md § 9.3): with the event live, cookie type controls
// are disabled; after ended, a type can be edited.

test.describe("cookie types are locked while an event is live", () => {
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
