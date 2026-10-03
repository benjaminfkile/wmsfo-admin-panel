import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotifyDialog from "./NotifyDialog";
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
import { MESSAGE_HELPER, stockParagraph } from "../../lib/statusCopy";
import type { StatusId } from "../../api/types";

function Harness({ onConfirm }: { onConfirm: (message: string | null) => void }) {
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
            <NotifyDialog
              open
              event={f.events[0]!}
              confirming={false}
              error={null}
              onCancel={() => undefined}
              onConfirm={onConfirm}
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

describe("NotifyDialog", () => {
  it("shows the message helper text with the counter on the same line", () => {
    render(<Harness onConfirm={vi.fn()} />);
    expect(screen.getByLabelText("Message (optional)")).toBeInTheDocument();
    const helper = screen.getByText(MESSAGE_HELPER);
    expect(helper.parentElement).toHaveTextContent(`${MESSAGE_HELPER}0 / 1000`);
  });

  it("Send now sends the typed message, trimmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.type(screen.getByLabelText(/message/i), " Santa is fueling up. ");
    await user.click(screen.getByRole("button", { name: /^send now$/i }));
    expect(onConfirm).toHaveBeenCalledWith("Santa is fueling up.");
  });

  it("Send now with an empty field sends null", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: /^send now$/i }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("shows the default message notice while the field is empty", async () => {
    const user = userEvent.setup();
    render(<Harness onConfirm={vi.fn()} />);
    const event = f.events[0]!;
    const paragraph = stockParagraph(
      Number(event.statusId) as StatusId,
      event.name ?? "",
      event.scheduledAt ?? null
    );
    const notice = screen.getByTestId("default-message-notice");
    expect(notice).toHaveTextContent(
      "No message typed. This default message will be emailed:"
    );
    expect(notice.querySelector("blockquote")).toHaveTextContent(paragraph);
    await user.type(screen.getByLabelText(/message/i), "Hi");
    expect(screen.queryByTestId("default-message-notice")).not.toBeInTheDocument();
  });
});
