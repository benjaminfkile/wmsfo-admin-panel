import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import MediaPicker from "./MediaPicker";
import MediaPreview from "./MediaPreview";
import MediaBlockEditor from "./blocks/MediaBlock";
import SchemaForm from "./SchemaForm";
import { IMAGE_AND_VIDEO_KINDS } from "../../api/resources/media";
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
import mediaItem from "../../../contracts/schema/sections/media.item.schema.json";

const picture: MediaAsset = { ...f.mediaAssets[0]!, id: "picture-asset" };
const video: MediaAsset = {
  ...f.mediaAssets[0]!,
  id: "video-asset",
  filename: "flight.mp4",
  contentType: "video/mp4",
  kind: "video",
  durationMs: 7000,
  posterMediaId: null,
  variants: {},
  url: "https://cdn.example/media/video-asset/flight.mp4",
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

let kindParams: Array<string | null> = [];

beforeEach(() => {
  kindParams = [];
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/media`, ({ request }) => {
      const kind = new URL(request.url).searchParams.get("kind");
      kindParams.push(kind);
      const all = [picture, video];
      return HttpResponse.json({
        items: kind ? all.filter((a) => a.kind === kind) : all,
        nextCursor: null,
      });
    }),
    http.get(`${testConfig.apiBaseUrl}/admin/media/:id`, ({ params }) =>
      HttpResponse.json(params.id === video.id ? video : picture)
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("MediaPicker: kinds", () => {
  it("offers images only by default: no video card, no Video filter, no MP4 upload", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <MediaPicker open onCancel={() => undefined} onPick={() => undefined} />
      </Providers>
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByTestId(`media-card-${picture.id}`);
    expect(within(dialog).queryByTestId(`media-card-${video.id}`)).toBeNull();
    await user.click(within(dialog).getByRole("combobox", { name: "Kind" }));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).queryByRole("option", { name: "Video" })).toBeNull();
    expect(within(listbox).getByRole("option", { name: "Raster" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(dialog).getByRole("tab", { name: "Upload" }));
    expect(
      await within(dialog).findByText("Images up to 20 MB, SVG up to 1 MB")
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("media-file-input")).not.toHaveAttribute(
      "accept",
      expect.stringContaining("video/mp4")
    );
  });

  it("with kinds including video offers the video card, the Video filter, and MP4 upload", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <MediaPicker
          open
          kinds={IMAGE_AND_VIDEO_KINDS}
          onCancel={() => undefined}
          onPick={() => undefined}
        />
      </Providers>
    );
    const dialog = await screen.findByRole("dialog");
    const card = await within(dialog).findByTestId(`media-card-${video.id}`);
    expect(within(card).getByTestId("video-play-glyph")).toBeInTheDocument();
    expect(within(dialog).getByTestId(`media-card-${picture.id}`)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("combobox", { name: "Kind" }));
    await user.click(await screen.findByRole("option", { name: "Video" }));
    expect(kindParams).toContain("video");
    await user.click(within(dialog).getByRole("tab", { name: "Upload" }));
    expect(
      await within(dialog).findByText(
        "Images up to 20 MB, SVG up to 1 MB, MP4 video up to 500 MB"
      )
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("media-file-input")).toHaveAttribute(
      "accept",
      expect.stringContaining("video/mp4")
    );
  });

  it("a single kind still fixes the grid to it", async () => {
    render(
      <Providers>
        <MediaPicker
          open
          kind="raster"
          onCancel={() => undefined}
          onPick={() => undefined}
        />
      </Providers>
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByTestId(`media-card-${picture.id}`);
    expect(kindParams).toEqual(["raster"]);
    expect(within(dialog).queryByRole("combobox", { name: "Kind" })).toBeNull();
  });
});

describe("The media block and the media section item pick videos", () => {
  it("the media block editor's picker offers videos", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <MediaBlockEditor
          value={{
            kind: "media",
            media: { mediaId: "", alt: null },
            caption: null,
            size: "medium",
          }}
          onChange={() => undefined}
        />
      </Providers>
    );
    await user.click(screen.getByRole("button", { name: "Choose" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Choose an image or video",
    });
    expect(
      await within(dialog).findByTestId(`media-card-${video.id}`)
    ).toBeInTheDocument();
  });

  it("the media section item's media field offers videos", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <SchemaForm
          schema={mediaItem as Record<string, unknown>}
          kind="media"
          isItem
          formData={{ media: { mediaId: "", alt: null }, caption: null, link: null }}
          onChange={() => undefined}
        />
      </Providers>
    );
    expect(screen.getByText("Image or video")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByTestId(`media-card-${video.id}`)
    ).toBeInTheDocument();
  });

  it("any other media field stays images only", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <SchemaForm
          schema={{
            type: "object",
            properties: {
              media: {
                $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/MediaRef",
              },
            },
          }}
          formData={{ media: { mediaId: "", alt: null } }}
          onChange={() => undefined}
        />
      </Providers>
    );
    await user.click(screen.getByRole("button", { name: "Choose" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByTestId(`media-card-${picture.id}`);
    expect(within(dialog).queryByTestId(`media-card-${video.id}`)).toBeNull();
  });
});

describe("MediaPreview: video", () => {
  it("shows the placeholder with a play glyph and the duration, never a playing video", async () => {
    const { container } = render(
      <Providers>
        <MediaPreview mediaId={video.id!} />
      </Providers>
    );
    expect(await screen.findByTestId("media-preview-video")).toBeInTheDocument();
    expect(screen.getByTestId("video-thumb-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("video-play-glyph")).toBeInTheDocument();
    expect(screen.getByText(/0:07/)).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByTestId("media-preview-image")).toBeNull();
  });

  it("shows the poster when the video has one", async () => {
    const poster: MediaAsset = {
      ...picture,
      id: "poster-asset",
      variants: { "480": "https://cdn.example/poster-480.webp" },
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media/:id`, ({ params }) =>
        HttpResponse.json(
          params.id === video.id
            ? { ...video, posterMediaId: poster.id }
            : poster
        )
      )
    );
    render(
      <Providers>
        <MediaPreview mediaId={video.id!} />
      </Providers>
    );
    const thumb = await screen.findByTestId("video-thumb-poster");
    expect(thumb.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/poster-480.webp"
    );
  });
});
