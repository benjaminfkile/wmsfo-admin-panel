import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StatusDialog from "./StatusDialog";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import { stockParagraph } from "../../lib/statusCopy";
import type { Event, StatusId } from "../../api/types";

function Harness(props: {
  event: Event;
  target: StatusId;
  onConfirm: (args: { notify: boolean; message: string | null }) => void;
}) {
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
            <StatusDialog
              open
              event={props.event}
              target={props.target}
              eventsList={f.events}
              activeBeacon={null}
              healthyReason={null}
              now={Date.now()}
              confirming={false}
              error={null}
              onCancel={() => undefined}
              onConfirm={props.onConfirm}
            />
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
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

// jsdom does not implement `window.matchMedia`; stubbing it to true lets
// `useCompact` see the compact viewport and stack the confirm buttons.
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

describe("StatusDialog", () => {
  it("Change and notify sends notify: true with the typed message", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Harness event={f.events[0]!} target={2 as StatusId} onConfirm={onConfirm} />
    );
    const field = screen.getByLabelText(/message/i);
    await user.type(field, "Doors open at 4");
    await user.click(
      screen.getByRole("button", { name: /^change and notify$/i })
    );
    expect(onConfirm).toHaveBeenCalledWith({
      notify: true,
      message: "Doors open at 4",
    });
  });

  it("Change without notifying asks a nested confirmation and sends notify: false", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Harness event={f.events[0]!} target={4 as StatusId} onConfirm={onConfirm} />
    );
    // First press opens the nested confirmation without calling onConfirm.
    await user.click(
      screen.getByRole("button", { name: /^change without notifying$/i })
    );
    expect(onConfirm).not.toHaveBeenCalled();
    // The nested dialog carries the same button label; press it.
    await user.click(
      screen.getByRole("button", { name: /^change without notifying$/i })
    );
    expect(onConfirm).toHaveBeenCalledWith({ notify: false, message: null });
  });

  it("shows the target status' stock paragraph as the placeholder", async () => {
    render(
      <Harness
        event={f.events[0]!}
        target={3 as StatusId}
        onConfirm={vi.fn()}
      />
    );
    const field = screen.getByLabelText(/message/i);
    expect(field).toHaveAttribute(
      "placeholder",
      stockParagraph(3, f.events[0]!.name ?? "", f.events[0]!.scheduledAt ?? null)
    );
  });

  it("shows the verified count line from the subscribers summary", async () => {
    render(
      <Harness event={f.events[0]!} target={2 as StatusId} onConfirm={vi.fn()} />
    );
    await waitFor(() =>
      expect(
        screen.getByText(/\d+ verified subscribers will be emailed/i)
      ).toBeInTheDocument()
    );
  });

  it("shows the email quota warning in the main dialog when the quota would not fit", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/email/quota`, () =>
        HttpResponse.json({
          available: true,
          dryRun: false,
          max24HourSend: 1000,
          sentLast24Hours: 950,
          maxSendRate: 14,
          queued: 40,
          remaining: 10,
          verifiedSubscribers: 1500,
          wouldExceed: true,
          fetchedAt: "2026-12-22T01:31:07.412Z",
        })
      )
    );
    render(
      <Harness event={f.events[0]!} target={2 as StatusId} onConfirm={vi.fn()} />
    );
    expect(await screen.findByTestId("email-quota-warning")).toBeInTheDocument();
  });

  it("hides the email quota notice in the nested silent confirmation", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/email/quota`, () =>
        HttpResponse.json({
          available: true,
          dryRun: false,
          max24HourSend: 1000,
          sentLast24Hours: 950,
          maxSendRate: 14,
          queued: 40,
          remaining: 10,
          verifiedSubscribers: 1500,
          wouldExceed: true,
          fetchedAt: "2026-12-22T01:31:07.412Z",
        })
      )
    );
    const user = userEvent.setup();
    render(
      <Harness event={f.events[0]!} target={4 as StatusId} onConfirm={vi.fn()} />
    );
    // The main dialog shows the warning.
    expect(await screen.findByTestId("email-quota-warning")).toBeInTheDocument();
    // Opening the nested silent-confirm view hides the notice.
    await user.click(
      screen.getByRole("button", { name: /^change without notifying$/i })
    );
    await waitFor(() => {
      expect(
        screen.queryByTestId("email-quota-warning")
      ).not.toBeInTheDocument();
    });
  });

  it("stacks the two confirm buttons on compact with full-width buttons", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(
        <Harness event={f.events[0]!} target={2 as StatusId} onConfirm={vi.fn()} />
      );
      const actions = await screen.findByTestId("status-dialog-actions");
      expect(actions).toHaveStyle({ "flex-direction": "column" });
    } finally {
      restore();
    }
  });
});
