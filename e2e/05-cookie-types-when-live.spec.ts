import { expect, test } from "@playwright/test";
import {
  adminApi,
  changeWithoutNotifying,
  fetchAdminAccessToken,
  readAdmin,
  setUpWalk,
  setWalkEventStatus,
  signIn,
  tearDownWalk,
  type WalkFixture,
} from "./helpers";

// Spec 5 (docs/admin.md § 9.3): with the event live, cookie type controls
// are disabled; after ended, a type can be edited, a fresh type can be
// created and deleted, and Delete is disabled on a type with cookies.
//
// The spec brings what it needs: `setUpWalk` finds or creates the walk
// event (year 2100) and enrolls a beacon for the run, then the walk is set
// live through the API (current, the run's beacon active and heartbeated).
// `tearDownWalk` ends the walk, restores the current event and the active
// beacon, revokes the run's beacon, and deletes the walk event when this run
// created it, so the dev stack ends where it began.

test.describe("cookie types are locked while an event is live", () => {
  let fixture: WalkFixture | null = null;
  // The cookie type the test renames and its name before the run, so
  // `afterAll` can put the name back if the test stops between the rename
  // and the rename back.
  let renamed: { id: number; name: string } | null = null;

  test.beforeAll(async ({ browser }) => {
    const adminToken = await fetchAdminAccessToken(browser);
    fixture = await setUpWalk(adminToken);
    await setWalkEventStatus(fixture, 3);
  });

  test.afterAll(async () => {
    if (fixture === null) return;
    if (renamed !== null) {
      await adminApi(fixture.token, "PATCH", `/admin/cookie-types/${renamed.id}`, {
        name: renamed.name,
      }).catch(() => undefined);
    }
    await tearDownWalk(fixture);
  });

  test("disabled while live, editable and deletable after end", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    await page.getByRole("link", { name: "Cookie types", exact: true }).click();

    // The banner is the panel's own signal that an event is live and the
    // section is read-only, per 6.7.
    await expect(page.getByText(/is live. Cookie types/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /new type/i })).toBeDisabled();

    // End the current event from its detail page (the list has no status
    // controls): open the row carrying the Current chip through its edit
    // pencil (M19: the Open link is gone, the pencil is the discoverable
    // control, aria-label "Edit <name>"), then the status card's Ended
    // button and its confirmation.
    await page.getByRole("navigation").locator('a[href="/events"]').click();
    const currentRow = page
      .getByTestId(/^event-row-/)
      .filter({ has: page.getByText("Current", { exact: true }) })
      .first();
    await currentRow.getByRole("link", { name: /^edit /i }).click();
    await page.getByRole("button", { name: /^ended$/i }).click();
    await changeWithoutNotifying(page);

    await page.getByRole("link", { name: "Cookie types", exact: true }).click();
    await expect(page.getByText(/is live. Cookie types/i)).toBeHidden();
    await expect(page.getByRole("button", { name: /new type/i })).toBeEnabled();

    // Editing a row must round-trip: rename the first type, see the new
    // name, then rename it back. The row's pencil is the discoverable edit
    // control (admin.md 1, edit-pencil convention).
    const firstRow = page.getByTestId(/^cookie-type-row-/).first();
    const rowTestId = (await firstRow.getAttribute("data-testid")) ?? "";
    const row = page.getByTestId(rowTestId);
    const dialog = page.getByRole("dialog");
    const rename = async (name: string): Promise<void> => {
      await row.getByRole("button", { name: /^edit /i }).click();
      await dialog.getByLabel(/^name/i).fill(name);
      await dialog.getByRole("button", { name: /^save$/i }).click();
      await expect(dialog).toBeHidden();
      await expect(row.getByText(name, { exact: true })).toBeVisible();
    };
    await row.getByRole("button", { name: /^edit /i }).click();
    const original = await dialog.getByLabel(/^name/i).inputValue();
    await dialog.getByRole("button", { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    renamed = { id: Number(rowTestId.replace(/^cookie-type-row-/, "")), name: original };
    await rename(`${original} (e2e)`);
    await rename(original);
    renamed = null;

    // A fresh type can be created and deleted round-trip (M32: deleting a
    // cookie type no longer refuses when cookies exist - the impact
    // preview names the cascade instead).
    const freshName = `e2e-delete-${Date.now()}`;
    await page.getByRole("button", { name: /new type/i }).click();
    // While the icon picker is open two dialogs coexist, so scope the create
    // dialog by its own name; wait for the picker to close after the click
    // before pressing Save.
    const createDialog = page.getByRole("dialog", {
      name: /new type|cookie type/i,
    });
    await createDialog.getByLabel(/^name/i).fill(freshName);
    // The panel requires an icon; pick from the library through the picker,
    // then confirm the picker's own Choose so it closes before Save.
    await createDialog.getByRole("button", { name: /choose/i }).click();
    const iconPicker = page.getByRole("dialog", { name: /icon/i });
    await iconPicker.locator("img").first().click();
    await iconPicker.getByRole("button", { name: /^choose$/i }).click();
    await expect(iconPicker).toBeHidden();
    await createDialog.getByRole("button", { name: /^save$/i }).click();
    await expect(createDialog).toBeHidden();
    const freshRow = page
      .getByTestId(/^cookie-type-row-/)
      .filter({ hasText: freshName })
      .first();
    await expect(freshRow).toBeVisible();
    await freshRow.getByRole("button", { name: /actions for/i }).click();
    await page.getByRole("menuitem", { name: /^delete$/i }).click();
    const deleteDialog = page.getByRole("dialog", {
      name: new RegExp(`delete ${freshName}`, "i"),
    });
    // Wait for the impact preview to load before the confirm button enables.
    await expect(
      deleteDialog.getByRole("button", { name: /^delete$/i }),
    ).toBeEnabled();
    await deleteDialog.getByRole("button", { name: /^delete$/i }).click();
    await expect(freshRow).toBeHidden();
  });
});
