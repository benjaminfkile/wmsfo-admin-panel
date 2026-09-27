import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { useState, type ReactNode } from "react";
import InlineText from "./InlineText";
import {
  renderInlinePreview,
  type InlineEventContext,
} from "./renderInlinePreview";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

function Harness({ children }: { children: ReactNode }) {
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
          <MemoryRouter>{children}</MemoryRouter>
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
  // Default: no current event; a component that lists events gets an
  // empty list.
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
      HttpResponse.json({ items: [] })
    )
  );
});

function Controlled({
  initial = "",
  maxLength = 5000,
  eventOverride,
}: {
  initial?: string;
  maxLength?: number;
  eventOverride?: InlineEventContext;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <InlineText
        value={value}
        onChange={setValue}
        label="Text"
        maxLength={maxLength}
        eventOverride={eventOverride}
      />
      <textarea data-testid="value" readOnly value={value} />
    </>
  );
}

function readValue(): string {
  return (screen.getByTestId("value") as HTMLTextAreaElement).value;
}

describe("InlineText toolbar", () => {
  it("Bold wraps the selection in **...**", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled initial="hello world" />
      </Harness>
    );
    const input = screen.getByLabelText("Text") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 5);
    await user.click(screen.getByRole("button", { name: "Bold" }));
    expect(readValue()).toBe("**hello** world");
  });

  it("Italic wraps the selection in *...*", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled initial="hi there" />
      </Harness>
    );
    const input = screen.getByLabelText("Text") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(3, 8);
    await user.click(screen.getByRole("button", { name: "Italic" }));
    expect(readValue()).toBe("hi *there*");
  });

  it("Link asks for the address and wraps the selection", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled initial="click here" />
      </Harness>
    );
    const input = screen.getByLabelText("Text") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 5);
    await user.click(screen.getByRole("button", { name: "Link" }));
    const addr = await screen.findByLabelText("Link address");
    await user.type(addr, "/about");
    await user.click(screen.getByRole("button", { name: "Insert" }));
    expect(readValue()).toBe("[click](/about) here");
  });

  it("Insert icon opens the icon picker and inserts a library icon token", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/icons`, () =>
        HttpResponse.json({
          items: [
            {
              id: "cookie",
              name: "Cookie",
              tags: ["food"],
              url: "https://cdn.test/i/cookie.svg",
            },
          ],
        })
      )
    );
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled initial="before after" />
      </Harness>
    );
    const input = screen.getByLabelText("Text") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(7, 7);
    await user.click(screen.getByRole("button", { name: "Insert icon" }));
    const tile = await screen.findByTestId("icon-tile-cookie");
    await user.click(tile);
    await user.click(screen.getByRole("button", { name: "Choose" }));
    expect(readValue()).toBe("before {icon:cookie}after");
  });

  it("Insert event field inserts {event:name}", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled initial="hi " />
      </Harness>
    );
    const input = screen.getByLabelText("Text") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(3, 3);
    await user.click(
      screen.getByRole("button", { name: "Insert event field" })
    );
    const nameItem = await screen.findByRole("menuitem", { name: "Event name" });
    await user.click(nameItem);
    expect(readValue()).toBe("hi {event:name}");
  });
});

describe("InlineText character counter", () => {
  it("hides the counter well below the limit", () => {
    render(
      <Harness>
        <Controlled initial="hello" maxLength={100} />
      </Harness>
    );
    expect(screen.queryByTestId("inline-text-counter")).toBeNull();
  });

  it("shows the counter within the last 10% of the limit", () => {
    render(
      <Harness>
        <Controlled initial={"x".repeat(90)} maxLength={100} />
      </Harness>
    );
    const counter = screen.getByTestId("inline-text-counter");
    expect(counter.textContent).toBe("90 / 100");
  });
});

describe("InlineText preview uses the current event", () => {
  it("shows '(no current event)' in grey when no event is current", () => {
    render(
      <Harness>
        <Controlled initial="" />
      </Harness>
    );
    expect(
      screen.getByTestId("inline-text-preview-empty")
    ).toBeInTheDocument();
  });

  it("resolves {event:name} from a mocked current event", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/events`, () =>
        HttpResponse.json({
          items: [
            {
              id: 7,
              year: 2026,
              name: "Santa Flyover 2026",
              statusId: 3,
              isCurrent: true,
              scheduledAt: "2026-12-22T01:00:00.000Z",
              wentLiveAt: null,
              endedAt: null,
              fundsPercent: 0,
              routeId: null,
              routeUrl: null,
              createdBy: "a",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        })
      )
    );
    render(
      <Harness>
        <Controlled initial="Watch {event:name}!" />
      </Harness>
    );
    const preview = await screen.findByTestId("inline-text-preview");
    await within(preview).findByText(/Watch/);
    await within(preview).findByText(/Santa Flyover 2026/);
  });
});

describe("renderInlinePreview parses contracts 1.3a", () => {
  function draw(
    text: string,
    event: InlineEventContext = null,
    timeZone?: string
  ) {
    return render(
      <Harness>
        <div data-testid="preview">
          {renderInlinePreview(text, event, timeZone)}
        </div>
      </Harness>
    );
  }

  it("renders **bold** as <strong>", () => {
    draw("hi **bold** there");
    const preview = screen.getByTestId("preview");
    expect(within(preview).getByText("bold").tagName).toBe("STRONG");
  });

  it("renders *italic* as <em>", () => {
    draw("*it*");
    const preview = screen.getByTestId("preview");
    expect(within(preview).getByText("it").tagName).toBe("EM");
  });

  it("renders `code` in a monospace element", () => {
    draw("run `foo` now");
    const preview = screen.getByTestId("preview");
    expect(within(preview).getByText("foo").tagName).toBe("CODE");
  });

  it("renders [label](href) as an underlined link element", () => {
    draw("see [docs](/help) below");
    const preview = screen.getByTestId("preview");
    const link = within(preview).getByTestId("inline-preview-link");
    expect(link.textContent).toBe("docs");
    expect(link.getAttribute("data-href")).toBe("/help");
  });

  it("renders a library icon token as an IconPreview image or missing box", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/icons`, () =>
        HttpResponse.json({ items: [] })
      )
    );
    draw("has {icon:star} icon");
    const preview = screen.getByTestId("preview");
    await within(preview).findByTestId("icon-preview-missing");
  });

  it("renders a media icon token as an IconPreview", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media/x-123`, () =>
        HttpResponse.json({ notFound: true }, { status: 404 })
      )
    );
    draw("has {icon:media:x-123} media icon");
    const preview = screen.getByTestId("preview");
    await within(preview).findByTestId("icon-preview-missing");
  });

  it("renders a newline as a <br>", () => {
    draw("one\ntwo");
    const preview = screen.getByTestId("preview");
    expect(preview.querySelectorAll("br").length).toBe(1);
  });

  it("leaves anything else literal", () => {
    draw("plain text with {unknown:x} and no markup");
    const preview = screen.getByTestId("preview");
    expect(preview.textContent).toBe(
      "plain text with {unknown:x} and no markup"
    );
  });

  it("fills {event:name}, {event:year}, and {event:scheduledAt} from the event", () => {
    draw("{event:name} {event:year} at {event:scheduledAt}", {
      name: "Santa Flyover 2026",
      year: 2026,
      scheduledAt: "2026-12-22T01:00:00.000Z",
    });
    const preview = screen.getByTestId("preview");
    const text = preview.textContent ?? "";
    expect(text).toContain("Santa Flyover 2026");
    expect(text).toContain("2026");
  });

  it("fills {event:scheduledAt} in the given zone with its short name", () => {
    const event = {
      name: "Santa Flyover 2026",
      year: 2026,
      scheduledAt: "2026-12-22T01:00:00.000Z",
    };
    const { unmount } = draw("at {event:scheduledAt}", event, "America/Chicago");
    expect(screen.getByTestId("preview").textContent).toBe(
      "at 2026-12-21 19:00:00 CST"
    );
    unmount();
    draw("at {event:scheduledAt}", event, "America/New_York");
    expect(screen.getByTestId("preview").textContent).toBe(
      "at 2026-12-21 20:00:00 EST"
    );
  });

  it("leaves placeholders blank without a current event", () => {
    draw("[{event:name}][{event:year}][{event:scheduledAt}]", null);
    const preview = screen.getByTestId("preview");
    expect(preview.textContent).toBe("[][][]");
  });
});
