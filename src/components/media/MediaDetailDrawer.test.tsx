import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import MediaDetailDrawer from "./MediaDetailDrawer";
import MediaCard from "./MediaCard";
import { CREDIT_MAX, creditValue } from "./credit";
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

describe("MediaDetailDrawer: small screen version", () => {
  it("renders right after the dark mode version with None and the help", async () => {
    render(<Harness asset={self} />);
    const dark = await screen.findByTestId("media-dark-mode");
    const small = screen.getByTestId("media-small-screen");
    expect(dark.nextElementSibling).toBe(small);
    expect(within(small).getByText("Small screen version")).toBeInTheDocument();
    expect(within(small).getByText("None")).toBeInTheDocument();
    expect(
      within(small).getByText(
        "Drawn in this image's place on screens under 760 px wide."
      )
    ).toBeInTheDocument();
    expect(within(small).getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("picking a ready asset patches smallMediaId and shows its thumbnail", async () => {
    const user = userEvent.setup();
    render(<Harness asset={self} />);
    const section = await screen.findByTestId("media-small-screen");
    await user.click(within(section).getByRole("button", { name: "Choose" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Choose the small screen version",
    });
    await within(dialog).findByTestId(`media-card-${other.id}`);
    expect(within(dialog).queryByTestId(`media-card-${self.id}`)).toBeNull();
    await user.click(
      within(within(dialog).getByTestId(`media-card-${other.id}`)).getAllByRole(
        "button"
      )[0]!
    );
    await user.click(within(dialog).getByRole("button", { name: "Choose" }));
    await waitFor(() => expect(patches).toEqual([{ smallMediaId: other.id }]));
    expect(await within(section).findByText("logo-dark.svg")).toBeInTheDocument();
  });

  it("shows the thumbnail when set", async () => {
    render(<Harness asset={{ ...self, smallMediaId: other.id }} />);
    const section = await screen.findByTestId("media-small-screen");
    expect(await within(section).findByText("logo-dark.svg")).toBeInTheDocument();
    expect(within(section).getByRole("img")).toBeInTheDocument();
    expect(within(section).queryByText("None")).toBeNull();
  });

  it("Clear sends null", async () => {
    const user = userEvent.setup();
    render(<Harness asset={{ ...self, smallMediaId: other.id }} />);
    const section = await screen.findByTestId("media-small-screen");
    await user.click(within(section).getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(patches).toEqual([{ smallMediaId: null }]));
    expect(await within(section).findByText("None")).toBeInTheDocument();
  });

  it("shows a 409 inline under the picker", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/media/:id`, () =>
        HttpResponse.json(
          {
            title: "Conflict",
            status: 409,
            detail: "The small screen version is not ready.",
          },
          { status: 409, headers: { "Content-Type": "application/problem+json" } }
        )
      )
    );
    render(<Harness asset={self} />);
    const section = await screen.findByTestId("media-small-screen");
    await user.click(within(section).getByRole("button", { name: "Choose" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Choose the small screen version",
    });
    await user.click(
      within(
        await within(dialog).findByTestId(`media-card-${other.id}`)
      ).getAllByRole("button")[0]!
    );
    await user.click(within(dialog).getByRole("button", { name: "Choose" }));
    expect(await within(section).findByRole("alert")).toHaveTextContent("409");
    expect(within(section).getByText("None")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("media-dark-mode")).queryByRole("alert")
    ).toBeNull();
  });
});

describe("MediaDetailDrawer: credit", () => {
  function creditField() {
    return screen.getByRole("textbox", { name: "Credit" });
  }

  it("shows the Credit field with its help, empty when unset", async () => {
    render(<Harness asset={self} />);
    expect(await screen.findByRole("textbox", { name: "Credit" })).toHaveValue("");
    expect(screen.getByText("The site shows this under the photo.")).toBeInTheDocument();
  });

  it("sets a credit with Save", async () => {
    const user = userEvent.setup();
    render(<Harness asset={self} />);
    await user.type(await screen.findByRole("textbox", { name: "Credit" }), "  Jane Doe ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ credit: "Jane Doe" });
    await waitFor(() => expect(creditField()).toHaveValue("Jane Doe"));
  });

  it("clears a credit to none", async () => {
    const user = userEvent.setup();
    render(<Harness asset={{ ...self, credit: "Jane Doe" }} />);
    const field = await screen.findByRole("textbox", { name: "Credit" });
    expect(field).toHaveValue("Jane Doe");
    await user.clear(field);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ credit: null });
    expect(creditField()).toHaveValue("");
  });

  it("round-trips the saved credit from the API", async () => {
    const user = userEvent.setup();
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/media/:id`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patches.push(body);
        return HttpResponse.json({ ...self, ...body, credit: "Photo: Jane Doe" });
      })
    );
    render(<Harness asset={self} />);
    await user.type(await screen.findByRole("textbox", { name: "Credit" }), "Jane Doe");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(creditField()).toHaveValue("Photo: Jane Doe"));
  });

  it("caps the credit at 200 characters", async () => {
    const user = userEvent.setup();
    render(<Harness asset={self} />);
    const field = await screen.findByRole("textbox", { name: "Credit" });
    expect(field).toHaveAttribute("maxlength", String(CREDIT_MAX));
    await user.click(field);
    await user.paste("x".repeat(250));
    expect(field).toHaveValue("x".repeat(200));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]!.credit).toBe("x".repeat(200));
  });
});

describe("creditValue", () => {
  it("trims, caps at 200, and turns empty into null", () => {
    expect(CREDIT_MAX).toBe(200);
    expect(creditValue(" Jane ")).toBe("Jane");
    expect(creditValue("")).toBeNull();
    expect(creditValue("   ")).toBeNull();
    expect(creditValue("y".repeat(201))).toBe("y".repeat(200));
  });
});

describe("MediaCard: credit", () => {
  it("shows the saved credit", () => {
    render(
      <ThemeProvider theme={buildTheme("light")}>
        <MediaCard asset={{ ...self, credit: "Jane Doe" }} />
      </ThemeProvider>
    );
    expect(screen.getByTestId(`media-credit-${self.id}`)).toHaveTextContent(
      "Credit: Jane Doe"
    );
  });

  it("shows no credit line when none is set", () => {
    render(
      <ThemeProvider theme={buildTheme("light")}>
        <MediaCard asset={{ ...self, credit: null }} />
      </ThemeProvider>
    );
    expect(screen.queryByTestId(`media-credit-${self.id}`)).toBeNull();
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
