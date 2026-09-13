import { expect, test } from "@playwright/test";
import {
  fetchAdminAccessToken,
  postWalkBeaconHeartbeat,
  readAdmin,
  readDevCdnBase,
  setWalkEventStatus,
  signIn,
  waitForCdnJson,
} from "./helpers";

// Spec 5a (docs/admin.md § 9.3): going live is refused while the e2e beacon
// is stale. The Live button carries the go-live gate's reason until the
// harness posts a heartbeat for its beacon, then the walk proceeds.

type Live = { eventStatusId: number | null };

test.describe("go-live gate refuses status 3 without a healthy active beacon", () => {
  let adminToken: string | null = null;

  test.beforeAll(async ({ browser }) => {
    adminToken = await fetchAdminAccessToken(browser);
    // The walk must be current and scheduled before the panel offers a Live
    // button. Start from a known state.
    await setWalkEventStatus(adminToken, 1);
  });

  test.afterAll(async () => {
    if (adminToken === null) return;
    await setWalkEventStatus(adminToken, 4).catch(() => undefined);
  });

  test("Live is disabled with the reason until the beacon posts a heartbeat", async ({ page }) => {
    const admin = readAdmin();
    await signIn(page, admin);

    // Set the walk scheduled and current from the events UI so the Live
    // button becomes eligible except for the healthy-beacon gate.
    await page.getByRole("navigation").locator('a[href="/events"]').click();
    const walkRow = page
      .getByTestId(/^event-row-/)
      .filter({ hasText: /E2E walk/i })
      .first();
    await walkRow.getByRole("link", { name: /^open$/i }).click();

    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const iso = now.toISOString().slice(0, 16);
    await page.getByLabel(/scheduled at/i).fill(iso);
    await page.getByRole("button", { name: /^save$/i }).click();

    // Bump into scheduled so status 3 is the only remaining gate.
    await page.getByRole("button", { name: /^scheduled$/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^change status$/i })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // The Live status button is disabled while no beacon is healthy, and
    // its tooltip carries the reason from the beacons query. The panel
    // renders the reason as "No healthy active beacon: <reason>".
    const liveBtn = page.getByRole("button", { name: /^live$/i });
    await expect(liveBtn).toBeDisabled();
    const wrapper = liveBtn.locator("xpath=..");
    // MUI's Tooltip lifts the title onto the wrapping span as aria-label.
    await expect(wrapper).toHaveAttribute(
      "aria-label",
      /No healthy active beacon/,
    );

    // Post a heartbeat as the walk beacon and let the panel's poll pick it
    // up. Once the beacons query shows `healthy`, the button opens.
    await postWalkBeaconHeartbeat();

    await expect
      .poll(async () => await liveBtn.isDisabled(), {
        timeout: 20_000,
        intervals: [1_000],
      })
      .toBe(false);

    await liveBtn.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^set live$/i })
      .click();
    await waitForCdnJson<Live>(
      `${readDevCdnBase()}/live/location.json`,
      (j) => j.eventStatusId === 3,
    );
  });
});
