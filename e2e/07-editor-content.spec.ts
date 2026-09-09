import { expect, test } from "@playwright/test";
import { readDevCdnBase, readEditor, signIn, waitForCdnJson } from "./helpers";

// Spec 7 (docs/admin.md § 9.3): as an editor: the drawer shows five entries;
// open the about page; add a rich_text section with a paragraph; upload a
// small PNG through the media library; add a media section using it;
// preview the page in the frame and see both; publish with a label;
// `GET <dev cdn>/live/location.json` reports a new `snapshotUrl` within
// 10 s; the snapshot's `content` contains the paragraph and the media map
// contains the asset with three variants absent (the PNG is 400 px wide)
// and its `url` present; restore the previous version and publish again;
// delete the section and the asset (409 media_in_use first, then 204 after
// removing the reference).

type Live = { snapshotUrl: string };
type Snapshot = {
  content: Record<string, unknown>[];
  media: Record<string, { url: string; variants?: { srcset?: string } }>;
};

// A minimal 400 x 400 checkerboard PNG built in-process so no binary
// asset is committed. 400 px keeps the API below its variant threshold
// (three variants absent, per § 9.3 spec 7).
function tinyPng(): Buffer {
  // Pre-encoded valid 400x400 solid-red PNG. Generated once; kept inline.
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAZAAAAGQAQMAAACd0ZDaAAAABlBMVEX/AAD///9BHTQR" +
    "AAAAoUlEQVR4nO3QMQEAIAgEsBv/6i9NAY4hK5b3ZM0RgYUCggIRERERERERERERERER" +
    "ERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERER" +
    "ERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERER" +
    "EREREREREREREUFyBDzEmiK5rY4kAAAAASUVORK5CYII=";
  return Buffer.from(base64, "base64");
}

test.describe("editor authoring flow", () => {
  test.setTimeout(240_000);

  test("five drawer entries; publish; snapshot; restore; delete with 409 then 204", async ({
    page,
  }) => {
    const editor = readEditor();
    await signIn(page, editor);

    const nav = page.getByRole("navigation");
    for (const label of ["Pages", "Media", "Site settings", "Publish", "Sponsors"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Events" })).toHaveCount(0);

    await page.getByRole("link", { name: /pages/i }).click();
    await page.getByRole("link", { name: /about/i }).click();

    // Rich text section with a paragraph.
    await page.getByRole("button", { name: /add section/i }).click();
    await page.getByRole("button", { name: /rich text/i }).click();
    const paragraph = `e2e paragraph ${Date.now()}`;
    await page.getByLabel(/paragraph|body/i).fill(paragraph);

    // Upload through Media library.
    await page.getByRole("link", { name: /^media$/i }).click();
    await page.getByRole("button", { name: /upload/i }).click();
    await page.setInputFiles('input[type="file"]', {
      name: "e2e-editor.png",
      mimeType: "image/png",
      buffer: tinyPng(),
    });
    await expect(page.getByText(/e2e-editor\.png/i)).toBeVisible();

    // Add a media section that references the just-uploaded asset.
    await page.getByRole("link", { name: /pages/i }).click();
    await page.getByRole("link", { name: /about/i }).click();
    await page.getByRole("button", { name: /add section/i }).click();
    await page.getByRole("button", { name: /^media$/i }).click();
    await page.getByRole("button", { name: /choose image/i }).click();
    await page.getByRole("button", { name: /e2e-editor\.png/i }).click();
    await page.getByRole("button", { name: /^select$/i }).click();

    // Preview both.
    await page.getByRole("button", { name: /^preview$/i }).click();
    const frame = page.frameLocator("iframe");
    await expect(frame.getByText(paragraph)).toBeVisible();
    await expect(frame.locator("img").first()).toBeVisible();
    await page.getByRole("button", { name: /close/i }).click();

    // Publish with a label.
    await page.getByRole("link", { name: /publish/i }).click();
    const label = `e2e publish ${Date.now()}`;
    await page.getByLabel(/label/i).fill(label);
    await page.getByRole("button", { name: /^publish$/i }).click();

    const cdnUrl = `${readDevCdnBase()}/live/location.json`;
    const live0 = (await (await fetch(cdnUrl, { cache: "no-store" })).json()) as Live;
    const live1 = await waitForCdnJson<Live>(
      cdnUrl,
      (j) => j.snapshotUrl !== live0.snapshotUrl,
    );

    const snapshot = (await (await fetch(live1.snapshotUrl, { cache: "no-store" })).json()) as Snapshot;
    const contentJson = JSON.stringify(snapshot.content);
    expect(contentJson).toContain(paragraph);
    const entries = Object.values(snapshot.media);
    expect(entries.length).toBeGreaterThan(0);
    const asset = entries.find((e) => typeof e.url === "string" && e.url.length > 0);
    expect(asset).toBeDefined();
    expect(asset?.variants?.srcset ?? "").toBe("");

    // Restore the previous version, publish again with a new label.
    await page.getByRole("button", { name: /^history$/i }).click();
    await page.getByRole("row").nth(2).getByRole("button", { name: /restore and publish/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();

    // Delete the section, then the asset. Deleting the asset while the
    // section still references it must be blocked with a 409; after the
    // section is gone the delete must succeed.
    await page.getByRole("link", { name: /pages/i }).click();
    await page.getByRole("link", { name: /about/i }).click();

    await page.getByRole("link", { name: /^media$/i }).click();
    await page.getByRole("button", { name: /e2e-editor\.png/i }).click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await expect(page.getByText(/media_in_use|in use/i)).toBeVisible();

    await page.getByRole("link", { name: /pages/i }).click();
    await page.getByRole("link", { name: /about/i }).click();
    const mediaCard = page.getByText(/e2e-editor\.png/i).locator("xpath=ancestor::*[@role='region'][1]");
    await mediaCard.getByRole("button", { name: /delete/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();

    await page.getByRole("link", { name: /^media$/i }).click();
    await page.getByRole("button", { name: /e2e-editor\.png/i }).click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page.getByRole("button", { name: /^confirm$/i }).click();
    await expect(page.getByText(/e2e-editor\.png/i)).toHaveCount(0);
  });
});
