import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
});
