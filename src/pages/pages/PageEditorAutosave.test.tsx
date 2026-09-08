// admin.md 6.14: a section edit patches once after the debounce and a refetch
// must not schedule another save. Guards against the render loop that appears
// when the debounce hook hands SectionCard a new object on every render.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PageEditor from "./PageEditor";
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
          <MemoryRouter initialEntries={["/pages/1"]}>
            <NotifyProvider>
              <Routes>
                <Route path="/pages/:id" element={<PageEditor />} />
              </Routes>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

describe("PageEditor autosave", () => {
  it("patches exactly once for one edit and stays quiet after the refetch", async () => {
    let patches = 0;
    let gets = 0;
    server.use(
      http.get("*/admin/pages/:id", () => {
        gets += 1;
        return HttpResponse.json(f.pageDetail);
      }),
      http.patch("*/admin/sections/:id", () => {
        patches += 1;
        if (patches > 5) {
          throw new Error("runaway autosave: " + patches + " PATCH requests");
        }
        return HttpResponse.json(f.sampleSection);
      })
    );

    render(<Harness />);
    await screen.findByTestId(`section-card-${f.sampleSection.id}`);
    await act(async () => {
      await sleep(1500);
    });
    expect(patches).toBe(0);
    expect(gets).toBe(1);

    const hidden = document.querySelector(
      `[data-testid="section-card-${f.sampleSection.id}"] .MuiSwitch-input`
    ) as HTMLInputElement | null;
    expect(hidden).not.toBeNull();
    await act(async () => {
      hidden!.click();
      await sleep(2500);
    });

    expect(patches).toBe(1);
    expect(gets).toBe(2);
  }, 20000);
});
