import { beforeEach, describe, expect, it } from "vitest";
import { useState, type ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ConfigProvider } from "../../../ConfigContext";
import { buildTheme } from "../../../theme/theme";
import { installClient } from "../../../api/client";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../../test/renderWithProviders";
import { kindsFor } from "../routePreviewPois";
import PoisEditor from "./PoisEditor";

type RouteValue = {
  pois?: { kinds: string[] };
};

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <ConfigProvider config={testConfig}>
        <QueryClientProvider client={client}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

let latest: RouteValue = {};

function Controlled({ initial }: { initial: RouteValue }) {
  const [value, setValue] = useState<RouteValue>(initial);
  const write = (next: RouteValue) => {
    latest = next;
    setValue(next);
  };
  return (
    <PoisEditor
      value={value.pois}
      onChange={(next) => write({ ...value, pois: next })}
      title="Points of interest"
    />
  );
}

function renderForm(initial: RouteValue) {
  latest = initial;
  return render(
    <Providers>
      <Controlled initial={initial} />
    </Providers>
  );
}

beforeEach(() => {
  installClient({
    config: testConfig,
    userManager: makeFakeUserManager(
      makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
    ),
    onMfaRequired: () => undefined,
  });
});

describe("the route map Points of interest editor", () => {
  it("reads absent as Default and writes absent, empty, and the union", () => {
    renderForm({});
    const field = screen.getByTestId("pois-field");
    expect(within(field).getByText("Points of interest")).toBeInTheDocument();
    expect(within(field).getByRole("radio", { name: "Default" })).toBeChecked();
    expect(within(field).queryByTestId("pois-categories")).toBeNull();

    fireEvent.click(within(field).getByRole("radio", { name: "Custom" }));
    expect(latest.pois).toEqual({ kinds: [] });
    expect(within(field).getByText(/the map shows no places/i)).toBeInTheDocument();

    fireEvent.click(within(field).getByRole("checkbox", { name: "Groceries and stores" }));
    fireEvent.click(within(field).getByRole("checkbox", { name: "Gas and convenience" }));
    expect(latest.pois).toEqual({ kinds: kindsFor(["stores", "gas"]) });
    expect(latest.pois?.kinds.filter((k) => k === "convenience")).toHaveLength(1);

    fireEvent.click(within(field).getByRole("checkbox", { name: "Groceries and stores" }));
    expect(latest.pois).toEqual({ kinds: kindsFor(["gas"]) });

    fireEvent.click(within(field).getByRole("radio", { name: "Default" }));
    expect(latest.pois).toBeUndefined();
    expect(JSON.parse(JSON.stringify(latest))).not.toHaveProperty("pois");
  });

  it("shows a stored list as Custom with its categories checked", () => {
    renderForm({ pois: { kinds: kindsFor(["churches", "health"]) } });
    const field = screen.getByTestId("pois-field");
    expect(within(field).getByRole("radio", { name: "Custom" })).toBeChecked();
    expect(within(field).getByRole("checkbox", { name: "Churches" })).toBeChecked();
    expect(within(field).getByRole("checkbox", { name: "Health" })).toBeChecked();
    expect(within(field).getByRole("checkbox", { name: "Schools" })).not.toBeChecked();
  });
});
