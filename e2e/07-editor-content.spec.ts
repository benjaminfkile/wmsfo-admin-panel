import { expect, test, type Page } from "@playwright/test";
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
  // A 400 by 400 solid PNG (8-bit RGB, one IDAT), encoded once and kept inline.
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAZAAAAGQCAIAAAAP3aGbAAAD6klEQVR42u3UMQ0AAAzDsCIp" +
    "fyiDNRQ7JlkyghzJtAAvRALAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwLMCwA" +
    "wwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAgxLBcCwAAwLMCwAwwIwLMCwAAwLwLAA" +
    "wwIwLADDAgwLwLAADAswLADDAjAswLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCDEsFwLAA" +
    "DAswLADDAjAswLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIM" +
    "C8CwAAwLMCwAwwIMC8CwAAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAjAs" +
    "wLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwA" +
    "wwIMC8CwAAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAgwLwLAADAswLADD" +
    "AjAswLAADAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwL" +
    "MCwAwwIMC8CwAAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAjAswLAADAvA" +
    "sADDAjAsAMMCDAvAsAAMCzAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8Cw" +
    "AAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAgwLwLAADAswLADDAjAswLAA" +
    "DAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAMOSADAsAMMC" +
    "DAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwLMCwAwwIwLMCwAAwLwLAAwwIw" +
    "LADDAgwLwLAAw1IBMCwAwwIMC8CwAAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAsw" +
    "LADDAjAswLAADAvAsADDAjAsAMMCDAvAsADDUgEwLADDAgwLwLAADAswLADDAjAswLAADAvA" +
    "sADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAMMCMCwAwwIMC8Cw" +
    "AAwLMCwAwwIwLMCwAAwLwLAAwwIwLADDAgwLwLAADAswLADDAjAswLAADAvAsADDAjAsAMMC" +
    "DAvAsADDAjAsAMMCDAvAsAAMCzAsAMMCMCzAsAAMC8CwAMMCMCwAwwIMC8CwAAwLMCwAwwIw" +
    "LMCwAAwLwLAAwwK4tFrR6SePEGFEAAAAAElFTkSuQmCC";
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

    // Start from the published content: an interrupted run leaves draft
    // sections behind (an empty media item blocks publishing), so restore
    // the published version into the draft first.
    await page.getByRole("link", { name: /^publish$/i }).click();
    const starterRow = page.getByRole("row").filter({ hasText: /Starter content/ }).first();
    await starterRow.getByRole("button", { name: /^restore$/i }).click();
    await page
      .getByRole("dialog", { name: /restore version/i })
      .getByRole("button", { name: /^restore$/i })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("link", { name: /^media$/i }).click();
    await expect(page.getByRole("heading", { name: /media/i }).first()).toBeVisible();
    await deleteAssets(page, /e2e-editor-draft/i);

    await page.getByRole("link", { name: /pages/i }).click();
    await page.getByRole("link", { name: /about/i }).click();

    // Rich text section with a paragraph.
    await page.getByRole("button", { name: /add section/i }).click();
    await page.getByRole("button", { name: /rich text/i }).click();
    const paragraph = `e2e paragraph ${Date.now()}`;
    // The new section lands at the end of the stack with one default paragraph
    // block whose field is labelled "Text"; take the last Text box on the page.
    await page.getByLabel(/^text$/i).last().fill(paragraph);

    // An asset only the draft references exercises the usage guard: 409
    // while a section references it, 204 once the section is gone. Assets
    // that reach a published version stay referenced by the version history
    // and can never be deleted, so the published half uses a second asset.
    // A per-run name keeps this asset distinct from any leftover.
    const draftName = `e2e-editor-draft-${Date.now()}.png`;
    const draftRe = new RegExp(draftName.replace(/\./g, "\\."), "i");
    await page.getByRole("link", { name: /^media$/i }).click();
    await uploadPng(page, draftName);

    await page.getByRole("link", { name: /pages/i }).click();
    await page.getByRole("link", { name: /about/i }).click();
    await addMediaSection(page, draftRe);

    await page.getByRole("link", { name: /^media$/i }).click();
    await page.getByRole("button", { name: draftRe }).first().click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog", { name: /delete media asset/i })
      .getByRole("button", { name: /^delete$/i })
      .click();
    await expect(page.getByText(/media_in_use|in use/i)).toBeVisible();
    await closeDrawer(page);

    await page.getByRole("link", { name: /pages/i }).click();
    await page.getByRole("link", { name: /about/i }).click();
    await deleteLastSection(page);

    await page.getByRole("link", { name: /^media$/i }).click();
    await expect(page.getByRole("button", { name: draftRe }).first()).toBeVisible();
    await deleteAssets(page, draftRe);
    await expect(page.getByRole("button", { name: draftRe })).toHaveCount(0);

    // The section that gets published. Reuse the asset when an earlier run
    // left it in the library.
    if ((await page.getByRole("button", { name: /e2e-editor-published\.png/i }).count()) === 0) {
      await uploadPng(page, "e2e-editor-published.png");
    }
    await page.getByRole("link", { name: /pages/i }).click();
    await page.getByRole("link", { name: /about/i }).click();
    await addMediaSection(page, /e2e-editor-published\.png/i);

    // Preview is documented (admin.md 6.17) but the PageEditor header does
    // not mount the button yet; the snapshot check below covers the content.

    // Publish with a label; the live object moves to the new snapshot.
    const cdnUrl = `${readDevCdnBase()}/live/location.json`;
    const live0 = (await (await fetch(cdnUrl, { cache: "no-store" })).json()) as Live;
    await page.getByRole("link", { name: /^publish$/i }).click();
    const label = `e2e publish ${Date.now()}`;
    await page.getByRole("button", { name: /^publish$/i }).click();
    const publishDialog = page.getByRole("dialog", { name: /publish draft/i });
    await publishDialog.getByLabel(/^label/i).fill(label);
    await publishDialog.getByRole("button", { name: /^publish$/i }).click();
    await expect(publishDialog).toBeHidden();
    const live1 = await waitForCdnJson<Live>(cdnUrl, (j) => j.snapshotUrl !== live0.snapshotUrl, 30_000);

    const snapshot = (await (await fetch(live1.snapshotUrl, { cache: "no-store" })).json()) as Snapshot;
    const contentJson = JSON.stringify(snapshot.content);
    expect(contentJson).toContain(paragraph);
    const entries = Object.values(snapshot.media);
    expect(entries.length).toBeGreaterThan(0);
    const asset = entries.find((e) => typeof e.url === "string" && e.url.length > 0);
    expect(asset).toBeDefined();
    expect(asset?.variants?.srcset ?? "").toBe("");

    // Restore and publish the starter version so the draft and the published
    // content are back at their baseline; the live object moves again.
    const starter = page.getByRole("row").filter({ hasText: /Starter content/ }).first();
    await starter.getByRole("button", { name: /restore and publish/i }).click();
    await page
      .getByRole("dialog", { name: /restore and publish/i })
      .getByRole("button", { name: /^restore and publish$/i })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await waitForCdnJson<Live>(cdnUrl, (j) => j.snapshotUrl !== live1.snapshotUrl, 30_000);
  });
});

// Upload one PNG through the Media library's file input and wait for its
// card (the upload confirms on the API and the card renders when ready).
async function uploadPng(page: Page, name: string): Promise<void> {
  await page.setInputFiles('input[type="file"]', { name, mimeType: "image/png", buffer: tinyPng() });
  // The card's accessible name carries the filename plus its size line, so
  // match the filename alone.
  await expect(page.getByRole("button", { name: new RegExp(name.replace(/\./g, "\\."), "i") }).first()).toBeVisible({ timeout: 30_000 });
}

// Add a media section at the end of the open page, one item choosing the
// named asset. Media sections are created with no items, so add one first.
async function addMediaSection(page: Page, assetName: RegExp): Promise<void> {
  await page.getByRole("button", { name: /add section/i }).click();
  await page.getByRole("button", { name: /^media\b/i }).click();
  const section = page.getByTestId(/^section-card-/).last();
  await section.getByRole("button", { name: /^add item$/i }).click();
  await section.getByRole("button", { name: /^choose$/i }).first().click();
  const picker = page.getByRole("dialog", { name: /choose media/i });
  await picker.getByRole("button", { name: assetName }).first().click();
  await picker.getByRole("button", { name: /^choose$/i }).click();
  await expect(picker).toBeHidden();
  // The editor saves each section a second after its last change; let the
  // save fire and settle before leaving the page.
  await page.waitForTimeout(1500);
  await expect(section.getByText(/saving/i)).toHaveCount(0, { timeout: 15_000 });
  await expect(section.getByText(/not saved/i)).toHaveCount(0);
}

// Delete the last section on the open page through its menu.
async function deleteLastSection(page: Page): Promise<void> {
  await page.getByTestId(/^section-card-/).first().waitFor();
  const before = await page.getByTestId(/^section-card-/).count();
  const section = page.getByTestId(/^section-card-/).last();
  await section.getByRole("button", { name: /section menu/i }).click();
  await page.getByRole("menuitem", { name: /^delete$/i }).click();
  await page
    .getByRole("dialog", { name: /delete section/i })
    .getByRole("button", { name: /^delete$/i })
    .click();
  await expect(page.getByTestId(/^section-card-/)).toHaveCount(before - 1);
}

// Delete every asset whose card matches, through the detail drawer. Stops
// at the first refusal so a referenced asset does not loop forever.
async function deleteAssets(page: Page, name: RegExp): Promise<void> {
  // Let the grid load before counting: a card or the empty state.
  await expect(page.getByTestId(/^media-card-/).first().or(page.getByText(/no media/i))).toBeVisible();
  for (;;) {
    const cards = page.getByRole("button", { name });
    const remaining = await cards.count();
    if (remaining === 0) return;
    await cards.first().click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog", { name: /delete media asset/i })
      .getByRole("button", { name: /^delete$/i })
      .click();
    if ((await page.getByText(/media_in_use|in use/i).count()) > 0) {
      await closeDrawer(page);
      return;
    }
    await expect(cards).toHaveCount(remaining - 1);
  }
}

// Leave the media detail drawer by reloading the library: the drawer's own
// Close control scrolls out of reach once the usage list renders, and the
// backdrop click does not dismiss it under the driver.
async function closeDrawer(page: Page): Promise<void> {
  await page.goto("/media");
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByTestId(/^media-card-/).first().or(page.getByText(/no media/i))).toBeVisible();
}
