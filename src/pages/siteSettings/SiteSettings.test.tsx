import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import SiteSettings from "./SiteSettings";
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
          <MemoryRouter initialEntries={["/site-settings"]}>
            <NotifyProvider>
              <SiteSettings />
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

const FULL_DRAFT = {
  siteName: "Western Montana Santa Flyover",
  tagline: null,
  homeNavLabel: "Home",
  logo: null,
  favicon: null,
  theme: {
    snowDefault: false,
    lightsDefault: true,
  },
  navExtraLinks: [],
  footerLinks: [],
  footerText: null,
  contactEmail: null,
  donateUrl: null,
  analyticsEnabled: false,
};

beforeEach(() => {
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  server.use(
    http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
      HttpResponse.json({
        ...f.siteSettingsDraft,
        data: FULL_DRAFT,
      })
    )
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("SiteSettings", () => {
  it("renders the form from the vendored schema (three theme switches)", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    // The theme field carries the three documented switches.
    expect(screen.getByTestId("theme-snow-default")).toBeInTheDocument();
    expect(screen.getByTestId("theme-lights-default")).toBeInTheDocument();
    expect(screen.getByTestId("theme-ornaments")).toBeInTheDocument();
    // The removed accent, surface, and font-pairing controls are gone.
    expect(screen.queryByTestId("theme-accent-blue")).toBeNull();
    expect(screen.queryByTestId("theme-surface-night")).toBeNull();
    expect(screen.queryByTestId("theme-font-pairing")).toBeNull();
  });

  it("save sends the whole document with PUT", async () => {
    const user = userEvent.setup();
    const captured: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/site-settings`,
        async ({ request }) => {
          const body = await request.json();
          captured.push({ url: request.url, body });
          return HttpResponse.json({
            ...f.siteSettingsDraft,
            data: FULL_DRAFT,
          });
        }
      )
    );
    render(<Harness />);
    // Wait for the theme field so the initial data is loaded.
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    // Flip the snow-default switch: this triggers onChange and dirties.
    const snow = screen.getByTestId("theme-snow-default").querySelector("input");
    if (snow) await user.click(snow);
    const save = await screen.findByTestId("site-settings-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.click(save);
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]?.body as { data?: Record<string, unknown> };
    expect(body?.data).toBeDefined();
    // The saved document carries every top-level property from the draft.
    for (const key of Object.keys(FULL_DRAFT)) {
      expect(body?.data).toHaveProperty(key);
    }
    // An unset landmarks list stays absent.
    expect(body?.data).not.toHaveProperty("landmarks");
    // The snow default flip is reflected.
    const theme = body?.data?.theme as { snowDefault?: boolean } | undefined;
    expect(theme?.snowDefault).toBe(true);
  });

  it("flipping the snow switch keeps ornaments: true in the saved theme", async () => {
    const user = userEvent.setup();
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: {
            ...FULL_DRAFT,
            theme: {
              snowDefault: false,
              lightsDefault: true,
              ornaments: true,
            },
          },
        })
      ),
      http.put(
        `${testConfig.apiBaseUrl}/admin/site-settings`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json({
            ...f.siteSettingsDraft,
            data: FULL_DRAFT,
          });
        }
      )
    );
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    const snow = screen
      .getByTestId("theme-snow-default")
      .querySelector("input");
    if (snow) await user.click(snow);
    const save = await screen.findByTestId("site-settings-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.click(save);
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]?.body as { data?: { theme?: Record<string, unknown> } };
    expect(body?.data?.theme?.snowDefault).toBe(true);
    expect(body?.data?.theme?.ornaments).toBe(true);
  });

  it("the ornaments switch writes ornaments: true", async () => {
    const user = userEvent.setup();
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.put(
        `${testConfig.apiBaseUrl}/admin/site-settings`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json({
            ...f.siteSettingsDraft,
            data: FULL_DRAFT,
          });
        }
      )
    );
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    const orn = screen.getByTestId("theme-ornaments").querySelector("input");
    if (orn) await user.click(orn);
    const save = await screen.findByTestId("site-settings-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.click(save);
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]?.body as { data?: { theme?: Record<string, unknown> } };
    expect(body?.data?.theme?.ornaments).toBe(true);
  });

  it("an unknown theme key survives a snow flip", async () => {
    const user = userEvent.setup();
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: {
            ...FULL_DRAFT,
            theme: {
              snowDefault: false,
              lightsDefault: true,
              ornaments: false,
              futureKey: "keep-me",
            },
          },
        })
      ),
      http.put(
        `${testConfig.apiBaseUrl}/admin/site-settings`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json({
            ...f.siteSettingsDraft,
            data: FULL_DRAFT,
          });
        }
      )
    );
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    const snow = screen
      .getByTestId("theme-snow-default")
      .querySelector("input");
    if (snow) await user.click(snow);
    const save = await screen.findByTestId("site-settings-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.click(save);
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]?.body as { data?: { theme?: Record<string, unknown> } };
    expect(body?.data?.theme?.futureKey).toBe("keep-me");
  });

  it("shows the site logo and the name switch right after Site name", async () => {
    const { container } = render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    const text = container.textContent ?? "";
    const nameAt = text.indexOf("Site name");
    const logoAt = text.indexOf("Site logo");
    const switchAt = text.indexOf("Show the site name next to the logo");
    const taglineAt = text.indexOf("Tagline");
    expect(logoAt).toBeGreaterThan(nameAt);
    expect(switchAt).toBeGreaterThan(logoAt);
    expect(taglineAt).toBeGreaterThan(switchAt);
    expect(text).toContain(
      "Shown in the header, and in any hero set to show the site logo. Upload an SVG or a transparent PNG."
    );
    // The logo is the optional media field: off until switched on.
    const logoSwitch = screen.getByRole("switch", { name: "Site logo" });
    expect(logoSwitch).not.toBeChecked();
  });

  it("the name switch reads on when absent and is disabled without a logo", async () => {
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    const sw = screen.getByRole("switch", {
      name: "Show the site name next to the logo",
    });
    expect(sw).toBeChecked();
    expect(sw).toBeDisabled();
    expect(screen.getByText("Set a site logo first")).toBeInTheDocument();
  });

  it("with a logo set, turning the name switch off writes false", async () => {
    const user = userEvent.setup();
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: {
            ...FULL_DRAFT,
            logoMedia: { mediaId: "m-logo", alt: null },
            headerShowsSiteName: null,
          },
        })
      ),
      http.put(
        `${testConfig.apiBaseUrl}/admin/site-settings`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json({
            ...f.siteSettingsDraft,
            data: FULL_DRAFT,
          });
        }
      )
    );
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    const sw = screen.getByRole("switch", {
      name: "Show the site name next to the logo",
    });
    expect(sw).toBeChecked();
    // Enabled once the draft with its logo has loaded.
    await waitFor(() => expect(sw).not.toBeDisabled());
    expect(screen.queryByText("Set a site logo first")).toBeNull();
    await user.click(sw);
    const save = await screen.findByTestId("site-settings-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.click(save);
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]?.body as { data?: Record<string, unknown> };
    expect(body?.data?.headerShowsSiteName).toBe(false);
  });

  it("renders problems from the draft response", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: FULL_DRAFT,
          problems: [
            { path: "siteName", message: "must be at least 1 character" },
          ],
        })
      )
    );
    render(<Harness />);
    expect(await screen.findByTestId("site-settings-problems")).toBeInTheDocument();
    expect(
      screen.getByText(/must be at least 1 character/i)
    ).toBeInTheDocument();
  });

  it("Preview site opens the preview dialog at home and mints a token", async () => {
    const user = userEvent.setup();
    let tokens = 0;
    server.use(
      http.post(
        `${testConfig.apiBaseUrl}/admin/content/preview-token`,
        () => {
          tokens += 1;
          return HttpResponse.json(f.previewToken, { status: 201 });
        }
      )
    );
    render(<Harness />);
    await waitFor(() =>
      expect(screen.getByTestId("theme-field")).toBeInTheDocument()
    );
    const button = screen.getByTestId("site-settings-preview");
    expect(button).toHaveTextContent(/^Preview site$/);
    await user.click(button);
    await waitFor(() => expect(tokens).toBeGreaterThan(0));
    const iframe = await screen.findByTestId("preview-iframe");
    expect(iframe.getAttribute("src")).not.toMatch(/[?&]page=/);
    expect(
      within(screen.getByTestId("preview-page-select")).getByText("Start at", {
      selector: "label",
    })
    ).toBeInTheDocument();
  });

  it("shows human labels, help, and no schema names or descriptions", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: {
            ...FULL_DRAFT,
            footerLinks: [
              { label: "Privacy", href: "/privacy", icon: null, newTab: false },
            ],
          },
        })
      )
    );
    const { container } = render(<Harness />);
    // The footer link's address field appears once the draft has loaded.
    await waitFor(() =>
      expect(container.textContent ?? "").toContain("Web address")
    );
    const text = container.textContent ?? "";
    for (const label of [
      "Site name",
      "Tagline",
      "Label for the home link in the menu",
      "Logo",
      "Browser tab icon",
      "Extra menu links",
      "Footer links",
      "Footer text",
      "Contact email",
      "Donate page address",
      "Count visits (analytics)",
      "Web address",
    ]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("The full https:// address of the donation page.");
    for (const name of [
      "siteName",
      "homeNavLabel",
      "navExtraLinks",
      "footerLinks",
      "footerText",
      "contactEmail",
      "donateUrl",
      "analyticsEnabled",
      "Href",
    ]) {
      expect(text).not.toContain(name);
    }
    expect(text).not.toContain("contracts");
  });

  // The schema form re-renders on every keystroke of the typed label, so the
  // test runs past the default timeout under the full suite.
  it("renders the Header links list after the menu links and saves it", async () => {
    const user = userEvent.setup();
    const captured: Array<Record<string, unknown>> = [];
    const facebook = {
      label: "Facebook",
      href: "https://facebook.com/wmsfo",
      icon: null,
      newTab: true,
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: { ...FULL_DRAFT, headerLinks: [facebook] },
        })
      ),
      http.put(
        `${testConfig.apiBaseUrl}/admin/site-settings`,
        async ({ request }) => {
          const body = (await request.json()) as { data: Record<string, unknown> };
          captured.push(body.data);
          return HttpResponse.json({ ...f.siteSettingsDraft, data: body.data });
        }
      )
    );
    const { container } = render(<Harness />);
    const card = await screen.findByTestId("link-list-item-0");
    const text = container.textContent ?? "";
    expect(text).toContain("Header links");
    expect(text).toContain(
      "Prominent links shown in the site header on every page, up to three, such as the Facebook page."
    );
    expect(text).not.toContain("headerLinks");
    expect(text.indexOf("Header links")).toBeGreaterThan(
      text.indexOf("Extra menu links")
    );
    expect(text.indexOf("Footer links")).toBeGreaterThan(
      text.indexOf("Header links")
    );
    const cardText = card.textContent ?? "";
    for (const label of [
      "Header link 1",
      "Link text",
      "Web address",
      "Icon",
      "Open in new tab",
    ]) {
      expect(cardText).toContain(label);
    }
    expect(within(card).getByDisplayValue("Facebook")).toBeInTheDocument();
    expect(
      within(card).getByDisplayValue("https://facebook.com/wmsfo")
    ).toBeInTheDocument();

    const labelInput = within(card).getByDisplayValue("Facebook");
    await user.clear(labelInput);
    await user.type(labelInput, "Find us on Facebook");
    const save = await screen.findByTestId("site-settings-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.click(save);
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    expect(captured[0]?.headerLinks).toEqual([
      { ...facebook, label: "Find us on Facebook" },
    ]);
  }, 20_000);

  it("carries no Route map display group", async () => {
    const { container } = render(<Harness />);
    await waitFor(() =>
      expect(container.textContent ?? "").toContain("Donate page address")
    );
    const text = container.textContent ?? "";
    for (const gone of ["Route map display", "Time labels", "Arrow size", "Route line"]) {
      expect(text).not.toContain(gone);
    }
    expect(screen.queryByTestId("route-map-sitewide")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Arrows" })).toBeNull();
  });

  it("the card opacity pair writes, clamps on blur, and clears its keys", async () => {
    const user = userEvent.setup();
    const captured: Array<{ body: unknown }> = [];
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/site-settings`, () =>
        HttpResponse.json({
          ...f.siteSettingsDraft,
          data: {
            ...FULL_DRAFT,
            theme: { ...FULL_DRAFT.theme, cardOpacityDark: 40 },
          },
        })
      ),
      http.put(
        `${testConfig.apiBaseUrl}/admin/site-settings`,
        async ({ request }) => {
          captured.push({ body: await request.json() });
          return HttpResponse.json({
            ...f.siteSettingsDraft,
            data: FULL_DRAFT,
          });
        }
      )
    );
    render(<Harness />);
    const light = await screen.findByTestId("theme-card-opacity-light");
    const dark = screen.getByTestId("theme-card-opacity-dark");
    await waitFor(() => expect(dark).toHaveValue(40));
    expect(
      screen.getByText("100 is a solid card; lower lets the backdrop show through")
    ).toBeInTheDocument();
    await user.type(light, "250");
    await user.tab();
    expect(light).toHaveValue(100);
    await user.clear(dark);
    await user.tab();
    const save = await screen.findByTestId("site-settings-save");
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.click(save);
    await waitFor(() => expect(captured.length).toBeGreaterThan(0));
    const body = captured[0]?.body as { data?: { theme?: Record<string, unknown> } };
    expect(body?.data?.theme?.cardOpacityLight).toBe(100);
    expect(body?.data?.theme).not.toHaveProperty("cardOpacityDark");
    expect(body?.data?.theme?.snowDefault).toBe(false);
  });
});

describe("SiteSettings help buttons (admin.md 6.26)", () => {
  it("mounts the header help and every group help of the default render", async () => {
    render(<Harness />);
    for (const key of [
      "site-settings",
      "site-settings.identity",
      "site-settings.theme",
      "site-settings.links",
      "site-settings.contact",
      "site-settings.viewpoints",
      "site-settings.places",
    ]) {
      expect(await screen.findByTestId(`help-${key}`)).toBeInTheDocument();
    }
  });
});
