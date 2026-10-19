import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import MediaDetailDrawer from "./MediaDetailDrawer";
import MediaCard from "./MediaCard";
import UsageList from "./UsageList";
import { formatDuration } from "./duration";
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

const picture = f.mediaAssets[0]!;
const poster: MediaAsset = {
  ...picture,
  id: "poster-asset",
  filename: "poster.jpg",
  variants: {
    "480": "https://cdn.example/media/poster/w480.webp",
    "960": "https://cdn.example/media/poster/w960.webp",
  },
};
const video: MediaAsset = {
  ...picture,
  id: "video-asset",
  filename: "flight.mp4",
  contentType: "video/mp4",
  kind: "video",
  width: 1920,
  height: 1080,
  durationMs: 83400,
  posterMediaId: null,
  variants: {},
  url: "https://cdn.example/media/video-asset/flight.mp4",
};
const svgIcon: MediaAsset = {
  ...picture,
  id: "svg-asset",
  filename: "icon.svg",
  kind: "svg",
  variants: {},
};

function Providers({ children }: { children: ReactNode }) {
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
            <NotifyProvider>{children}</NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

let patches: Array<Record<string, unknown>> = [];
let listQueries: URLSearchParams[] = [];

beforeEach(() => {
  patches = [];
  listQueries = [];
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/media`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      listQueries.push(params);
      const all = [poster, svgIcon, video];
      const kind = params.get("kind");
      return HttpResponse.json({
        items: kind ? all.filter((a) => a.kind === kind) : all,
        nextCursor: null,
      });
    }),
    http.get(`${testConfig.apiBaseUrl}/admin/media/:id/usage`, () =>
      HttpResponse.json({ ...f.mediaUsage })
    ),
    http.get(`${testConfig.apiBaseUrl}/admin/media/:id`, ({ params }) =>
      HttpResponse.json(
        [poster, svgIcon, video].find((a) => a.id === params.id) ?? picture
      )
    ),
    http.patch(
      `${testConfig.apiBaseUrl}/admin/media/:id`,
      async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        patches.push(body);
        return HttpResponse.json({ ...video, ...body });
      }
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("formatDuration", () => {
  it("writes m:ss", () => {
    expect(formatDuration(7000)).toBe("0:07");
    expect(formatDuration(83400)).toBe("1:23");
    expect(formatDuration(750000)).toBe("12:30");
    expect(formatDuration(null)).toBeNull();
  });
});

describe("MediaCard: video", () => {
  it("shows the placeholder with a play glyph, the duration, and a Video chip", () => {
    render(
      <Providers>
        <MediaCard asset={video} />
      </Providers>
    );
    const card = screen.getByTestId(`media-card-${video.id}`);
    expect(within(card).getByTestId("video-thumb-placeholder")).toBeInTheDocument();
    expect(within(card).getByTestId("video-play-glyph")).toBeInTheDocument();
    expect(within(card).queryByRole("img", { name: "flight.mp4" })).toBeNull();
    expect(card).toHaveTextContent("1920 × 1080 · 1:23");
    expect(screen.getByTestId(`media-kind-${video.id}`)).toHaveTextContent("Video");
    expect(card.querySelector("video")).toBeNull();
  });

  it("shows the poster's 480 variant when a poster is set", async () => {
    render(
      <Providers>
        <MediaCard asset={{ ...video, posterMediaId: poster.id }} />
      </Providers>
    );
    const thumb = await screen.findByTestId("video-thumb-poster");
    expect(thumb.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/media/poster/w480.webp"
    );
    expect(within(thumb).getByTestId("video-play-glyph")).toBeInTheDocument();
  });
});

describe("MediaDetailDrawer: video", () => {
  function renderDrawer(asset: MediaAsset) {
    return render(
      <Providers>
        <MediaDetailDrawer asset={asset} open onClose={() => undefined} />
      </Providers>
    );
  }

  it("previews the original in a video element and hides dark and small", async () => {
    renderDrawer({ ...video, posterMediaId: poster.id });
    const player = await screen.findByTestId("media-video-preview");
    expect(player.tagName).toBe("VIDEO");
    expect(player).toHaveAttribute("src", video.url);
    expect(player).toHaveAttribute("preload", "metadata");
    expect(player).toHaveAttribute("controls");
    await waitFor(() => expect(player).toHaveAttribute("poster", poster.url));
    expect(screen.queryByTestId("media-dark-mode")).toBeNull();
    expect(screen.queryByTestId("media-small-screen")).toBeNull();
    expect(screen.getByTestId("media-poster")).toBeInTheDocument();
  });

  it("shows None and the helper while no poster is set", async () => {
    renderDrawer(video);
    const section = await screen.findByTestId("media-poster");
    expect(within(section).getByText("Poster image")).toBeInTheDocument();
    expect(within(section).getByText("None")).toBeInTheDocument();
    expect(
      within(section).getByText("Shown before the video plays. Pick any picture.")
    ).toBeInTheDocument();
  });

  it("chooses a poster from raster and gif only and patches posterMediaId", async () => {
    const user = userEvent.setup();
    renderDrawer(video);
    const section = await screen.findByTestId("media-poster");
    await user.click(within(section).getByRole("button", { name: "Choose" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Choose the poster image",
    });
    await within(dialog).findByTestId(`media-card-${poster.id}`);
    expect(within(dialog).queryByTestId(`media-card-${svgIcon.id}`)).toBeNull();
    expect(within(dialog).queryByTestId(`media-card-${video.id}`)).toBeNull();
    await user.click(
      within(within(dialog).getByTestId(`media-card-${poster.id}`)).getAllByRole(
        "button"
      )[0]!
    );
    await user.click(within(dialog).getByRole("button", { name: "Choose" }));
    await waitFor(() => expect(patches).toEqual([{ posterMediaId: poster.id }]));
    expect(await within(section).findByText("poster.jpg")).toBeInTheDocument();
  });

  it("Clear writes null", async () => {
    const user = userEvent.setup();
    renderDrawer({ ...video, posterMediaId: poster.id });
    const section = await screen.findByTestId("media-poster");
    await user.click(within(section).getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(patches).toEqual([{ posterMediaId: null }]));
    expect(await within(section).findByText("None")).toBeInTheDocument();
  });

  it("shows a 409 inline under the section", async () => {
    server.use(
      http.patch(`${testConfig.apiBaseUrl}/admin/media/:id`, () =>
        HttpResponse.json(
          { title: "Conflict", status: 409, detail: "The poster is not ready." },
          { status: 409, headers: { "Content-Type": "application/problem+json" } }
        )
      )
    );
    const user = userEvent.setup();
    renderDrawer({ ...video, posterMediaId: poster.id });
    const section = await screen.findByTestId("media-poster");
    await user.click(within(section).getByRole("button", { name: "Clear" }));
    expect(await within(section).findByRole("alert")).toBeInTheDocument();
  });

  it("an image keeps its dark and small sections and has no poster section", async () => {
    renderDrawer(picture);
    expect(await screen.findByTestId("media-dark-mode")).toBeInTheDocument();
    expect(screen.getByTestId("media-small-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("media-poster")).toBeNull();
    expect(screen.queryByTestId("media-video-preview")).toBeNull();
  });
});

describe("UsageList: posterOf", () => {
  it("lists each video as poster of <filename>", () => {
    render(
      <Providers>
        <UsageList
          usage={{
            draftPages: [],
            versionCount: 0,
            sponsors: [],
            cookieTypes: [],
            siteSettings: false,
            posterOf: [{ id: video.id, filename: "flight.mp4" }],
          }}
        />
      </Providers>
    );
    expect(screen.getByText("poster of flight.mp4")).toBeInTheDocument();
    expect(screen.queryByText("Not used anywhere.")).toBeNull();
  });
});
