import { expect, test } from "@playwright/test";
import {
  activateRunBeacon,
  adminApi,
  changeWithoutNotifying,
  deleteEvent,
  enrollRunBeacon,
  fetchAdminAccessToken,
  listEvents,
  postRunFix,
  readAdmin,
  readDevCdnBase,
  releaseRunBeacon,
  restoreCurrentEvent,
  setEventStatus,
  signIn,
  waitForCdnJson,
  type RunBeacon,
} from "./helpers";

// Spec 3 (docs/admin.md § 9.3): create an event; set it current; walk
// planned → scheduled → live → ended through the confirmations; after each change `GET <dev cdn>/live/location.json`
// reports the new eventStatusId within 10 s.
//
// The spec brings what it needs: `beforeAll` removes events an interrupted
// run left behind (named "e2e event ..."), records the current event, and
// enrolls a run beacon, which is made active and heartbeated before Live so
// the go-live gate admits status 3. `afterAll` puts "current" back (to the
// event that was current, or to none), deletes this run's event through
// `DELETE /admin/events/{id}` (contracts 4.5 Events), and releases the run
// beacon, so the dev stack is unchanged whether the test passed, failed, or
// was interrupted.

type Live = { eventId: number | null; eventStatusId: number | null; publishedAt: string };

const RUN_EVENT_NAME = /^e2e event \d+$/;

test.describe("events lifecycle", () => {
  test.setTimeout(180_000);

  let adminToken: string | null = null;
  let prevCurrentEventId: number | null = null;
  let createdEventId: number | null = null;
  let beacon: RunBeacon | null = null;

  test.beforeAll(async ({ browser }) => {
    const token = await fetchAdminAccessToken(browser);
    adminToken = token;
    // Events left behind by an interrupted run would collide on year (one
    // event per year) and may still hold "current"; detach, end, and delete
    // them before recording what was current.
    for (const e of await listEvents(token)) {
      if (!RUN_EVENT_NAME.test(e.name)) continue;
      if (e.isCurrent) {
        await adminApi(token, "DELETE", `/admin/events/${e.id}/current`);
      }
      if (Number(e.statusId) === 3) await setEventStatus(token, e.id, 4);
      await deleteEvent(token, e.id);
    }
    prevCurrentEventId = (await listEvents(token)).find((e) => e.isCurrent)?.id ?? null;
    beacon = await enrollRunBeacon(token);
  });

  test.afterAll(async () => {
    if (adminToken === null) return;
    const quiet = (p: Promise<unknown>) => p.catch(() => undefined);
    // Push this run's event to `ended` in case the test bailed while it was
    // still live (`DELETE` answers `409 event_live` at status 3), hand
    // "current" back (DELETE does not run on a current event), then remove
    // the row.
    if (createdEventId !== null) {
      await quiet(setEventStatus(adminToken, createdEventId, 4));
    }
    await quiet(restoreCurrentEvent(adminToken, prevCurrentEventId));
    if (createdEventId !== null) {
      await quiet(deleteEvent(adminToken, createdEventId));
    }
    if (beacon !== null) await releaseRunBeacon(beacon);
  });

  test("create → current → planned → scheduled → live → ended, CDN follows", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    const cdnUrl = `${readDevCdnBase()}/live/location.json`;

    await page.getByRole("navigation").locator('a[href="/events"]').click();
    await page.getByRole("button", { name: /new event/i }).waitFor();
    // Past flyovers are always listed; wait for the rows before reading
    // them.
    await page.getByTestId(/^event-row-/).first().waitFor();

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
    // The detail page has two Save buttons (event details and the tracker
    // map); the schedule belongs to the details card.
    const detailsSave = page
      .getByTestId("event-details-actions")
      .getByRole("button", { name: /^save$/i });
    await expect(detailsSave).toBeVisible();

    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const iso = now.toISOString().slice(0, 16);
    await page.getByLabel(/scheduled at/i).fill(iso);
    await detailsSave.click();

    await page.getByRole("button", { name: /^scheduled$/i }).click();
    await changeWithoutNotifying(page);
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 2);

    // The go-live gate needs a healthy active beacon: make the run's beacon
    // active, post a heartbeat, and wait for the panel's beacons poll to
    // enable Live.
    await activateRunBeacon(beacon!);
    const live = page.getByRole("button", { name: /^live$/i });
    await expect(live).toBeEnabled({ timeout: 30_000 });
    await live.click();
    await changeWithoutNotifying(page);
    await postRunFix(beacon!);
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 3);

    await page.getByRole("button", { name: /^ended$/i }).click();
    await changeWithoutNotifying(page);
    await waitForCdnJson<Live>(cdnUrl, (j) => j.eventStatusId === 4);

    await expect(page.getByText(/ended/i).first()).toBeVisible();
  });
});
