import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import MessagesSection from "./MessagesSection";
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
import type { EventMessage } from "../../api/types";

vi.setConfig({ testTimeout: 15_000 });

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
          <NotifyProvider>
            <MemoryRouter>
              <MessagesSection eventId={7} />
            </MemoryRouter>
          </NotifyProvider>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

function message(over: Partial<EventMessage>): EventMessage {
  return { ...f.eventMessages[0]!, ...over };
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
  server.use(
    http.get("*/admin/subscribers/summary", () =>
      HttpResponse.json({ verified: 812, pending: 40, unsubscribed: 12 })
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("MessagesSection (admin.md 6.3)", () => {
  it("has no datetime input and posts { body, notify }", async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    server.use(
      http.post("*/admin/events/:id/messages", async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(f.eventMessages[0], { status: 201 });
      })
    );
    const { container } = render(<Harness />);
    await screen.findByText(f.eventMessages[0]!.body!);
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    expect(screen.queryByLabelText(/event time/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Body"), " Wheels up. ");
    await user.click(screen.getByRole("button", { name: /^post$/i }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ body: "Wheels up.", notify: false });
    expect(await screen.findByText("Message posted")).toBeInTheDocument();
  });

  it("the inline edit has no datetime input and patches { body }", async () => {
    const user = userEvent.setup();
    const patches: unknown[] = [];
    server.use(
      http.patch("*/admin/events/:id/messages/:mid", async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json(f.eventMessages[0]);
      })
    );
    const { container } = render(<Harness />);
    await screen.findByText(f.eventMessages[0]!.body!);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ body: f.eventMessages[0]!.body });
  });

  it("with Notify ticked shows the verified count and the snackbar reports it", async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    server.use(
      http.post("*/admin/events/:id/messages", async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json(
          message({ notify: true, sentCount: 0 }),
          { status: 201 }
        );
      })
    );
    render(<Harness />);
    await screen.findByText(f.eventMessages[0]!.body!);
    expect(screen.queryByTestId("message-verified-line")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /notify/i }));
    expect(await screen.findByTestId("message-verified-line")).toHaveTextContent(
      "812 verified subscribers will be emailed"
    );
    await user.type(screen.getByLabelText("Body"), "Wheels up.");
    await user.click(screen.getByRole("button", { name: /^post$/i }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ body: "Wheels up.", notify: true });
    expect(
      await screen.findByText("Message posted, notifying 812 subscribers")
    ).toBeInTheDocument();
  });

  it("a notified message shows its sent count and an unnotified one shows none", async () => {
    server.use(
      http.get("*/admin/events/:id/messages", () =>
        HttpResponse.json({
          items: [
            message({
              id: 21,
              body: "Notified one",
              notify: true,
              sentCount: 3,
              createdAt: "2026-12-22T01:05:00.000Z",
            }),
            message({
              id: 22,
              body: "Quiet one",
              notify: false,
              sentCount: 0,
              createdAt: "2026-12-22T01:04:00.000Z",
            }),
          ],
        })
      )
    );
    render(<Harness />);
    const notified = (await screen.findByText("Notified one")).parentElement!;
    expect(within(notified).getByText("Notified · 3 sent")).toBeInTheDocument();
    const quiet = screen.getByText("Quiet one").parentElement!;
    expect(within(quiet).queryByText(/notified/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId("message-notified")).toHaveLength(1);
  });
});
