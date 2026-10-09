import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CssBaseline, ThemeProvider } from "@mui/material";
import EventCreateDialog from "./EventCreateDialog";
import type { CreateEventBody } from "../../api/resources/events";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildTheme } from "../../theme/theme";
import { formatStamp } from "../../lib/time";
import { http, HttpResponse } from "msw";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import type { Event } from "../../api/types";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

// Without the Maps key the box editor shows its fields alone.
const config = { ...testConfig, googleMapsKey: "" };

vi.setConfig({ testTimeout: 15_000 });

// The browser zone comes from Intl's resolved options; pin it so the
// default is predictable.
beforeEach(() => {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: "America/Denver" };
    }
  );
  installClient({
    config,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderDialog(
  onSubmit: (b: CreateEventBody) => void,
  events: Event[] = []
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ConfigProvider config={config}>
      <QueryClientProvider client={client}>
        <ThemeProvider theme={buildTheme("light")}>
          <CssBaseline />
          <NotifyProvider>
            <EventCreateDialog
              open
              events={events}
              routes={[]}
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

const SITE_BOX = { west: -114.2, south: 46.8, east: -113.9, north: 47.0 };

function withSiteBox() {
  server.use(
    http.get(`${config.apiBaseUrl}/admin/site-settings`, () =>
      HttpResponse.json({
        ...f.siteSettingsDraft,
        data: { ...(f.siteSettingsDraft.data as Record<string, unknown>), tracker: { defaultBbox: SITE_BOX } },
      })
    )
  );
}

function field(side: string): HTMLInputElement {
  return screen.getByTestId(`bbox-${side}`) as HTMLInputElement;
}

describe("EventCreateDialog: Tracker area", () => {
  it("prefills the box from the settings draft and sends it as trackerBbox", async () => {
    withSiteBox();
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    expect(screen.getByTestId("help-events.create.bbox")).toBeInTheDocument();
    expect(screen.getByText("Tracker area")).toBeInTheDocument();
    await waitFor(() => expect(field("west").value).toBe("-114.2000"));
    expect(field("north").value).toBe("47.0000");

    await user.type(screen.getByLabelText(/^name/i), "Area flight");
    await user.click(screen.getByLabelText(/no route/i));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.trackerBbox).toEqual(SITE_BOX);
    expect(body).toMatchObject({ inheritRoute: false, routeId: null });
  });

  it("shows the Missoula valley box without a tracker key, and Use site default puts it back", async () => {
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    await screen.findByText(/will use every theme/i);
    expect(field("west").value).toBe("-114.7500");
    expect(field("south").value).toBe("46.3500");
    expect(field("east").value).toBe("-113.3000");
    expect(field("north").value).toBe("47.2500");

    fireEvent.change(field("west"), { target: { value: "-114.5" } });
    expect(field("west").value).toBe("-114.5");
    fireEvent.click(screen.getByRole("button", { name: "Use site default" }));
    expect(field("west").value).toBe("-114.7500");
  });

  it("disables Create while the box breaks a rule", async () => {
    renderDialog(vi.fn());
    await screen.findByText(/will use every theme/i);
    fireEvent.change(field("east"), { target: { value: "-115" } });
    expect(screen.getByText("West must be less than east")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("names the map and themes the new event copies, following the box", async () => {
    renderDialog(vi.fn(), f.events);
    const line = await screen.findByTestId("tracker-preview");
    await waitFor(() =>
      expect(line).toHaveTextContent(
        "Will use the map Missoula valley and the themes Route light, Route dark from Santa Flyover 2026"
      )
    );
    // A box past the map's package drops the map.
    fireEvent.change(field("west"), { target: { value: "-116" } });
    expect(line).toHaveTextContent(
      "Will use no map (the map of Santa Flyover 2026 does not cover this area) and the themes Route light, Route dark from Santa Flyover 2026"
    );
  });

  it("says every theme and the Missoula valley map with no event", async () => {
    renderDialog(vi.fn());
    expect(await screen.findByTestId("tracker-preview")).toHaveTextContent(
      "Will use every theme, and the Missoula valley map when it covers this area"
    );
  });
});

describe("EventCreateDialog: timezone", () => {
  it("defaults the zone to the browser zone and reads the scheduled time in it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    expect(screen.getByTestId("help-events.create")).toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: /timezone/i })).toHaveValue(
      "America/Denver"
    );
    await user.type(screen.getByLabelText(/^name/i), "Night flight");
    fireEvent.change(screen.getByLabelText(/scheduled at/i), {
      target: { value: "2026-11-01T01:30" },
    });
    await user.click(screen.getByLabelText(/no route/i));
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.scheduledAt).toBe("2026-11-01T07:30:00.000Z");
    expect(body.scheduleTimeZone).toBe("America/Denver");
  });

  it("sends the picked zone and converts the wall time through it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);

    const zone = screen.getByRole("combobox", { name: /timezone/i });
    await user.click(zone);
    await user.clear(zone);
    await user.type(zone, "Asia/Tok");
    await user.click(await screen.findByRole("option", { name: "Asia/Tokyo" }));
    expect(zone).toHaveValue("Asia/Tokyo");

    await user.type(screen.getByLabelText(/^name/i), "Tokyo flight");
    fireEvent.change(screen.getByLabelText(/scheduled at/i), {
      target: { value: "2026-12-24T19:00" },
    });
    // The helper text shows the instant in the viewer's zone.
    expect(
      screen.getByText(formatStamp("2026-12-24T10:00:00.000Z"))
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText(/no route/i));
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.scheduledAt).toBe("2026-12-24T10:00:00.000Z");
    expect(body.scheduleTimeZone).toBe("Asia/Tokyo");
  });
});
