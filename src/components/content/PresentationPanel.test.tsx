import { describe, expect, it, beforeEach } from "vitest";
import { useState } from "react";
import { act, render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import PresentationPanel from "./PresentationPanel";
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
import type { Presentation } from "../../api/types";

function Harness({
  initial,
  sectionKind,
  onChange,
}: {
  initial: Presentation;
  sectionKind?: string;
  onChange?: (next: Presentation) => void;
}) {
  const [value, setValue] = useState<Presentation>(initial);
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
              <PresentationPanel
                value={value}
                sectionKind={sectionKind}
                onChange={(next) => {
                  setValue(next);
                  onChange?.(next);
                }}
              />
              <pre data-testid="value">{JSON.stringify(value)}</pre>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const NONE_BG_PRES: Presentation = {
  width: "wide",
  align: "start",
  background: { kind: "none" } as unknown as Presentation["background"],
  spacing: "normal",
  iconBefore: null,
  iconAfter: null,
  anchor: null,
};

const TOKEN_BG_PRES: Presentation = {
  ...NONE_BG_PRES,
  background: {
    kind: "token",
    token: "accent",
  } as unknown as Presentation["background"],
};

const MEDIA_BG_PRES: Presentation = {
  ...NONE_BG_PRES,
  background: {
    kind: "media",
    media: { mediaId: "picked-media", alt: null },
    overlay: 0,
  } as unknown as Presentation["background"],
};

function readValue(): Presentation {
  return JSON.parse(screen.getByTestId("value").textContent ?? "{}") as Presentation;
}

function selectBackground(name: string) {
  const combo = within(screen.getByTestId("presentation-panel"))
    .getByRole("combobox", { name: /background/i });
  fireEvent.mouseDown(combo);
  const option = screen.getByRole("option", { name });
  fireEvent.click(option);
}

const PICKED_ASSET_ID = "picked-media";

function stubMediaGrid() {
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/media`, () =>
      HttpResponse.json({
        items: [
          { ...f.mediaAssets[0]!, id: PICKED_ASSET_ID, filename: "pick.jpg" },
        ],
        nextCursor: null,
      })
    ),
    http.get(
      `${testConfig.apiBaseUrl}/admin/media/${PICKED_ASSET_ID}`,
      () =>
        HttpResponse.json({
          ...f.mediaAssets[0]!,
          id: PICKED_ASSET_ID,
          filename: "pick.jpg",
        })
    )
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

describe("PresentationPanel: media background", () => {
  it("choosing Image opens the picker and a pick writes a media background", async () => {
    const user = userEvent.setup();
    stubMediaGrid();
    render(<Harness initial={NONE_BG_PRES} />);
    selectBackground("Image");
    // The picker dialog opens with a Cancel button.
    await screen.findByRole("dialog");
    const card = await screen.findByTestId(`media-card-${PICKED_ASSET_ID}`);
    await user.click(within(card).getAllByRole("button")[0]!);
    // Confirm with the picker's Choose button.
    const chooseButtons = screen.getAllByRole("button", { name: /^choose$/i });
    await user.click(chooseButtons[chooseButtons.length - 1]!);
    await waitFor(() => {
      expect(readValue().background).toEqual({
        kind: "media",
        media: { mediaId: PICKED_ASSET_ID, alt: null },
        overlay: 0,
      });
    });
  });

  it("cancelling the picker leaves the previous background untouched", async () => {
    const user = userEvent.setup();
    stubMediaGrid();
    render(<Harness initial={TOKEN_BG_PRES} />);
    selectBackground("Image");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull()
    );
    expect(readValue().background).toEqual({
      kind: "token",
      token: "accent",
    });
  });

  it("the overlay slider writes the overlay value", async () => {
    stubMediaGrid();
    render(<Harness initial={MEDIA_BG_PRES} />);
    const slider = await screen.findByTestId("presentation-overlay");
    const input = within(slider).getByRole("slider");
    // MUI Slider updates via keyboard interaction.
    await act(async () => {
      input.focus();
      fireEvent.keyDown(input, { key: "ArrowRight" });
    });
    await waitFor(() => {
      const bg = readValue().background as unknown as { overlay: number };
      expect(bg.overlay).toBeGreaterThan(0);
    });
  });
});

describe("PresentationPanel: icons before and after", () => {
  it("sets and clears the Icon before", async () => {
    const user = userEvent.setup();
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
    render(<Harness initial={NONE_BG_PRES} />);
    const iconBefore = screen.getByTestId("presentation-icon-before");
    await user.click(within(iconBefore).getByRole("button", { name: /choose/i }));
    // Pick the cookie tile in the library grid.
    const tile = await screen.findByTestId("icon-tile-cookie");
    await user.click(tile);
    const chooseButtons = screen.getAllByRole("button", { name: /^choose$/i });
    await user.click(chooseButtons[chooseButtons.length - 1]!);
    await waitFor(() =>
      expect(readValue().iconBefore).toEqual({ source: "library", id: "cookie" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull()
    );
    // Clear removes the value.
    const clearBtn = within(
      screen.getByTestId("presentation-icon-before")
    ).getByRole("button", { name: /clear/i });
    await user.click(clearBtn);
    await waitFor(() => expect(readValue().iconBefore).toBeNull());
  });

  it("sets and clears the Icon after", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/icons`, () =>
        HttpResponse.json({
          items: [
            {
              id: "leaf",
              name: "Leaf",
              tags: ["plant"],
              url: "https://cdn.test/i/leaf.svg",
            },
          ],
        })
      )
    );
    render(<Harness initial={NONE_BG_PRES} />);
    const iconAfter = screen.getByTestId("presentation-icon-after");
    await user.click(within(iconAfter).getByRole("button", { name: /choose/i }));
    const tile = await screen.findByTestId("icon-tile-leaf");
    await user.click(tile);
    const chooseButtons = screen.getAllByRole("button", { name: /^choose$/i });
    await user.click(chooseButtons[chooseButtons.length - 1]!);
    await waitFor(() =>
      expect(readValue().iconAfter).toEqual({ source: "library", id: "leaf" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull()
    );
    const clearBtn = within(
      screen.getByTestId("presentation-icon-after")
    ).getByRole("button", { name: /clear/i });
    await user.click(clearBtn);
    await waitFor(() => expect(readValue().iconAfter).toBeNull());
  });
});

describe("PresentationPanel: Show in a card", () => {
  it("is on for a presentation without card and writes false then true", () => {
    render(<Harness initial={NONE_BG_PRES} sectionKind="rich_text" />);
    const sw = within(screen.getByTestId("presentation-card")).getByRole("switch");
    expect(sw).toBeChecked();
    expect(screen.getByText("Cards are always the standard width")).toBeInTheDocument();
    fireEvent.click(sw);
    expect(readValue().card).toBe(false);
    fireEvent.click(sw);
    expect(readValue().card).toBe(true);
  });

  it("is hidden for the map", () => {
    render(<Harness initial={NONE_BG_PRES} sectionKind="map" />);
    expect(screen.queryByTestId("presentation-card")).toBeNull();
  });
});

describe("PresentationPanel: Width shows only with the card off", () => {
  it("hides Width while the card is on", () => {
    render(<Harness initial={NONE_BG_PRES} sectionKind="hero" />);
    expect(screen.queryByTestId("presentation-width")).toBeNull();
  });

  it("shows Width once the card is turned off", () => {
    render(<Harness initial={NONE_BG_PRES} sectionKind="rich_text" />);
    fireEvent.click(
      within(screen.getByTestId("presentation-card")).getByRole("switch")
    );
    expect(screen.getByTestId("presentation-width")).toBeInTheDocument();
  });

  it("shows Width for a presentation with card false", () => {
    render(
      <Harness initial={{ ...NONE_BG_PRES, card: false }} sectionKind="hero" />
    );
    expect(screen.getByTestId("presentation-width")).toBeInTheDocument();
  });

  it("never shows Width for the map", () => {
    render(
      <Harness initial={{ ...NONE_BG_PRES, card: false }} sectionKind="map" />
    );
    expect(screen.queryByTestId("presentation-width")).toBeNull();
  });
});

describe("PresentationPanel: Icon size", () => {
  it("is hidden when neither icon is set", () => {
    render(<Harness initial={NONE_BG_PRES} />);
    expect(screen.queryByTestId("presentation-icon-size")).toBeNull();
  });

  it("shows with an icon set, reads Small when absent, and writes iconSize", () => {
    render(
      <Harness
        initial={{
          ...NONE_BG_PRES,
          iconAfter: { source: "library", id: "leaf" } as Presentation["iconAfter"],
        }}
      />
    );
    const combo = within(screen.getByTestId("presentation-panel")).getByRole(
      "combobox",
      { name: /icon size/i }
    );
    expect(combo).toHaveTextContent("Small");
    fireEvent.mouseDown(combo);
    fireEvent.click(screen.getByRole("option", { name: "Large" }));
    expect(readValue().iconSize).toBe("lg");
  });
});
