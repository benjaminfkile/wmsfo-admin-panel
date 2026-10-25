import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import LocationsSection from "./LocationsSection";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import { HelpHarness, signInAs, stubMatchMedia } from "../../test/helpHarness";

const EVENT = f.events[0]!;

function renderSection() {
  const um = signInAs("admin");
  render(
    <HelpHarness userManager={um}>
      <LocationsSection event={EVENT} />
    </HelpHarness>
  );
}

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
  server.resetHandlers();
});

describe("LocationsSection (admin.md 6.3)", () => {
  it("shows the eight columns with speed and heading and their sources on desktop", async () => {
    restore = stubMatchMedia(false);
    renderSection();
    const derived = await screen.findByTestId("location-1832");
    const table = derived.closest("table")!;
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual([
      "seq",
      "beaconId",
      "published",
      "recordedAt",
      "lat",
      "lng",
      "Speed",
      "Heading",
    ]);
    const cells = (seq: number) =>
      within(screen.getByTestId(`location-${seq}`))
        .getAllByRole("cell")
        .map((c) => c.textContent);
    expect(cells(1832).slice(6)).toEqual(["31.2 m/sderived", "84°derived"]);
    expect(cells(1831).slice(6)).toEqual(["28.8 m/sbeacon", "92°beacon"]);
    expect(cells(1830).slice(6)).toEqual(["none", "none"]);
    expect(within(derived).getAllByText("derived")).toHaveLength(2);
  });

  it("shows speed and heading with their sources on the phone cards", async () => {
    restore = stubMatchMedia(true);
    renderSection();
    const card = await screen.findByTestId("location-1831");
    expect(card.tagName).not.toBe("TR");
    expect(card).toHaveTextContent("Speed: 28.8 m/sbeacon");
    expect(card).toHaveTextContent("Heading: 92°beacon");
    const empty = screen.getByTestId("location-1830");
    expect(empty).toHaveTextContent("Speed: none");
    expect(empty).toHaveTextContent("Heading: none");
    expect(within(empty).queryByText(/^(beacon|derived)$/)).toBeNull();
  });
});
