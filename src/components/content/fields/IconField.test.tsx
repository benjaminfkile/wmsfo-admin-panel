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
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../../test/renderWithProviders";

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

describe("IconField", () => {
  it("shows an IconPreview and the library name for a picked library icon", async () => {
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
    const schema = {
      type: "object",
      properties: {
        icon: {
          $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/Icon",
        },
      },
    };
    render(
      <Harness>
        <SchemaForm
          schema={schema as Record<string, unknown>}
          formData={{ icon: { source: "library", id: "cookie" } }}
          onChange={() => undefined}
        />
      </Harness>
    );
    const img = await screen.findByTestId("icon-preview-image");
    expect(img.getAttribute("src")).toBe("https://cdn.test/i/cookie.svg");
    expect(screen.getByText("Cookie")).toBeInTheDocument();
    expect(screen.queryByText(/^Library:/)).toBeNull();
  });
});
