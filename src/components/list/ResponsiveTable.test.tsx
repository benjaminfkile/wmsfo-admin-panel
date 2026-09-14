import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ThemeProvider, CssBaseline, Chip } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ResponsiveTable, { type Column } from "./ResponsiveTable";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

// jsdom does not implement `window.matchMedia`; MUI's `useMediaQuery`
// reads it. Toggle the stub per test.
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

interface Row {
  id: number;
  name: string;
  year: number;
  status: string;
  route: string;
}

const ROWS: Row[] = [
  { id: 1, name: "Alpha", year: 2026, status: "Live", route: "R1" },
  { id: 2, name: "Bravo", year: 2025, status: "Ended", route: "R2" },
];

const COLUMNS: Column<Row>[] = [
  {
    key: "year",
    header: "Year",
    role: "subtitle",
    render: (r) => String(r.year),
  },
  {
    key: "name",
    header: "Name",
    role: "title",
    render: (r) => r.name,
  },
  {
    key: "status",
    header: "Status",
    role: "chip",
    render: (r) => <Chip size="small" label={r.status} />,
  },
  {
    key: "route",
    header: "Route",
    role: "line",
    render: (r) => r.route,
  },
];

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

afterEach(() => {
  server.resetHandlers();
});

describe("ResponsiveTable on desktop (admin.md 1)", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("renders the table with the columns, the actions, and the audit cell", () => {
    restore = stubMatchMedia(false);
    render(
      <Harness>
        <ResponsiveTable<Row>
          rows={ROWS}
          columns={COLUMNS}
          rowKey={(r) => String(r.id)}
          rowTestId={(r) => `row-${r.id}`}
          emptyText="Empty."
          actions={(r) => (
            <button aria-label={`Edit ${r.name}`}>edit</button>
          )}
          audit={(r) => ({
            entity: "widget",
            entityId: r.id,
            name: r.name,
            audit: null,
          })}
        />
      </Harness>
    );
    // Table renders a head cell for every column plus Actions and Audit.
    const table = screen.getByRole("table");
    within(table).getByText("Year");
    within(table).getByText("Name");
    within(table).getByText("Status");
    within(table).getByText("Route");
    within(table).getByText("Actions");
    within(table).getByText("Audit");
    for (const r of ROWS) {
      const row = screen.getByTestId(`row-${r.id}`);
      expect(within(row).getByText(String(r.year))).toBeInTheDocument();
      expect(within(row).getByText(r.name)).toBeInTheDocument();
      expect(within(row).getByText(r.status)).toBeInTheDocument();
      expect(within(row).getByText(r.route)).toBeInTheDocument();
      expect(
        within(row).getByRole("button", { name: `Edit ${r.name}` })
      ).toBeInTheDocument();
      // Audit button is the last td.
      const cells = row.querySelectorAll("td");
      const last = cells[cells.length - 1];
      expect(last?.querySelector('button[aria-label^="Audit "]')).not.toBeNull();
    }
  });

  it("shows the empty state as one row spanning every column", () => {
    restore = stubMatchMedia(false);
    render(
      <Harness>
        <ResponsiveTable<Row>
          rows={[]}
          columns={COLUMNS}
          rowKey={(r) => String(r.id)}
          emptyText="Nothing here."
          actions={() => <span />}
          audit={() => ({
            entity: "widget",
            entityId: "-",
            name: "-",
            audit: null,
          })}
        />
      </Harness>
    );
    // 4 columns + Actions + Audit = 6 cells wide.
    const cell = screen.getByText("Nothing here.").closest("td");
    expect(cell).not.toBeNull();
    expect(cell?.getAttribute("colspan")).toBe("6");
  });
});

describe("ResponsiveTable on compact (admin.md 1)", () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    restore?.();
    restore = null;
  });

  it("renders one card per row with the title, the chips, the lines, the actions, and the audit button", () => {
    restore = stubMatchMedia(true);
    render(
      <Harness>
        <ResponsiveTable<Row>
          rows={ROWS}
          columns={COLUMNS}
          rowKey={(r) => String(r.id)}
          rowTestId={(r) => `row-${r.id}`}
          emptyText="Empty."
          actions={(r) => (
            <button aria-label={`Edit ${r.name}`}>edit</button>
          )}
          audit={(r) => ({
            entity: "widget",
            entityId: r.id,
            name: r.name,
            audit: null,
          })}
        />
      </Harness>
    );
    // No table on compact.
    expect(screen.queryByRole("table")).toBeNull();
    for (const r of ROWS) {
      const card = screen.getByTestId(`row-${r.id}`);
      // Title, subtitle, chip, line, actions, audit button all present.
      expect(within(card).getByText(r.name)).toBeInTheDocument();
      expect(within(card).getByText(String(r.year))).toBeInTheDocument();
      expect(within(card).getByText(r.status)).toBeInTheDocument();
      // Line rendered as "Route: <value>".
      expect(within(card).getByText(/route:/i)).toBeInTheDocument();
      expect(within(card).getByText(r.route)).toBeInTheDocument();
      expect(
        within(card).getByRole("button", { name: `Edit ${r.name}` })
      ).toBeInTheDocument();
      expect(
        within(card).getByRole("button", { name: `Audit ${r.name}` })
      ).toBeInTheDocument();
    }
  });

  it("shows the empty state as secondary text without a table", () => {
    restore = stubMatchMedia(true);
    render(
      <Harness>
        <ResponsiveTable<Row>
          rows={[]}
          columns={COLUMNS}
          rowKey={(r) => String(r.id)}
          emptyText="Nothing here yet."
        />
      </Harness>
    );
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
