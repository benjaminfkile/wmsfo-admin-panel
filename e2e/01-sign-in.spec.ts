import { expect, test } from "@playwright/test";
import { readAdmin, signIn, signOut } from "./helpers";

// Spec 1 (docs/admin.md § 9.3): sign in through the hosted UI with password
// and TOTP; the layout renders with the DEV badge; sign out returns to the
// SignIn page.

test.describe("sign in and out", () => {
  test("hosted UI + TOTP, DEV badge, sign out", async ({ page }) => {
    const admin = readAdmin();

    await signIn(page, admin);

    await expect(page).toHaveURL(/localhost:5174\//);
    await expect(page.getByText("DEV", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();

    await signOut(page);

    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });
});
