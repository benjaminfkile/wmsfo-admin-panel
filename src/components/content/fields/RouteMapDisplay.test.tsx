import { beforeEach, describe, it, expect } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import SchemaForm from "../SchemaForm";
import { SITE_SETTINGS } from "../labels";
import { buildTheme } from "../../../theme/theme";
import { installClient } from "../../../api/client";
import { server } from "../../../test/msw/server";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../../test/renderWithProviders";
import { siteSettingsDraft } from "../../../test/msw/fixtures";
import kindsJson from "../../../../contracts/kinds.json";
import routePreview from "../../../../contracts/schema/sections/route_preview.schema.json";
import siteSettingsSchema from "../../../../contracts/schema/site-settings.schema.json";
import { resolveDisplayKey, withDisplayKey } from "../routeMapDisplay";

type Sch = Record<string, unknown>;
type Doc = Record<string, unknown>;

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <ThemeProvider theme={buildTheme("light")}>
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function SiteForm({ initial }: { initial: Doc }) {
  const [value, setValue] = useState<Doc>(initial);
  return (
    <>
      <SchemaForm
        schema={siteSettingsSchema as Sch}
        labels={SITE_SETTINGS}
        uiSchema={{ theme: { "ui:field": "ThemeField" } }}
        formData={value}
        onChange={(next) => setValue(next as Doc)}
      />
      <pre data-testid="value">{JSON.stringify(value.routeMap ?? null)}</pre>
    </>
  );
}

function SectionForm({ initial }: { initial: Doc }) {
  const [value, setValue] = useState<Doc>(initial);
  return (
    <>
      <SchemaForm
        schema={routePreview as Sch}
        kind="route_preview"
        formData={value}
        onChange={(next) => setValue(next as Doc)}
      />
      <pre data-testid="value">{JSON.stringify(value.display ?? null)}</pre>
      <pre data-testid="has-display">{String("display" in value && value.display !== undefined)}</pre>
    </>
  );
}

function routeDefaults(): Doc {
  const kind = (
    kindsJson as { kinds: Array<{ kind: string; defaults: unknown }> }
  ).kinds.find((k) => k.kind === "route_preview");
  return structuredClone(kind!.defaults) as Doc;
}

function written(): unknown {
  return JSON.parse(screen.getByTestId("value").textContent ?? "null");
}

function pick(name: RegExp, option: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name }));
  const listbox = screen.getByRole("listbox");
  fireEvent.click(within(listbox).getByRole("option", { name: option }));
}

function useSitewide(routeMap: Doc | undefined) {
  server.use(
    http.get("*/admin/site-settings", () =>
      HttpResponse.json({
        ...siteSettingsDraft,
        data: routeMap ? { ...(siteSettingsDraft.data as Doc), routeMap } : siteSettingsDraft.data,
      })
    )
  );
}

describe("routeMapDisplay helpers", () => {
  it("resolves each key from the first level that sets a valid value, else the default", () => {
    expect(resolveDisplayKey([{ arrowSize: "large" }, { arrowSize: "small" }], "arrowSize")).toBe("large");
    expect(resolveDisplayKey([{}, { arrowSize: "small" }], "arrowSize")).toBe("small");
    expect(resolveDisplayKey([{ arrowSize: "huge" }], "arrowSize")).toBe("medium");
    expect(resolveDisplayKey([undefined], "timeLabelIntervalMinutes")).toBe(15);
    expect(resolveDisplayKey([{ arrows: false }], "arrows")).toBe(false);
    expect(resolveDisplayKey([null], "routeWidth")).toBe("normal");
  });

  it("sets and removes one key and returns undefined for an empty block", () => {
    expect(withDisplayKey(undefined, "arrows", false)).toEqual({ arrows: false });
    expect(withDisplayKey({ arrows: false, routeWidth: "thin" }, "arrows", undefined)).toEqual({
      routeWidth: "thin",
    });
    expect(withDisplayKey({ arrows: false }, "arrows", undefined)).toBeUndefined();
  });
});

describe("Site settings: the Route map group", () => {
  it("shows the built-in defaults while unset and writes nothing", () => {
    render(
      <Providers>
        <SiteForm initial={{ siteName: "WMSFO" }} />
      </Providers>
    );
    const group = screen.getByTestId("route-map-sitewide");
    expect(within(group).getByText("Route map")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /time labels/i })).toHaveTextContent(
      "Every 15 minutes"
    );
    expect(screen.getByRole("switch", { name: "Arrows" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /arrow size/i })).toHaveTextContent("Medium");
    expect(screen.getByRole("combobox", { name: /route line/i })).toHaveTextContent("Normal");
    expect(within(group).getByText("How thick the route line is drawn.")).toBeInTheDocument();
    expect(written()).toBeNull();
  });

  it("writes only each picked value", () => {
    render(
      <Providers>
        <SiteForm initial={{ siteName: "WMSFO" }} />
      </Providers>
    );
    pick(/time labels/i, "Off");
    expect(written()).toEqual({ timeLabelIntervalMinutes: 0 });
    fireEvent.click(screen.getByRole("switch", { name: "Arrows" }));
    expect(written()).toEqual({ timeLabelIntervalMinutes: 0, arrows: false });
    pick(/arrow size/i, "Extra large");
    pick(/route line/i, "Extra thick");
    expect(written()).toEqual({
      timeLabelIntervalMinutes: 0,
      arrows: false,
      arrowSize: "xlarge",
      routeWidth: "xthick",
    });
    expect(screen.getByRole("combobox", { name: /time labels/i })).toHaveTextContent("Off");
  });

  it("shows stored values", () => {
    render(
      <Providers>
        <SiteForm
          initial={{
            siteName: "WMSFO",
            routeMap: { timeLabelIntervalMinutes: 5, arrows: false, routeWidth: "thick" },
          }}
        />
      </Providers>
    );
    expect(screen.getByRole("combobox", { name: /time labels/i })).toHaveTextContent(
      "Every 5 minutes"
    );
    expect(screen.getByRole("switch", { name: "Arrows" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: /route line/i })).toHaveTextContent("Thick");
  });
});

describe("route_preview: the Route map display override group", () => {
  beforeEach(() => {
    installClient({
      config: testConfig,
      userManager: makeFakeUserManager(
        makeUser({ email: "editor@example.com", "cognito:groups": ["editor"] })
      ),
      onMfaRequired: () => undefined,
    });
  });

  it("shows the built-in value as the site default when the site sets nothing", async () => {
    useSitewide(undefined);
    render(
      <Providers>
        <SectionForm initial={routeDefaults()} />
      </Providers>
    );
    expect(await screen.findByTestId("route-map-override")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /time labels/i })).toHaveTextContent(
      "Site default (Every 15 minutes)"
    );
    expect(screen.getByRole("combobox", { name: /^arrows/i })).toHaveTextContent(
      "Site default (On)"
    );
    expect(screen.getByRole("combobox", { name: /arrow size/i })).toHaveTextContent(
      "Site default (Medium)"
    );
    expect(screen.getByRole("combobox", { name: /route line/i })).toHaveTextContent(
      "Site default (Normal)"
    );
    expect(screen.queryByRole("button", { name: /^clear/i })).toBeNull();
    expect(screen.getByTestId("has-display").textContent).toBe("false");
  });

  it("shows the sitewide value as the site default", async () => {
    useSitewide({ arrows: false, routeWidth: "thin", timeLabelIntervalMinutes: 30 });
    render(
      <Providers>
        <SectionForm initial={routeDefaults()} />
      </Providers>
    );
    expect(await screen.findByText("Site default (Off)")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /route line/i })).toHaveTextContent(
      "Site default (Thin)"
    );
    expect(screen.getByRole("combobox", { name: /time labels/i })).toHaveTextContent(
      "Site default (Every 30 minutes)"
    );
    expect(screen.getByRole("combobox", { name: /arrow size/i })).toHaveTextContent(
      "Site default (Medium)"
    );
    expect(screen.getByTestId("has-display").textContent).toBe("false");
  });

  it("writes a pick per key and clears each key back to inherit", async () => {
    useSitewide({ arrows: false });
    render(
      <Providers>
        <SectionForm initial={routeDefaults()} />
      </Providers>
    );
    await screen.findByText("Site default (Off)");
    pick(/^arrows/i, "On");
    expect(written()).toEqual({ arrows: true });
    pick(/route line/i, "Extra thick");
    expect(written()).toEqual({ arrows: true, routeWidth: "xthick" });
    expect(screen.getByRole("combobox", { name: /route line/i })).toHaveTextContent("Extra thick");

    fireEvent.click(screen.getByRole("button", { name: "Clear Arrows" }));
    expect(written()).toEqual({ routeWidth: "xthick" });
    expect(screen.getByRole("combobox", { name: /^arrows/i })).toHaveTextContent(
      "Site default (Off)"
    );
    expect(screen.queryByRole("button", { name: "Clear Arrows" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear Route line" }));
    expect(written()).toBeNull();
    expect(screen.getByTestId("has-display").textContent).toBe("false");
  });

  it("shows a stored override with its Clear", async () => {
    useSitewide(undefined);
    render(
      <Providers>
        <SectionForm
          initial={{ ...routeDefaults(), display: { timeLabelIntervalMinutes: 10 } }}
        />
      </Providers>
    );
    expect(await screen.findByRole("combobox", { name: /time labels/i })).toHaveTextContent(
      "Every 10 minutes"
    );
    expect(screen.getByRole("button", { name: "Clear Time labels" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Arrow size" })).toBeNull();
  });
});
