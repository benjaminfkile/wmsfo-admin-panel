import { expect, test } from "@playwright/test";
import { readEditor, signIn } from "./helpers";

// Spec 8 (docs/admin.md § 9.3): as the editor, `GET /admin/events` answers
// `403 forbidden` and the Events route renders "Not available for your role".

test.describe("editor cannot open Events", () => {
  test("direct navigation renders the not-available page", async ({ page }) => {
    const editor = readEditor();
    await signIn(page, editor);

    const responses: number[] = [];
    page.on("response", (res) => {
      if (/\/admin\/events\b/.test(new URL(res.url()).pathname)) {
        responses.push(res.status());
      }
    });

    await page.goto("/events");

    await expect(page.getByText(/not available for your role/i)).toBeVisible();
    // If the panel followed the doc it did not call the API for this route
    // (403 is what the API answers if it does). Either "no call" or "403"
    // is compliant; a 200 is a bug.
    expect(responses.every((s) => s === 403)).toBe(true);
  });
});
