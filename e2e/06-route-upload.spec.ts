import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readAdmin, signIn } from "./helpers";

// Spec 6 (docs/admin.md § 9.3): upload the vendored route fixture (with
// `schemaVersion` stripped by the test) on the Flight recordings page;
// its row shows its point count. An event carries no route, so the
// upload links nothing.

test.describe("route upload", () => {
  test("strip schemaVersion, upload, point count renders", async ({ page }, info) => {
    const admin = readAdmin();
    await signIn(page, admin);

    // ES module: no __dirname; resolve relative to this file's URL.
    const fixturePath = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../contracts/fixtures/route.json");
    const raw = JSON.parse(await readFile(fixturePath, "utf8")) as {
      schemaVersion?: number;
      name: string;
      points: unknown[];
    };
    const expectedCount = raw.points.length;
    const stripped: Record<string, unknown> = { ...raw };
    delete stripped.schemaVersion;
    const buffer = Buffer.from(JSON.stringify(stripped));

    await page.getByRole("link", { name: "Flight recordings", exact: true }).click();
    await page.getByRole("button", { name: /^upload recording$/i }).click();
    await page.setInputFiles('input[type="file"]', {
      name: "route.json",
      mimeType: "application/json",
      buffer,
    });
    await page
      .getByRole("dialog", { name: /upload route/i })
      .getByRole("button", { name: /^upload$/i })
      .click();

    await info.attach("route-point-count", {
      body: String(expectedCount),
      contentType: "text/plain",
    });
    // The new row (or the identical recording's existing row) carries
    // the point count among its lines.
    await expect(
      page.getByRole("row", { name: new RegExp(raw.name) }).first(),
    ).toContainText(String(expectedCount));
  });
});
