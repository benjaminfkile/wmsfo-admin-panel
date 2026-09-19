import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import EmailQuotaNotice from "./EmailQuotaNotice";
import { installClient } from "../api/client";
import { server } from "../test/msw/server";
import { buildTheme } from "../theme/theme";
import { ConfigProvider } from "../ConfigContext";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../test/renderWithProviders";
import type { EmailQuota } from "../api/types";

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
          <EmailQuotaNotice />
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

function useQuota(q: EmailQuota) {
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/email/quota`, () =>
      HttpResponse.json(q)
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

afterEach(() => {
  server.resetHandlers();
});

describe("EmailQuotaNotice", () => {
  it("renders nothing when the send fits", async () => {
    useQuota({
      available: true,
      dryRun: false,
      max24HourSend: 50000,
      sentLast24Hours: 120,
      maxSendRate: 14,
      queued: 0,
      remaining: 49880,
      verifiedSubscribers: 812,
      wouldExceed: false,
      fetchedAt: "2026-12-22T01:31:07.412Z",
    });
    const { container } = render(<Harness />);
    await waitFor(() => {
      expect(container.textContent ?? "").not.toContain("email quota");
    });
    expect(screen.queryByTestId("email-quota-warning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("email-quota-unknown")).not.toBeInTheDocument();
  });

  it("renders the warning with the right arithmetic when the send would not fit", async () => {
    useQuota({
      available: true,
      dryRun: false,
      max24HourSend: 1000,
      sentLast24Hours: 950,
      maxSendRate: 14,
      queued: 40,
      remaining: 10,
      verifiedSubscribers: 1500,
      wouldExceed: true,
      fetchedAt: "2026-12-22T01:31:07.412Z",
    });
    render(<Harness />);
    const warning = await screen.findByTestId("email-quota-warning");
    expect(warning.textContent).toContain("SES allows 10 more emails");
    expect(warning.textContent).toContain("950 sent");
    expect(warning.textContent).toContain("40 waiting");
    expect(warning.textContent).toContain("limit 1,000");
    expect(warning.textContent).toContain("1,500 verified subscribers");
    expect(warning.textContent).toContain("about 1,490 would be refused");
  });

  it("renders the unknown notice when unavailable", async () => {
    useQuota({
      available: false,
      dryRun: false,
      max24HourSend: null,
      sentLast24Hours: null,
      maxSendRate: null,
      queued: 3,
      remaining: null,
      verifiedSubscribers: 812,
      wouldExceed: false,
      fetchedAt: "2026-12-22T01:31:07.412Z",
    });
    render(<Harness />);
    expect(await screen.findByTestId("email-quota-unknown")).toBeInTheDocument();
  });

  it("renders nothing on dry run", async () => {
    useQuota({
      available: false,
      dryRun: true,
      max24HourSend: null,
      sentLast24Hours: null,
      maxSendRate: null,
      queued: 0,
      remaining: null,
      verifiedSubscribers: 812,
      wouldExceed: false,
      fetchedAt: "2026-12-22T01:31:07.412Z",
    });
    const { container } = render(<Harness />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByTestId("email-quota-warning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("email-quota-unknown")).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
  });

  it("renders the unknown notice when the request fails", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/email/quota`, () =>
        HttpResponse.json({ code: "boom", message: "boom", details: null, requestId: "r" }, { status: 500 })
      )
    );
    render(<Harness />);
    expect(await screen.findByTestId("email-quota-unknown")).toBeInTheDocument();
  });
});
