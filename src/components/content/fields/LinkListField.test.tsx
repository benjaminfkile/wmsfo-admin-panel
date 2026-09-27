import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useState } from "react";
import SchemaForm from "../SchemaForm";
import { ConfigProvider } from "../../../ConfigContext";
import { buildTheme } from "../../../theme/theme";
import { testConfig } from "../../../test/renderWithProviders";
import hero from "../../../../contracts/schema/sections/hero.schema.json";

type Link = { label: string; href: string; icon: unknown; newTab: boolean };
type Hero = {
  title: string;
  tagline: string | null;
  icon: unknown;
  links: Link[];
  height: string;
};

function Harness({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
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

let latest: Hero | null = null;

function Controlled({ links }: { links: Link[] }) {
  const [data, setData] = useState<Hero>({
    title: "Heading",
    tagline: null,
    icon: null,
    links,
    height: "tall",
  });
  latest = data;
  return (
    <SchemaForm
      schema={hero as Record<string, unknown>}
      kind="hero"
      formData={data}
      onChange={(next) => setData(next as Hero)}
    />
  );
}

const readLinks = (): Link[] => latest?.links ?? [];

describe("LinkListField on the hero form", () => {
  it("renders the links list with its label and hint and no generic array controls", () => {
    render(
      <Harness>
        <Controlled links={[]} />
      </Harness>
    );
    const field = screen.getByTestId("link-list-field");
    expect(within(field).getByText("Call-to-action links")).toBeInTheDocument();
    expect(within(field).getByTestId("link-list-hint")).toHaveTextContent(
      "Up to 2 links"
    );
    expect(
      within(field).getByRole("button", { name: "Add link" })
    ).toBeEnabled();
    // The generic array widget's add button carries the "Add" title.
    expect(document.querySelector(".rjsf-array-item-add")).toBeNull();
    expect(screen.queryByTitle("Add")).toBeNull();
    expect(screen.queryByTitle("Remove")).toBeNull();
  });

  it("adds, edits, reorders, and removes links; Add is disabled at 2", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled links={[]} />
      </Harness>
    );
    const add = screen.getByRole("button", { name: "Add link" });

    await user.click(add);
    expect(readLinks()).toEqual([
      { label: "", href: "", icon: null, newTab: false },
    ]);
    await user.type(
      within(screen.getByTestId("link-list-control-0")).getByLabelText("Href"),
      "/first"
    );
    expect(readLinks()[0]!.href).toBe("/first");

    await user.click(add);
    expect(readLinks()).toHaveLength(2);
    expect(add).toBeDisabled();
    await user.type(
      within(screen.getByTestId("link-list-control-1")).getByLabelText("Href"),
      "/second"
    );
    expect(readLinks()[1]!.href).toBe("/second");

    await user.click(
      within(screen.getByTestId("link-list-item-0")).getByRole("button", {
        name: "Move link 1 down",
      })
    );
    expect(readLinks().map((l) => l.href)).toEqual(["/second", "/first"]);

    await user.click(
      within(screen.getByTestId("link-list-item-1")).getByRole("button", {
        name: "Move link 2 up",
      })
    );
    expect(readLinks().map((l) => l.href)).toEqual(["/first", "/second"]);

    await user.click(
      within(screen.getByTestId("link-list-item-0")).getByRole("button", {
        name: "Remove link 1",
      })
    );
    expect(readLinks().map((l) => l.href)).toEqual(["/second"]);
    expect(add).toBeEnabled();
  });

  it("starts with Add disabled when the hero already has 2 links", () => {
    render(
      <Harness>
        <Controlled
          links={[
            { label: "A", href: "/a", icon: null, newTab: false },
            { label: "B", href: "/b", icon: null, newTab: true },
          ]}
        />
      </Harness>
    );
    expect(screen.getByRole("button", { name: "Add link" })).toBeDisabled();
    // Remove stays enabled: the hero allows no links at all.
    expect(
      screen.getByRole("button", { name: "Remove link 1" })
    ).toBeEnabled();
  });
});
