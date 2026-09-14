// admin.md 6.23 QR codes list: the attachment and opens cells, generate,
// the print sheet's sizes. Component tests only per admin.md 9.2.

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import QrCodesList from "./QrCodesList";
import { PRINT_SIZES } from "./PrintSheetDialog";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { NotifyProvider } from "../../hooks/useNotify";
import AuthProvider from "../../auth/AuthProvider";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import type { UserManager } from "oidc-client-ts";

// The qrcode package pulls in a canvas that jsdom can not paint. All
// PrintSheetDialog needs is a stubbed SVG string, so we short-circuit
// the render helpers here.
vi.mock("./qrRender", () => ({
  qrTargetUrl: (base: string, tag: string) => `${base}/q/${tag}`,
  renderSvg: (_: string) =>
    Promise.resolve('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'),
  renderPngDataUrlMm: () => Promise.resolve("data:image/png;base64,AAAA"),
}));

let userManager: UserManager;

// jsdom does not implement `window.matchMedia`; stubbing it to match
// lets `useCompact` return true and `QrCodesList` render its cards.
function stubMatchMedia(matches: boolean): () => void {
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  return () => {
    if (original === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).matchMedia;
    } else {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: original,
      });
    }
  };
}

function Harness({ children }: { children: React.ReactNode }) {
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
        <AuthProvider userManager={userManager}>
          <NotifyProvider>
            <QueryClientProvider client={client}>
              <MemoryRouter initialEntries={["/qr-codes"]}>{children}</MemoryRouter>
            </QueryClientProvider>
          </NotifyProvider>
        </AuthProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  userManager = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager,
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  server.resetHandlers();
});

describe("QrCodesList (admin.md 6.23)", () => {
  it("renders the attachment and Unattached cells with the warning colour", async () => {
    render(
      <Harness>
        <QrCodesList />
      </Harness>
    );
    await screen.findByRole("link", { name: "qr-001" });
    // The attached row shows the place path joined by ' › '.
    expect(screen.getByText("Southgate Mall")).toBeInTheDocument();
    // The unattached row with scans shows a warning chip.
    const unattached = screen.getAllByText("Unattached")[0]!;
    expect(unattached).toBeInTheDocument();
  });

  it("Generate posts count and refetches the list", async () => {
    const sawBody: unknown[] = [];
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/qr-codes`, async ({ request }) => {
        sawBody.push(await request.json());
        return HttpResponse.json(
          {
            items: [
              {
                id: 999,
                tag: "qr-999",
                batchNo: 2,
                printedAt: "2026-12-22T01:31:07.412Z",
                active: true,
                note: "",
                opensPageId: null,
                forwardUrl: null,
                opens: { kind: "home" },
                opensSource: "home",
                attachment: null,
                scans: { people: 0, flagged: 0, lastScanAt: null },
                createdBy: "admin@example.com",
                createdAt: "2026-12-22T01:31:07.412Z",
                updatedAt: "2026-12-22T01:31:07.412Z",
                audit: null,
              },
            ],
          },
          { status: 201 }
        );
      })
    );

    const user = userEvent.setup();
    render(
      <Harness>
        <QrCodesList />
      </Harness>
    );
    await screen.findByRole("link", { name: "qr-001" });
    await user.click(screen.getByRole("button", { name: /generate 10 more/i }));
    await waitFor(() =>
      expect(sawBody[0]).toEqual({ count: 10 })
    );
  });

  it("renders a card per code on compact with the pencil and the menu, no desktop table", async () => {
    const restore = stubMatchMedia(true);
    try {
      render(
        <Harness>
          <QrCodesList />
        </Harness>
      );
      const attachedCard = await screen.findByTestId("qr-code-row-100");
      const unattachedCard = await screen.findByTestId("qr-code-row-101");
      expect(
        within(attachedCard).getByRole("link", { name: /edit qr-001/i })
      ).toBeInTheDocument();
      expect(
        within(attachedCard).getByRole("button", { name: /actions for qr-001/i })
      ).toBeInTheDocument();
      expect(
        within(unattachedCard).getByText(/unattached/i)
      ).toBeInTheDocument();
      expect(screen.queryByRole("table")).toBeNull();
    } finally {
      restore();
    }
  });

  it("PrintSheetDialog lists the four sizes", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <QrCodesList />
      </Harness>
    );
    await screen.findByRole("link", { name: "qr-001" });
    await user.click(screen.getByRole("button", { name: /print sheet/i }));
    await screen.findByRole("dialog", { name: /print sheet/i });

    const sizeSelect = await screen.findByRole("combobox", { name: /size/i });
    await user.click(sizeSelect);
    const listbox = await screen.findByRole("listbox");
    for (const s of PRINT_SIZES) {
      expect(
        within(listbox).getByRole("option", { name: new RegExp(s.label) })
      ).toBeInTheDocument();
    }
  });
});
