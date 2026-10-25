import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import EventCloneDialog from "./EventCloneDialog";
import type { CloneEventBody } from "../../api/resources/events";
import type { Event, TrackerMap } from "../../api/types";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

// Without the Maps key the box editor shows its fields alone.
const config = { ...testConfig, googleMapsKey: "" };

vi.setConfig({ testTimeout: 15_000 });

const FLATHEAD: TrackerMap = {
  ...f.trackerMaps[0]!,
  id: 3,
  name: "Flathead",
  prefix: "maps/3",
  bbox: { west: -114.6, south: 47.7, east: -113.9, north: 48.4 },
  terrainUrl: null,
  terrainBytes: null,
  terrainMaxZoom: null,
};

// The source: the valley map with a box inside it.
const SOURCE: Event = f.events[0]!;
const SOURCE_BOX = { west: -114.3, south: 46.75, east: -113.8, north: 47.05 };

beforeEach(() => {
  installClient({
    config,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${config.apiBaseUrl}/admin/maps`, () =>
      HttpResponse.json({ items: [f.trackerMaps[0], FLATHEAD, f.trackerMaps[1]] })
    )
  );
});

function renderDialog(onSubmit: (b: CloneEventBody) => void, source: Event = SOURCE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider config={config}>
      <QueryClientProvider client={client}>
        <ThemeProvider theme={buildTheme("light")}>
          <CssBaseline />
          <NotifyProvider>
            <EventCloneDialog
              open
              source={source}
              submitting={false}
              error={null}
              onCancel={() => undefined}
              onSubmit={onSubmit}
            />
          </NotifyProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
}

function field(side: string): HTMLInputElement {
  return screen.getByTestId(`bbox-${side}`) as HTMLInputElement;
}

function mapSelect(): HTMLElement {
  return screen.getByRole("combobox", { name: /^map$/i });
}

describe("EventCloneDialog: the map choice", () => {
  it("starts on the source's map and box, with Tracker themes and its caption", async () => {
    renderDialog(vi.fn());
    await waitFor(() => expect(mapSelect()).toHaveTextContent("Missoula valley"));
    expect(field("west").value).toBe("-114.3000");
    expect(field("north").value).toBe("47.0500");
    expect(screen.getByRole("checkbox", { name: /^tracker themes$/i })).toBeChecked();
    expect(screen.getByText("The map and the area are chosen above.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /tracker map/i })).toBeNull();
  });

  it("sends trackerMapId and trackerBbox beside copy", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    await waitFor(() => expect(mapSelect()).toHaveTextContent("Missoula valley"));
    await user.click(screen.getByRole("button", { name: /^clone$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toEqual({
      year: Number(SOURCE.year) + 1,
      name: "Santa Flyover 2027",
      copy: { sponsors: true, tracker: true },
      trackerMapId: 1,
      trackerBbox: SOURCE_BOX,
    });
  });

  it("a different map resets the box to its area and lands on the body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    await waitFor(() => expect(mapSelect()).toHaveTextContent("Missoula valley"));
    await user.click(mapSelect());
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "No map",
      "FlatheadNo terrain",
      "Missoula valleyWith terrain",
    ]);
    await user.click(within(listbox).getByRole("option", { name: /Flathead/ }));
    expect(field("west").value).toBe("-114.6000");
    expect(field("north").value).toBe("48.4000");
    await user.click(screen.getByRole("checkbox", { name: /^tracker themes$/i }));
    await user.click(screen.getByRole("button", { name: /^clone$/i }));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      copy: { sponsors: true, tracker: false },
      trackerMapId: 3,
      trackerBbox: FLATHEAD.bbox,
    });
  });

  it("No map keeps the source's box and sends null", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    await waitFor(() => expect(mapSelect()).toHaveTextContent("Missoula valley"));
    await user.click(mapSelect());
    await user.click(await screen.findByRole("option", { name: "No map" }));
    expect(field("west").value).toBe("-114.3000");
    await user.click(screen.getByRole("button", { name: /^clone$/i }));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      trackerMapId: null,
      trackerBbox: SOURCE_BOX,
    });
  });

  it("starts on No map when the source has none", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit, { ...SOURCE, trackerMapId: null });
    await screen.findByRole("button", { name: "Use site default" });
    expect(mapSelect()).toHaveTextContent("No map");
    await user.click(screen.getByRole("button", { name: /^clone$/i }));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      trackerMapId: null,
      trackerBbox: SOURCE_BOX,
    });
  });
});
