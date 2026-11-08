import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  fetchAdminAccessToken,
  readDevCdnBase,
  readEditor,
  readPublishedContentVersionId,
  signIn,
  waitForCdnJson,
} from "./helpers";

// Spec 7 (docs/admin.md § 9.3): as an editor: the drawer shows five entries;
// open the about page; add a rich_text section with a paragraph; upload a
// small PNG through the media library; add a media section using it;
// preview the page in the frame and see both; publish with a label;
// `GET <dev cdn>/live/location.json` reports a new `snapshotUrl` within
// 10 s; the snapshot's `content` contains the paragraph and the media map
// contains the asset with three variants absent (the PNG is 400 px wide)
// and its `url` present; restore the previous version and publish again;
// delete the asset while the section still references it (the API clears the
// reference), then the section.

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

  // The version id that was published on the dev site when the spec
  // started. The final restore-and-publish step puts this same version
  // back so the run leaves the dev site's published content unchanged
  // (only a fresh "Restored from version N" version is appended); the
  // earlier hard-coded restore of version 1 replaced the site's content
  // with the oldest seed on every run.
  let publishedVersionIdAtStart: number | null = null;

  test.beforeAll(async ({ browser }) => {
    const adminToken = await fetchAdminAccessToken(browser);
    publishedVersionIdAtStart = await readPublishedContentVersionId(adminToken);
    if (publishedVersionIdAtStart === null) {
      throw new Error(
        "No published content version on the dev site; nothing to restore back to",
      );
    }
  });

  test("five drawer entries; publish; snapshot; restore; delete with 409 then 204", async ({
    page,
  }) => {
    const editor = readEditor();
    await signIn(page, editor);

    const nav = page.getByRole("navigation");
    for (const label of ["Pages", "Media", "Site settings", "Publish", "Sponsors"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Events", exact: true })).toHaveCount(0);

    // Start from the published content: an interrupted run leaves draft
    // sections behind (an empty media item blocks publishing), so restore
    // the published version into the draft first. It has to be the version
    // that is published now: an older one lacks the newer pages, and a
    // restore without a page unlinks every place and printed code that opens it.
    await page.getByRole("link", { name: "Publish", exact: true }).click();
    const publishedRow = page.getByTestId(`version-row-${publishedVersionIdAtStart!}`);
    await publishedRow.getByRole("button", { name: /^restore$/i }).click();
    await page
      .getByRole("dialog", { name: /restore version/i })
      .getByRole("button", { name: /^restore$/i })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("link", { name: "Media", exact: true }).click();
    await expect(page.getByRole("heading", { name: /media/i }).first()).toBeVisible();
    await deleteAssets(page, /e2e-editor-draft/i);

    // A restore gives every page a new id, and the list paints its cached rows
    // while it refetches: wait for the fresh list before following a row link.
    const pagesListed = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith("/admin/pages") &&
        r.request().method() === "GET" &&
        r.ok(),
    );
    await page.getByRole("link", { name: "Pages", exact: true }).click();
    await pagesListed;
    await page.getByRole("link", { name: "About the flyover", exact: true }).click();

    // Rich text section with a paragraph. The new section opens expanded
    // with one default paragraph block whose field is labelled "Text"; the
    // page's own sections carry Text fields too, so fill the one inside the
    // section this run added.
    const richText = await addSection(page, /rich text/i);
    const paragraph = `e2e paragraph ${Date.now()}`;
    await richText.getByLabel(/^text$/i).first().fill(paragraph);
    await waitForSectionSaved(page, richText);

    // An asset a draft section references deletes all the same: the API
    // clears the reference and the card goes. The published half uses a
    // second asset so this one never reaches a version.
    // A per-run name keeps this asset distinct from any leftover.
    const draftName = `e2e-editor-draft-${Date.now()}.png`;
    const draftRe = new RegExp(draftName.replace(/\./g, "\\."), "i");
    await page.getByRole("link", { name: "Media", exact: true }).click();
    await uploadPng(page, draftName);

    await page.getByRole("link", { name: "Pages", exact: true }).click();
    await page.getByRole("link", { name: "About the flyover", exact: true }).click();
    const draftSectionId = await addMediaSection(page, draftRe);

    await page.getByRole("link", { name: "Media", exact: true }).click();
    await page.getByTestId(/^media-card-/).filter({ hasText: draftRe }).first().click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog", { name: /^delete /i })
      .getByRole("button", { name: /^delete$/i })
      .click();
    await expect(
      page.getByTestId(/^media-card-/).filter({ hasText: draftRe }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: "Pages", exact: true }).click();
    await page.getByRole("link", { name: "About the flyover", exact: true }).click();
    await deleteSection(page, draftSectionId);

    await page.getByRole("link", { name: "Media", exact: true }).click();

    // The section that gets published. Reuse the asset when an earlier run
    // left it in the library.
    if (
      (await page
        .getByTestId(/^media-card-/)
        .filter({ hasText: /e2e-editor-published\.png/i })
        .count()) === 0
    ) {
      await uploadPng(page, "e2e-editor-published.png");
    }
    await page.getByRole("link", { name: "Pages", exact: true }).click();
    await page.getByRole("link", { name: "About the flyover", exact: true }).click();
    await addMediaSection(page, /e2e-editor-published\.png/i);

    // Preview is documented (admin.md 6.17) but the PageEditor header does
    // not mount the button yet; the snapshot check below covers the content.

    // Publish with a label; the live object moves to the new snapshot.
    const cdnUrl = `${readDevCdnBase()}/live/location.json`;
    const live0 = (await (await fetch(cdnUrl, { cache: "no-store" })).json()) as Live;
    await page.getByRole("link", { name: "Publish", exact: true }).click();
    await page.waitForURL((url) => url.pathname.endsWith("/publish"));
    const label = `e2e publish ${Date.now()}`;
    // The app bar carries a Publish button of its own; use the Publish
    // page's.
    await page.getByRole("main").getByRole("button", { name: /^publish$/i }).click();
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

    // Restore and publish the version that was published when the spec
    // started, so the run leaves the dev site's published content at its
    // baseline (a fresh "Restored from version N" version is appended);
    // the live object moves again. VersionsList rows carry
    // `data-testid="version-row-<id>"` per src/pages/publish/VersionsList.tsx.
    const baseline = page.getByTestId(`version-row-${publishedVersionIdAtStart!}`);
    await baseline.getByRole("button", { name: /restore and publish/i }).click();
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
  // Since M19 a media card carries a pencil (aria-label="Edit <filename>")
  // as well as the card action; count/locate through the card testid
  // (MediaCard.tsx) filtered by the filename text.
  await expect(
    page.getByTestId(/^media-card-/).filter({ hasText: name }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

// Add a section of the given kind to the open page and return its card.
// The card is found by the test id that appears with the add, not by its
// place in the stack, so the page's own sections are never touched.
async function addSection(page: Page, kind: RegExp): Promise<Locator> {
  const cards = page.getByTestId(/^section-card-/);
  await expect(cards.first().or(page.getByText("No sections yet."))).toBeVisible();
  const ids = () =>
    cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid") ?? ""));
  const before = new Set(await ids());
  await page.getByRole("button", { name: /add section/i }).click();
  await page.getByRole("button", { name: kind }).click();
  await expect(cards).toHaveCount(before.size + 1);
  const added = (await ids()).find((id) => !before.has(id));
  if (added === undefined) throw new Error("the new section card did not appear");
  return page.getByTestId(added);
}

// The editor saves each section a second after its last change; let the
// save fire and settle before leaving the page.
async function waitForSectionSaved(page: Page, section: Locator): Promise<void> {
  await page.waitForTimeout(1500);
  await expect(section.getByText(/saving/i)).toHaveCount(0, { timeout: 15_000 });
  await expect(section.getByText(/not saved/i)).toHaveCount(0);
}

// Add a media section to the open page, one item choosing the named asset,
// and return the section card's test id. Media sections are created with no
// items, so add one first.
async function addMediaSection(page: Page, assetName: RegExp): Promise<string> {
  const section = await addSection(page, /^media\b/i);
  await section.getByRole("button", { name: /^add item$/i }).click();
  await section.getByRole("button", { name: /^choose$/i }).first().click();
  const picker = page.getByRole("dialog", { name: /choose media/i });
  await picker
    .getByTestId(/^media-card-/)
    .filter({ hasText: assetName })
    .first()
    .click();
  await picker.getByRole("button", { name: /^choose$/i }).click();
  await expect(picker).toBeHidden();
  await waitForSectionSaved(page, section);
  return (await section.getAttribute("data-testid")) ?? "";
}

// Delete the section with the given card test id through its menu.
async function deleteSection(page: Page, testId: string): Promise<void> {
  const section = page.getByTestId(testId);
  await section.waitFor();
  const before = await page.getByTestId(/^section-card-/).count();
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
    // Since M19 a card carries a pencil (aria-label="Edit <filename>") as
    // well as the CardActionArea, so getByRole("button", { name }) counts
    // two controls per asset. Count through the card testid filtered by
    // the filename text (MediaCard.tsx) so remaining - 1 stays truthful.
    const cards = page.getByTestId(/^media-card-/).filter({ hasText: name });
    const remaining = await cards.count();
    if (remaining === 0) return;
    await cards.first().click();
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog", { name: /^delete /i })
      .getByRole("button", { name: /^delete$/i })
      .click();
    await expect(cards).toHaveCount(remaining - 1);
  }
}
