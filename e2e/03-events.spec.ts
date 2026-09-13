import { expect, test, type Page } from "@playwright/test";
import {
  deleteEvent,
  fetchAdminAccessToken,
  listEvents,
  readAdmin,
  readDevCdnBase,
  setEventCurrent,
  setEventStatus,
  signIn,
  waitForCdnJson,
} from "./helpers";

// Spec 3 (docs/admin.md § 9.3): create an event with inherit; set it
// current; walk planned → scheduled → live → ended through the
// confirmations; after each change `GET <dev cdn>/live/location.json`
// reports the new eventStatusId within 10 s.
//
// `afterAll` restores the event that was current when the spec started
// and deletes this run's event through `DELETE /admin/events/{id}`
// (contracts 4.5 Events), so the dev events list is unchanged whether
// the test passed, failed, or was interrupted.

type Live = { eventId: number | null; eventStatusId: number | null; publishedAt: string };

test.describe("events lifecycle", () => {
  test.setTimeout(180_000);

  let adminToken: string | null = null;
  let prevCurrentEventId: number | null = null;
  let createdEventId: number | null = null;

  test.beforeAll(async ({ browser }) => {
    adminToken = await fetchAdminAccessToken(browser);
    const events = await listEvents(adminToken);
    prevCurrentEventId = events.find((e) => e.isCurrent)?.id ?? null;
  });

  test.afterAll(async () => {
    if (adminToken === null) return;
    // Detach "current" from this run's event first (DELETE cascades but
    // does not run on a current event), then push it to `ended` in case
    // the test bailed while it was still live (`DELETE` answers
    // `409 event_live` at status 3), then remove the row.
    if (prevCurrentEventId !== null) {
      await setEventCurrent(adminToken, prevCurrentEventId).catch(() => undefined);
    }
    if (createdEventId !== null) {
      await setEventStatus(adminToken, createdEventId, 4).catch(() => undefined);
      await deleteEvent(adminToken, createdEventId).catch(() => undefined);
    }
  });

  test("create → current → planned → scheduled → live → ended, CDN follows", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    const cdnUrl = `${readDevCdnBase()}/live/location.json`;

    await page.getByRole("navigation").locator('a[href="/events"]').click();
    await page.getByRole("button", { name: /new event/i }).waitFor();
    // The standing walk event is always listed; wait for the rows before
    // reading them.
    await page.getByTestId(/^event-row-/).first().waitFor();

    // Events left behind by an interrupted run would collide on year (one
    // event per year); delete them before creating this run's event. A row's
    // text starts with its year, so the name pattern is not anchored.
    await deleteEventsNamed(page, /e2e event/);

    // One event per year, years 2000 to 2100; pick a year no row uses.
    const usedYears = new Set(
      (await page.getByTestId(/^event-row-/).locator("td:first-child").allTextContents()).map((t) => t.trim()),
    );
    let year = 2050;
    while (usedYears.has(String(year))) year += 1;

    const title = `e2e event ${Date.now()}`;
    await page.getByRole("button", { name: /new event/i }).click();
    await page.getByLabel(/^year$/i).fill(String(year));
    await page.getByLabel(/^name$/i).fill(title);
    await page.getByLabel(/inherit/i).check();
    await page.getByRole("button", { name: /^create$/i }).click();

    // Creating the event opens its detail page (`/events/{id}`); read
    // the id off the URL so `afterAll` can delete it through the API.
    await page.waitForURL(/\/events\/\d+$/);
    const match = /\/events\/(\d+)$/.exec(new URL(page.url()).pathname);
    createdEventId = match ? Number(match[1]) : null;

    await page.getByRole("button", { name: /^set current$/i }).click();
    await page
      .getByRole("dialog", { name: /set current event/i })
      .getByRole("button", { name: /^set current$/i })
      .click();

    await expect(page.getByRole("dialog")).toBeHidden();

    // Planned (status 1) is the initial state after "set current".
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 1);
    await expect(page.getByRole("button", { name: /^save$/i })).toBeVisible();

    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const iso = now.toISOString().slice(0, 16);
    await page.getByLabel(/scheduled at/i).fill(iso);
    await page.getByRole("button", { name: /^save$/i }).click();

    await page.getByRole("button", { name: /^scheduled$/i }).click();
    await changeWithoutNotifying(page);
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 2);

    await page.getByRole("button", { name: /^live$/i }).click();
    await changeWithoutNotifying(page);
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 3);

    await page.getByRole("button", { name: /^ended$/i }).click();
    await changeWithoutNotifying(page);
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 4);

    await expect(page.getByText(/ended/i).first()).toBeVisible();
  });
});

// Confirm the status change through StatusDialog's silent path (admin.md
// 6.3): press "Change without notifying", then confirm the nested
// dialog.
async function changeWithoutNotifying(page: Page): Promise<void> {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^change without notifying$/i })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^change without notifying$/i })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

// Delete every event row whose name matches, through the row's actions
// menu (Delete lives in the row menu per M19, admin.md 1) and its
// confirmation. Rows that are current cannot be deleted; callers hand
// "current" elsewhere first. Used only to clean up rows left behind by
// an interrupted earlier run; this run's own event is deleted through
// the API in `afterAll`.
async function deleteEventsNamed(page: Page, name: RegExp): Promise<void> {
  for (;;) {
    const row = page.getByTestId(/^event-row-/).filter({ hasText: name }).first();
    if ((await row.count()) === 0) return;
    const before = await page.getByTestId(/^event-row-/).count();
    await row.getByRole("button", { name: /^actions for/i }).click();
    await page.getByRole("menuitem", { name: /^delete$/i }).click();
    await page
      .getByRole("dialog", { name: /delete event/i })
      .getByRole("button", { name: /^delete$/i })
      .click();
    await expect(page.getByTestId(/^event-row-/)).toHaveCount(before - 1);
  }
}
