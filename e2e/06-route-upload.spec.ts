import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  fetchAdminAccessToken,
  readAdmin,
  readCurrentEventName,
  signIn,
} from "./helpers";

// Spec 6 (docs/admin.md § 9.3): upload the vendored route fixture (with
// `schemaVersion` stripped by the test) to an event; the route section
// shows its point count.

test.describe("route upload", () => {
  let adminToken: string | null = null;

  test.beforeAll(async ({ browser }) => {
    adminToken = await fetchAdminAccessToken(browser);
  });

  test("strip schemaVersion, upload, point count renders", async ({ page }, info) => {
    // The "Current" chip in EventsList is not part of the row's text, so
    // the row must be found by the event's name; fetch that from the
    // admin API before driving the panel.
    if (adminToken === null) throw new Error("admin token not fetched");
    const currentEventName = await readCurrentEventName(adminToken);

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

    await page.getByRole("link", { name: "Events", exact: true }).click();
    const row = page.getByRole("row", { name: new RegExp(currentEventName) });
    await row.getByRole("link", { name: new RegExp(currentEventName) }).click();

    // RouteSection's button is labelled "Upload" (opens the dialog); the
    // dialog's submit is also "Upload" and is scoped by the dialog role.
    await page.getByRole("button", { name: /^upload$/i }).click();
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
    // RouteSection prints the count as "pointCount:<n>" alongside the
    // linked route's other fields.
    await expect(
      page.getByText(new RegExp(`pointCount:\\s*${expectedCount}\\b`, "i")),
    ).toBeVisible();
  });
});
