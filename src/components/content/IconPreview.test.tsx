import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import IconPreview from "./IconPreview";
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

describe("IconPreview", () => {
  it("renders the library url for a library icon", async () => {
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
    render(
      <Harness>
        <IconPreview icon={{ source: "library", id: "cookie" }} />
      </Harness>
    );
    const img = await screen.findByTestId("icon-preview-image");
    expect(img.getAttribute("src")).toBe("https://cdn.test/i/cookie.svg");
  });

  it("renders the smallest variant url for a media icon", async () => {
    const asset: MediaAsset = {
      ...f.mediaAssets[0]!,
      id: "media-1",
      variants: {
        "1600": "https://cdn.test/big.webp",
        "480": "https://cdn.test/small.webp",
        "960": "https://cdn.test/mid.webp",
      },
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media/media-1`, () =>
        HttpResponse.json(asset)
      )
    );
    render(
      <Harness>
        <IconPreview icon={{ source: "media", id: "media-1" }} />
      </Harness>
    );
    const img = await screen.findByTestId("icon-preview-image");
    expect(img.getAttribute("src")).toBe("https://cdn.test/small.webp");
  });
});
