import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import SchemaForm from "../SchemaForm";
import { ConfigProvider } from "../../../ConfigContext";
import { installClient } from "../../../api/client";
import { buildTheme } from "../../../theme/theme";
import { server } from "../../../test/msw/server";
import * as f from "../../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../../test/renderWithProviders";
import type { MediaAsset } from "../../../api/types";

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
});

describe("MediaField", () => {
  it("shows the MediaPreview thumbnail and filename after a pick", async () => {
    const asset: MediaAsset = {
      ...f.mediaAssets[0]!,
      id: "picked-media",
      filename: "picked.jpg",
      variants: { "480": "https://cdn.test/picked-480.webp" },
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media/picked-media`, () =>
        HttpResponse.json(asset)
      )
    );
    const schema = {
      type: "object",
      properties: {
        media: {
          $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/MediaRef",
        },
      },
    };
    render(
      <Harness>
        <SchemaForm
          schema={schema as Record<string, unknown>}
          formData={{ media: { mediaId: "picked-media", alt: null } }}
          onChange={() => undefined}
        />
      </Harness>
    );
    const img = await screen.findByTestId("media-preview-image");
    expect(img.getAttribute("src")).toBe("https://cdn.test/picked-480.webp");
    expect(screen.getByText("picked.jpg")).toBeInTheDocument();
    expect(screen.queryByText(/^Media:/)).toBeNull();
  });

  it("shows the missing placeholder when the picked asset is not found", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media/dangling-id`, () =>
        HttpResponse.json(
          { code: "not_found", title: "Not found", status: 404 },
          { status: 404 }
        )
      )
    );
    const schema = {
      type: "object",
      properties: {
        media: {
          $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/MediaRef",
        },
      },
    };
    render(
      <Harness>
        <SchemaForm
          schema={schema as Record<string, unknown>}
          formData={{ media: { mediaId: "dangling-id", alt: null } }}
          onChange={() => undefined}
        />
      </Harness>
    );
    expect(await screen.findByTestId("media-preview-missing")).toBeInTheDocument();
  });
});
