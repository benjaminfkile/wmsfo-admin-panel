import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import People from "./People";
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
          <MemoryRouter initialEntries={["/"]}>
            <NotifyProvider>
              <People />
            </NotifyProvider>
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

describe("People help buttons (admin.md 6.26)", () => {
  it("mounts the header help", async () => {
    render(<Harness />);
    expect(await screen.findByTestId("help-people")).toBeInTheDocument();
  });
});

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

const api = (p: string) => `${testConfig.apiBaseUrl}${p}`;

describe("Blocked addresses and domains (admin.md 6.11)", () => {
  it("lists the blocks with the pattern, note, by, when, and the matching count", async () => {
    render(<Harness />);
    expect(await screen.findByTestId("help-people.blocked")).toBeInTheDocument();
    const domain = await screen.findByTestId("block-row-7");
    expect(within(domain).getByText("anyone at spam.example")).toBeInTheDocument();
    expect(within(domain).getByText("spam sign-ups")).toBeInTheDocument();
    expect(within(domain).getByText("editor@example.com")).toBeInTheDocument();
    expect(within(domain).getByText("2 accounts now")).toBeInTheDocument();
    const address = screen.getByTestId("block-row-6");
    expect(within(address).getByText("troll@example.com")).toBeInTheDocument();
    expect(within(address).queryByText(/accounts? now/)).toBeNull();
  });

  it("says Nothing is blocked. when the list is empty", async () => {
    server.use(
      http.get(api("/admin/people/blocks"), () => HttpResponse.json({ items: [] }))
    );
    render(<Harness />);
    expect(await screen.findByText("Nothing is blocked.")).toBeInTheDocument();
  });

  it("renders the blocks as cards on a phone", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(<Harness />);
      const card = await screen.findByTestId("block-row-7");
      expect(within(card).getByText("anyone at spam.example")).toBeInTheDocument();
      expect(within(card).getByText("2 accounts now")).toBeInTheDocument();
      expect(
        within(card).getByRole("button", { name: "Unblock *@spam.example" })
      ).toBeInTheDocument();
      expect(within(screen.getByTestId("block-row-6")).queryByText(/now$/)).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    } finally {
      restore();
    }
  });

  it("unblocks after the confirm", async () => {
    const user = userEvent.setup();
    let removed: string | null = null;
    server.use(
      http.delete(api("/admin/people/blocks/:id"), ({ params }) => {
        removed = String(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(<Harness />);
    const row = await screen.findByTestId("block-row-6");
    await user.click(
      within(row).getByRole("button", { name: "Unblock troll@example.com" })
    );
    expect(
      await screen.findByText(
        "Unblock troll@example.com? They can sign up again as a new person."
      )
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^unblock$/i }));
    await waitFor(() => expect(removed).toBe("6"));
    expect(await screen.findByText("Unblocked")).toBeInTheDocument();
  });

  it("blocks a domain, shows the accounts it removes, and confirms with the count", async () => {
    const user = userEvent.setup();
    let posted: unknown = null;
    server.use(
      http.post(api("/admin/people/blocks"), async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          { ...f.signupBlocks[0], id: 9, pattern: "*@example.com", matchingCount: 0 },
          { status: 201 }
        );
      })
    );
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^block$/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("help-people.block")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("A domain"));
    await user.type(within(dialog).getByTestId("block-pattern"), "Example.com");
    await user.type(within(dialog).getByLabelText(/^note/i), "spam sign-ups");
    expect(
      await within(dialog).findByText(
        /these accounts will be removed and signed out everywhere/i
      )
    ).toBeInTheDocument();
    expect(within(dialog).getByText("person@example.com")).toBeInTheDocument();
    expect(within(dialog).getByText("1 subscription, 4 cookies.")).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Block and remove 1 account" })
    );
    await waitFor(() =>
      expect(posted).toEqual({ pattern: "*@example.com", note: "spam sign-ups" })
    );
    expect(await screen.findByText("Blocked, 1 account removed")).toBeInTheDocument();
  });

  it("says No account matches. and confirms with Block for an address nobody uses", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^block$/i }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /^block$/i });
    await user.type(within(dialog).getByTestId("block-pattern"), "nobody@example.org");
    expect(confirm).toBeDisabled();
    expect(await within(dialog).findByText("No account matches.")).toBeInTheDocument();
    // The note is required.
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^note/i), "test");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(await screen.findByText("Blocked")).toBeInTheDocument();
  });

  it("shows Already blocked. under the field on 409 block_exists", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(api("/admin/people/blocks"), () =>
        HttpResponse.json(
          { code: "block_exists", message: "already blocked", details: null, requestId: "r1" },
          { status: 409 }
        )
      )
    );
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^block$/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByTestId("block-pattern"), "troll@example.com");
    await user.type(within(dialog).getByLabelText(/^note/i), "again");
    await within(dialog).findByText("No account matches.");
    await user.click(within(dialog).getByRole("button", { name: /^block$/i }));
    expect(await within(dialog).findByText("Already blocked.")).toBeInTheDocument();
  });

  it("shows the API message on 502", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(api("/admin/people/blocks"), () =>
        HttpResponse.json(
          {
            code: "upstream_failed",
            message: "the sign-in could not be removed; nothing was blocked",
            details: null,
            requestId: "r1",
          },
          { status: 502 }
        )
      )
    );
    render(<Harness />);
    await user.click(await screen.findByRole("button", { name: /^block$/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByTestId("block-pattern"), "troll@example.com");
    await user.type(within(dialog).getByLabelText(/^note/i), "again");
    await within(dialog).findByText("No account matches.");
    await user.click(within(dialog).getByRole("button", { name: /^block$/i }));
    expect(
      await within(dialog).findByText(
        "the sign-in could not be removed; nothing was blocked"
      )
    ).toBeInTheDocument();
  });
});

describe("Person delete (admin.md 6.11, 8.3)", () => {
  it("says the sign-in goes too", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const row = await screen.findByTestId("person-row-1");
    await user.click(within(row).getByRole("button", { name: /^delete$/i }));
    expect(
      await screen.findByText(
        "Their sign-in is removed and they are signed out everywhere; they can create a new account afterwards."
      )
    ).toBeInTheDocument();
  });
});
