import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import MediaPreview from "./MediaPreview";
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
import type { MediaAsset } from "../../api/types";

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
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
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

describe("MediaPreview", () => {
  it("renders the thumbnail and filename from the smallest variant", async () => {
    const asset: MediaAsset = {
      ...f.mediaAssets[0]!,
      id: "asset-1",
      filename: "photo.jpg",
      variants: {
        "1600": "https://cdn.test/big.webp",
        "480": "https://cdn.test/small.webp",
      },
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media/asset-1`, () =>
        HttpResponse.json(asset)
      )
    );
    render(
      <Harness>
        <MediaPreview mediaId="asset-1" />
      </Harness>
    );
    const img = await screen.findByTestId("media-preview-image");
    expect(img.getAttribute("src")).toBe("https://cdn.test/small.webp");
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
  });

  it("shows the missing placeholder when the asset is not found", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media/gone`, () =>
        HttpResponse.json(
          { code: "not_found", title: "Not found", status: 404 },
          { status: 404 }
        )
      )
    );
    render(
      <Harness>
        <MediaPreview mediaId="gone" />
      </Harness>
    );
    expect(await screen.findByTestId("media-preview-missing")).toBeInTheDocument();
  });
});
