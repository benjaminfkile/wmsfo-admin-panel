// admin.md 6.27, 9.2: the Maps page lists the tile packages with their
// area, state, and lines, renames through PATCH, deletes through the
// `maps` impact preview with the optional Replace with select, and opens
// the build guide; it never offers an upload.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MapsList from "./MapsList";
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
import { HelpHarness, signInAs } from "../../test/helpHarness";

function Harness() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ConfigProvider config={testConfig}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/maps"]}>
            <NotifyProvider>
              <MapsList />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  return () => {
    if (original === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).matchMedia;
    } else {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: original,
      });
    }
  };
}

beforeEach(() => {
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  server.resetHandlers();
});

const API = testConfig.apiBaseUrl;
const missoula = f.trackerMaps[0]!;
const pending = f.trackerMaps[1]!;
const flathead = {
  ...missoula,
  id: 3,
  name: "Flathead",
  packageKey: "flathead",
  prefix: "maps/flathead",
};

async function openMenuItem(mapId: number, item: RegExp) {
  const user = userEvent.setup();
  const row = await screen.findByTestId(`map-row-${mapId}`);
  await user.click(within(row).getByRole("button", { name: /actions for/i }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
  return user;
}

describe("MapsList", () => {
  it("shows the title, area, state chip, and lines per row with the events using it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = await screen.findByTestId(`map-row-${missoula.id}`);
    expect(within(row).getByText("Missoula valley")).toBeInTheDocument();
    expect(
      within(row).getByText("-114.75, 46.35 to -113.30, 47.25")
    ).toBeInTheDocument();
    expect(within(row).getByText("Ready")).toBeInTheDocument();
    expect(within(row).getByText("0 to 15")).toBeInTheDocument();
    expect(within(row).getByText("1.4 GB")).toBeInTheDocument();
    expect(within(row).getByText("256 MB to zoom 15")).toBeInTheDocument();
    expect(within(row).getByText("Oct 1, 2026")).toBeInTheDocument();
    const count = await within(row).findByTestId(`map-events-${missoula.id}`);
    expect(count).toHaveTextContent("1");
    await user.hover(count);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Santa Flyover 2026"
    );

    const other = screen.getByTestId(`map-row-${pending.id}`);
    expect(within(other).getByText("Bitterroot")).toBeInTheDocument();
    expect(within(other).getByText("Pending")).toBeInTheDocument();
    expect(within(other).getByText("0 to 14")).toBeInTheDocument();
    expect(within(other).getByText("300 MB")).toBeInTheDocument();
    // Terrain, Source build, and Events all read "none".
    expect(within(other).getAllByText("none")).toHaveLength(3);
  });

  it("Rename patches the name and toasts", async () => {
    let body: unknown = null;
    server.use(
      http.patch(`${API}/admin/maps/:id`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...missoula, name: "Valley" });
      })
    );
    render(<Harness />);
    const user = await openMenuItem(Number(missoula.id), /^rename$/i);
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText(/name/i);
    expect(field).toHaveValue("Missoula valley");
    await user.clear(field);
    await user.type(field, "Valley");
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(body).toEqual({ name: "Valley" }));
    expect(await screen.findByText("Map renamed")).toBeInTheDocument();
  });

  it("Delete offers Replace with over the other ready maps and sends replacementId on the body", async () => {
    let deleted: { url: string; body: string } | null = null;
    server.use(
      http.get(`${API}/admin/maps`, () =>
        HttpResponse.json({ items: [missoula, pending, flathead] })
      ),
      http.delete(`${API}/admin/maps/:id`, async ({ request }) => {
        deleted = { url: request.url, body: await request.text() };
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(<Harness />);
    const user = await openMenuItem(Number(missoula.id), /^delete$/i);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/delete missoula valley\?/i);
    expect(
      within(dialog).getByTestId("help-maps.delete")
    ).toBeInTheDocument();
    await within(dialog).findByText(/lose their reference|loses its reference/i);
    const select = await within(dialog).findByRole("combobox", {
      name: /replace with/i,
    });
    await user.click(select);
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "Flathead" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "Bitterroot" })).toBeNull();
    expect(within(listbox).queryByRole("option", { name: "Missoula valley" })).toBeNull();
    await user.click(within(listbox).getByRole("option", { name: "Flathead" }));
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(deleted).not.toBeNull());
    expect(new URL(deleted!.url).pathname).toBe(`/admin/maps/${missoula.id}`);
    expect(JSON.parse(deleted!.body)).toEqual({ replacementId: 3 });
    expect(await screen.findByText("Map deleted")).toBeInTheDocument();
  });

  it("Delete without a replacement sends no body", async () => {
    let body: string | null = null;
    server.use(
      http.delete(`${API}/admin/maps/:id`, async ({ request }) => {
        body = await request.text();
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(<Harness />);
    const user = await openMenuItem(Number(missoula.id), /^delete$/i);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("combobox", { name: /replace with/i });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(body).toBe(""));
  });

  it("hides Replace with when no events unlink", async () => {
    render(<Harness />);
    await openMenuItem(Number(pending.id), /^delete$/i);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/nothing else is affected/i);
    expect(
      within(dialog).queryByRole("combobox", { name: /replace with/i })
    ).toBeNull();
  });

  it("shows a 400 at replacementId in the dialog's alert", async () => {
    server.use(
      http.get(`${API}/admin/maps`, () =>
        HttpResponse.json({ items: [missoula, flathead] })
      ),
      http.delete(`${API}/admin/maps/:id`, () =>
        HttpResponse.json(
          {
            code: "validation_failed",
            message: "The replacement map does not cover Santa Flyover 2026.",
            details: {
              fields: {
                replacementId:
                  "The replacement map does not cover Santa Flyover 2026.",
              },
            },
            requestId: "r9",
          },
          { status: 400 }
        )
      )
    );
    render(<Harness />);
    const user = await openMenuItem(Number(missoula.id), /^delete$/i);
    const dialog = await screen.findByRole("dialog");
    await user.click(
      await within(dialog).findByRole("combobox", { name: /replace with/i })
    );
    await user.click(await screen.findByRole("option", { name: "Flathead" }));
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(
        within(dialog)
          .getAllByRole("alert")
          .some((a) => /does not cover Santa Flyover 2026/.test(a.textContent ?? ""))
      ).toBe(true)
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("How to build a map opens the maps.build popover", async () => {
    const user = userEvent.setup();
    render(
      <HelpHarness userManager={signInAs("admin")} route="/maps">
        <MapsList />
      </HelpHarness>
    );
    const button = await screen.findByRole("button", {
      name: /how to build a map/i,
    });
    expect(button).toHaveAttribute("data-testid", "help-maps.build");
    await user.click(button);
    const popover = await screen.findByRole("presentation");
    expect(within(popover).getByText("Building a map")).toBeInTheDocument();
  });

  it("offers no upload control", async () => {
    render(<Harness />);
    await screen.findByTestId(`map-row-${missoula.id}`);
    expect(screen.queryByRole("button", { name: /upload/i })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("renders a card per map on compact with the row menu", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(<Harness />);
      const card = await screen.findByTestId(`map-row-${missoula.id}`);
      expect(within(card).getByText("Missoula valley")).toBeInTheDocument();
      expect(
        within(card).getByText("-114.75, 46.35 to -113.30, 47.25")
      ).toBeInTheDocument();
      expect(within(card).getByText("Ready")).toBeInTheDocument();
      expect(
        within(card).getByRole("button", { name: /actions for missoula valley/i })
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
    } finally {
      restore();
    }
  });
});

describe("MapsList help buttons (admin.md 6.26)", () => {
  it("mounts maps on the header, maps.list on the table title, and maps.build on the guide button", async () => {
    render(<Harness />);
    for (const key of ["maps", "maps.list", "maps.build"]) {
      expect(await screen.findByTestId(`help-${key}`)).toBeInTheDocument();
    }
  });
});
