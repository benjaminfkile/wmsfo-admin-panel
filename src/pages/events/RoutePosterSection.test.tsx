import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RoutePosterSection from "./RoutePosterSection";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import type { Event } from "../../api/types";
import { buildTheme } from "../../theme/theme";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

const EVENT: Event = { ...f.events[0]!, routeImageMediaId: null };

function Harness({ event }: { event: Event }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <ConfigProvider config={testConfig}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/events/${event.id}`]}>
            <NotifyProvider>
              <Routes>
                <Route path="/events/:id" element={<RoutePosterSection event={event} />} />
                <Route path="/events/:id/poster" element={<div data-testid="studio-page" />} />
              </Routes>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] }),
  );
  installClient({ config: testConfig, userManager: um, onMfaRequired: () => undefined });
});

function buttonNames(): string[] {
  return screen.getAllByRole("button").map((b) => b.textContent ?? "");
}

describe("RoutePosterSection: picking only", () => {
  it("offers choosing and the studio link without a poster", () => {
    render(<Harness event={EVENT} />);
    expect(screen.getByText("No poster.")).toBeInTheDocument();
    expect(buttonNames()).toEqual(["Choose poster"]);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Open poster studio"]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/generate from flight recording/i)).toBeNull();
  });

  it("shows the current poster with Remove poster beside Choose poster", () => {
    render(
      <Harness
        event={
          {
            ...EVENT,
            routeImageMediaId: f.mediaAssets[0]!.id,
            routeImage: f.mediaAssets[0]!,
          } as Event
        }
      />,
    );
    expect(screen.getByText(f.mediaAssets[0]!.filename!)).toBeInTheDocument();
    expect(buttonNames()).toEqual(["Choose poster", "Remove poster"]);
    expect(screen.getByTestId("route-poster-studio")).toHaveTextContent("Open poster studio");
  });

  it("links to the studio even without a linked recording; the studio carries the hint", async () => {
    const user = userEvent.setup();
    render(<Harness event={{ ...EVENT, routeId: null }} />);
    const link = screen.getByTestId("route-poster-studio");
    expect(link).toHaveAttribute("href", `/events/${EVENT.id}/poster`);
    await user.click(link);
    expect(await screen.findByTestId("studio-page")).toBeInTheDocument();
  });

  it("opens the picker with the Library and Upload tabs", async () => {
    const user = userEvent.setup();
    render(<Harness event={EVENT} />);
    await user.click(screen.getByTestId("route-poster-choose"));
    const picker = await screen.findByRole("dialog", { name: /choose route poster/i });
    expect(within(picker).getByRole("tab", { name: "Library" })).toBeInTheDocument();
    expect(within(picker).getByRole("tab", { name: "Upload" })).toBeInTheDocument();
  });
});
