import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readAdmin, signIn } from "./helpers";

// Spec 6 (docs/admin.md § 9.3): upload the vendored route fixture (with
// `schemaVersion` stripped by the test) to an event; the route section
// shows its point count.

test.describe("route upload", () => {
  test("strip schemaVersion, upload, point count renders", async ({ page }, info) => {
    const admin = readAdmin();
    await signIn(page, admin);

    const fixturePath = path.resolve(__dirname, "../contracts/fixtures/route.json");
    const raw = JSON.parse(await readFile(fixturePath, "utf8")) as {
      schemaVersion?: number;
      name: string;
      points: unknown[];
    };
    const expectedCount = raw.points.length;
    const stripped: Record<string, unknown> = { ...raw };
    delete stripped.schemaVersion;
    const buffer = Buffer.from(JSON.stringify(stripped));

    await page.getByRole("link", { name: /events/i }).click();
    const row = page.getByRole("row", { name: /current/i }).first();
    await row.getByRole("link", { name: /open|view/i }).click();

    await page.getByRole("button", { name: /upload route/i }).click();
    await page.setInputFiles('input[type="file"]', {
      name: "route.json",
      mimeType: "application/json",
      buffer,
    });
    await page.getByRole("button", { name: /^upload$/i }).click();

    await info.attach("route-point-count", {
      body: String(expectedCount),
      contentType: "text/plain",
    });
    await expect(
      page.getByText(new RegExp(`${expectedCount}\\s+point`, "i")),
    ).toBeVisible();
  });
});
