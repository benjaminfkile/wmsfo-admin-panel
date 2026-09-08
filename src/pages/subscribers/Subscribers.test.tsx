import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import Subscribers from "./Subscribers";
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
          <MemoryRouter initialEntries={["/subscribers"]}>
            <NotifyProvider>
              <Subscribers />
            </NotifyProvider>
          </MemoryRouter>
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

afterEach(() => {
  server.resetHandlers();
});

describe("Subscribers", () => {
  it("renders the summary counts and a row per subscriber", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByText(/verified: 812/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/pending: 40/i)).toBeInTheDocument();
    expect(screen.getByText(/unsubscribed: 12/i)).toBeInTheDocument();
    await screen.findByTestId(`subscriber-row-${f.subscribers[0]!.id}`);
  });

  it("CSV export walks nextCursor and writes the documented header", async () => {
    const user = userEvent.setup();
    // Capture blob text by wrapping the Blob constructor.
    const capturedTexts: string[] = [];
    const OriginalBlob = globalThis.Blob;
    globalThis.Blob = class extends OriginalBlob {
      constructor(parts?: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        capturedTexts.push(
          (parts ?? []).map((p) => (typeof p === "string" ? p : "")).join("")
        );
      }
    } as typeof Blob;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => "blob:mock";
    URL.revokeObjectURL = () => undefined;

    const requests: URL[] = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/subscribers`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        // Return by cursor: no cursor is page 1 (limit determines which).
        const cursor = url.searchParams.get("cursor");
        const limit = url.searchParams.get("limit");
        if (limit === "50") {
          return HttpResponse.json({
            items: [f.subscribers[0]],
            nextCursor: null,
          });
        }
        // Export uses limit=500.
        if (!cursor) {
          return HttpResponse.json({
            items: [f.subscribers[0]],
            nextCursor: "page-2",
          });
        }
        if (cursor === "page-2") {
          return HttpResponse.json({
            items: [{ ...f.subscribers[0], id: 2, personId: 2 }],
            nextCursor: "page-3",
          });
        }
        return HttpResponse.json({
          items: [{ ...f.subscribers[0], id: 3, personId: 3 }],
          nextCursor: null,
        });
      })
    );

    render(<Harness />);
    const exportBtn = await screen.findByTestId("subscribers-export-csv");
    await user.click(exportBtn);
    await waitFor(() => expect(capturedTexts.length).toBeGreaterThan(0));
    // Export requests have limit=500.
    const exportRequests = requests.filter(
      (u) => u.searchParams.get("limit") === "500"
    );
    expect(exportRequests.length).toBe(3);
    // Second export request carries cursor=page-2.
    expect(exportRequests[1]!.searchParams.get("cursor")).toBe("page-2");
    // Third exports cursor=page-3.
    expect(exportRequests[2]!.searchParams.get("cursor")).toBe("page-3");
    // The CSV starts with the documented header. Other blob constructions
    // (MSW response bodies) may appear too, so filter to the CSV.
    const text = capturedTexts.find((t) =>
      t.startsWith("id,personId,personEmail,")
    );
    expect(text).toBeDefined();
    expect(text!.startsWith(
      "id,personId,personEmail,channel,address,verifiedAt,unsubscribedAt,createdAt\r\n"
    )).toBe(true);
    // Three data rows follow.
    const lines = text!.split("\r\n").filter((l) => l.length > 0);
    expect(lines.length).toBe(4);
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    globalThis.Blob = OriginalBlob;
  });
});
