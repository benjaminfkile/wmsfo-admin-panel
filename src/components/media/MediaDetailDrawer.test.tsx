import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import MediaDetailDrawer from "./MediaDetailDrawer";
import MediaCard from "./MediaCard";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import type { MediaAsset } from "../../api/types";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

const base = f.mediaAssets[0]!;
const self: MediaAsset = { ...base, id: "self-asset", filename: "logo.svg" };
const other: MediaAsset = {
  ...base,
  id: "dark-asset",
  filename: "logo-dark.svg",
};

function Harness({ asset }: { asset: MediaAsset }) {
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
          <MemoryRouter>
            <NotifyProvider>
              <MediaDetailDrawer asset={asset} open onClose={() => undefined} />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

let patches: Array<Record<string, unknown>> = [];

beforeEach(() => {
  patches = [];
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/media`, () =>
      HttpResponse.json({ items: [self, other], nextCursor: null })
    ),
    http.get(`${testConfig.apiBaseUrl}/admin/media/:id`, ({ params }) =>
      HttpResponse.json(params.id === other.id ? other : self)
    ),
    http.patch(
      `${testConfig.apiBaseUrl}/admin/media/:id`,
      async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patches.push(body);
        return HttpResponse.json({ ...self, ...body });
      }
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("MediaDetailDrawer: dark mode", () => {
  it("shows None with the switch off by default", async () => {
    render(<Harness asset={self} />);
    const section = await screen.findByTestId("media-dark-mode");
    expect(within(section).getByText("None")).toBeInTheDocument();
    expect(
      within(section).getByRole("switch", { name: "Invert in dark mode" })
    ).not.toBeChecked();
  });

  it("chooses a dark version through the picker, never offering the asset itself", async () => {
    const user = userEvent.setup();
    render(<Harness asset={self} />);
    const section = await screen.findByTestId("media-dark-mode");
    await user.click(within(section).getByRole("button", { name: "Choose" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Choose the dark mode version",
    });
    await within(dialog).findByTestId(`media-card-${other.id}`);
    expect(within(dialog).queryByTestId(`media-card-${self.id}`)).toBeNull();
    await user.click(
      within(within(dialog).getByTestId(`media-card-${other.id}`)).getAllByRole(
        "button"
      )[0]!
    );
    await user.click(within(dialog).getByRole("button", { name: "Choose" }));
    await waitFor(() => expect(patches).toEqual([{ darkMediaId: other.id }]));
    expect(await screen.findByText("logo-dark.svg")).toBeInTheDocument();
  });

  it("clears the dark version", async () => {
    const user = userEvent.setup();
    render(<Harness asset={{ ...self, darkMediaId: other.id }} />);
    const section = await screen.findByTestId("media-dark-mode");
    await user.click(within(section).getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(patches).toEqual([{ darkMediaId: null }]));
    expect(await within(section).findByText("None")).toBeInTheDocument();
  });

  it("the switch patches invertInDark", async () => {
    const user = userEvent.setup();
    render(<Harness asset={self} />);
    const section = await screen.findByTestId("media-dark-mode");
    const toggle = within(section).getByRole("switch", {
      name: "Invert in dark mode",
    });
    await user.click(toggle);
    await waitFor(() => expect(patches).toEqual([{ invertInDark: true }]));
    await waitFor(() => expect(toggle).toBeChecked());
  });

  it("shows a rejected choice inline", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/media/:id`, () =>
        HttpResponse.json(
          { title: "Conflict", status: 409, detail: "The dark version is not ready." },
          { status: 409, headers: { "Content-Type": "application/problem+json" } }
        )
      )
    );
    render(<Harness asset={self} />);
    const section = await screen.findByTestId("media-dark-mode");
    await user.click(
      within(section).getByRole("switch", { name: "Invert in dark mode" })
    );
    expect(await within(section).findByRole("alert")).toBeInTheDocument();
  });
});

describe("MediaCard: dark mode chips", () => {
  function renderCard(asset: MediaAsset) {
    return render(
      <ThemeProvider theme={buildTheme("light")}>
        <MediaCard asset={asset} />
      </ThemeProvider>
    );
  }

  it("shows Dark when the asset has a dark version", () => {
    renderCard({ ...self, darkMediaId: other.id, invertInDark: true });
    expect(screen.getByTestId(`media-dark-${self.id}`)).toHaveTextContent("Dark");
  });

  it("shows Inverts when the asset only inverts", () => {
    renderCard({ ...self, darkMediaId: null, invertInDark: true });
    expect(screen.getByTestId(`media-dark-${self.id}`)).toHaveTextContent(
      "Inverts"
    );
  });

  it("shows no chip when neither is set", () => {
    renderCard(self);
    expect(screen.queryByTestId(`media-dark-${self.id}`)).toBeNull();
  });
});
