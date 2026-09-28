// admin.md 6.14: the route_preview style "map" saves through
// PATCH /admin/sections/{id} and reads back as Map after a reload.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PageEditor from "./PageEditor";
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
import kindsJson from "../../../contracts/kinds.json";
import routePreview from "../../../contracts/schema/sections/route_preview.schema.json";
import type { KindInfo, PageDetail, SectionAdmin } from "../../api/types";

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
          <MemoryRouter initialEntries={["/pages/3"]}>
            <NotifyProvider>
              <Routes>
                <Route path="/pages/:id" element={<PageEditor />} />
              </Routes>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const routeKind = (
  kindsJson as { kinds: Array<{ kind: string; defaults: Record<string, unknown> }> }
).kinds.find((k) => k.kind === "route_preview")!;

const kind: KindInfo = {
  ...(f.kinds[0] as KindInfo),
  kind: "route_preview",
  title: "Route preview",
  live: true,
  schema: routePreview as KindInfo["schema"],
  defaults: routeKind.defaults,
};

async function styleCombo(): Promise<HTMLElement> {
  const card = await screen.findByTestId(`section-card-${f.sampleSection.id}`);
  const header = within(card).getByTestId(`section-header-${f.sampleSection.id}`);
  fireEvent.click(within(header).getByLabelText(/expand section/i));
  return within(card).findByRole("combobox", { name: /style/i });
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

describe("PageEditor: route_preview style", () => {
  it("saves the Map style and shows it again after a reload", async () => {
    let section: SectionAdmin = {
      ...f.sampleSection,
      kind: "route_preview",
      data: structuredClone(routeKind.defaults),
    };
    const patched: Array<Record<string, unknown>> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: [kind] })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () => {
        const page: PageDetail = { ...f.pageDetail, sections: [section] };
        return HttpResponse.json(page);
      }),
      http.patch(`${testConfig.apiBaseUrl}/admin/sections/:id`, async ({ request }) => {
        const body = (await request.json()) as { data?: Record<string, unknown> };
        if (body.data) {
          patched.push(body.data);
          section = { ...section, data: body.data };
        }
        return HttpResponse.json(section);
      })
    );

    const first = render(<Harness />);
    const combo = await styleCombo();
    expect(combo).toHaveTextContent("Image");
    fireEvent.mouseDown(combo);
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Map" }));
    await act(async () => {
      await sleep(1200);
    });
    await waitFor(() => {
      expect(patched.at(-1)?.style).toBe("map");
    });
    first.unmount();

    render(<Harness />);
    expect(await styleCombo()).toHaveTextContent("Map");
  }, 10000);

  it("saves landmarks and the chosen points of interest and shows them after a reload", async () => {
    let section: SectionAdmin = {
      ...f.sampleSection,
      kind: "route_preview",
      data: {
        ...structuredClone(routeKind.defaults),
        style: "map",
        landmarks: [
          { name: "Caras Park", lat: 46.87, lng: -113.99 },
          { name: "Old bridge", lat: 46.86, lng: -114.01 },
        ],
      },
    };
    const patched: Array<Record<string, unknown>> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/content/kinds`, () =>
        HttpResponse.json({ items: [kind] })
      ),
      http.get(`${testConfig.apiBaseUrl}/admin/pages/:id`, () => {
        const page: PageDetail = { ...f.pageDetail, sections: [section] };
        return HttpResponse.json(page);
      }),
      http.patch(`${testConfig.apiBaseUrl}/admin/sections/:id`, async ({ request }) => {
        const body = (await request.json()) as { data?: Record<string, unknown> };
        if (body.data) {
          patched.push(body.data);
          section = { ...section, data: body.data };
        }
        return HttpResponse.json(section);
      })
    );

    const first = render(<Harness />);
    await styleCombo();
    fireEvent.click(screen.getByRole("button", { name: "Delete Old bridge" }));
    const pois = screen.getByTestId("pois-field");
    fireEvent.click(within(pois).getByRole("radio", { name: "Custom" }));
    fireEvent.click(within(pois).getByRole("checkbox", { name: "Churches" }));
    await act(async () => {
      await sleep(1200);
    });
    await waitFor(() => {
      expect(patched.at(-1)?.pois).toEqual({ kinds: ["place_of_worship"] });
    });
    expect(patched.at(-1)?.landmarks).toEqual([
      { name: "Caras Park", lat: 46.87, lng: -113.99 },
    ]);
    first.unmount();

    render(<Harness />);
    await styleCombo();
    expect(screen.getByTestId("landmarks-count")).toHaveTextContent("1 of 50");
    const again = screen.getByTestId("pois-field");
    expect(within(again).getByRole("checkbox", { name: "Churches" })).toBeChecked();
  }, 10000);
});
