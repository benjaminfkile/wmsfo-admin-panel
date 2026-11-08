import { expect, test } from "@playwright/test";
import {
  activateBeacon,
  changeWithoutNotifying,
  fetchAdminAccessToken,
  listBeacons,
  postBeaconHeartbeat,
  postRunFix,
  readAdmin,
  readDevCdnBase,
  setEventCurrent,
  setEventStatus,
  setUpWalk,
  signIn,
  startRunFixes,
  tearDownWalk,
  waitForCdnJson,
  type WalkFixture,
} from "./helpers";

// Spec 5a (docs/admin.md § 9.3): going live is refused while the active
// beacon is stale. The go-live gate is fleet-wide: the panel reads
// `GET /admin/beacons` and blocks status 3 while whichever beacon is
// `isActive` reports unhealthy. The spec brings what it needs:
// `setUpWalk` records the current event and the active beacon, finds or
// creates the walk event (year 2100), and enrolls a beacon for the run
// (never heartbeated, so it starts stale). The walk is made current and
// planned and the run's beacon active; `tearDownWalk` restores both,
// revokes the run's beacon, and deletes the walk event when this run
// created it, so the dev stack ends the run where it started.

type Live = { eventStatusId: number | null };

test.describe("go-live gate refuses status 3 without a healthy active beacon", () => {
  let fixture: WalkFixture | null = null;

  test.beforeAll(async ({ browser }) => {
    const adminToken = await fetchAdminAccessToken(browser);
    fixture = await setUpWalk(adminToken);
    // The walk must be current and planned before the panel offers the
    // status walk, and the go-live gate reads whichever beacon is
    // `isActive`, so this spec pins both.
    await setEventCurrent(adminToken, fixture.walk.id);
    if (Number(fixture.walk.statusId) !== 1) {
      await setEventStatus(adminToken, fixture.walk.id, 1);
    }
    await activateBeacon(adminToken, fixture.beacon.id);
  });

  test.afterAll(async () => {
    if (fixture !== null) await tearDownWalk(fixture);
  });

  test("Live is disabled with the reason until the beacon posts a heartbeat", async ({ page }) => {
    if (fixture === null) throw new Error("walk fixture not set up");
    const adminToken = fixture.token;
    const admin = readAdmin();
    await signIn(page, admin);

    // Set the walk scheduled from the events UI so the Live button
    // becomes eligible except for the healthy-beacon gate. M19 dropped
    // the row's Open link; the edit pencil ("Edit <name>") is the
    // discoverable control now.
    await page.getByRole("navigation").locator('a[href="/events"]').click();
    const walkRow = page.getByTestId(`event-row-${fixture.walk.id}`);
    await walkRow.getByRole("link", { name: `Edit ${fixture.walk.name}` }).click();

    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const iso = now.toISOString().slice(0, 16);
    await page.getByLabel(/scheduled at/i).fill(iso);
    // The detail page has two Save buttons (event details and the tracker
    // map); the schedule belongs to the details card.
    await page
      .getByTestId("event-details-actions")
      .getByRole("button", { name: /^save$/i })
      .click();

    // Bump into scheduled so status 3 is the only remaining gate.
    await page.getByRole("button", { name: /^scheduled$/i }).click();
    await changeWithoutNotifying(page);

    const liveBtn = page.getByRole("button", { name: /^live$/i });

    // The run's beacon was enrolled in `beforeAll` and has never posted a
    // heartbeat, so the active beacon is stale and Live carries the reason.
    await expect(liveBtn).toBeDisabled();
    const wrapper = liveBtn.locator("xpath=..");
    // MUI's Tooltip lifts the title onto the wrapping span as aria-label.
    await expect(wrapper).toHaveAttribute(
      "aria-label",
      /No healthy active beacon/,
    );

    // Post a heartbeat as the run's beacon and let the panel's poll pick
    // it up. Once the beacons query shows `healthy`, the button opens.
    await postBeaconHeartbeat(fixture.beacon.key);
    // From here the run beacon posts a fix every 5 s, so once the walk is
    // live the dev no-location alarm sees locations.
    startRunFixes(fixture.beacon);

    // Confirm the heartbeat landed on the beacon the spec activated: read
    // the beacons list and assert the active beacon is that same one and
    // now `healthy`.
    const afterHeartbeat = await listBeacons(adminToken);
    const activeAfter = afterHeartbeat.items.find((b) => b.isActive);
    if (activeAfter === undefined || activeAfter.id !== fixture.beacon.id) {
      throw new Error(
        `Active beacon after heartbeat is ${activeAfter?.id ?? "none"}, expected the run's beacon ${fixture.beacon.id}`,
      );
    }
    if (activeAfter.healthy !== true) {
      throw new Error(
        `Active beacon ${activeAfter.id} did not turn healthy on the read after the heartbeat`,
      );
    }

    // Give the panel's 5 s beacons refetch a 30 s window to catch the
    // healthy read; if it still shows disabled, include the tooltip
    // wrapper's aria-label in the failure so the reason is visible.
    // Nudge the react-query focus manager on every check so the panel's
    // refetch-on-visible catches the healthy read without waiting on the
    // background poll cadence.
    const wrapperAfter = liveBtn.locator("xpath=..");
    const deadline = Date.now() + 30_000;
    let lastLabel = "";
    for (;;) {
      if (!(await liveBtn.isDisabled())) break;
      lastLabel = (await wrapperAfter.getAttribute("aria-label")) ?? "";
      if (Date.now() >= deadline) {
        throw new Error(
          `Live stayed disabled after heartbeat within 30 s; tooltip: ${lastLabel}`,
        );
      }
      await page.evaluate(() =>
        window.dispatchEvent(new Event("visibilitychange")),
      );
      await page.waitForTimeout(1_000);
    }

    await liveBtn.click();
    await changeWithoutNotifying(page);
    await postRunFix(fixture.beacon);
    await waitForCdnJson<Live>(
      `${readDevCdnBase()}/live/location.json`,
      (j) => j.eventStatusId === 3,
    );
  });
});
