import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import PostersList from "./PostersList";
import { copyName } from "./copyName";
import { ConfigProvider } from "../../ConfigContext";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { formatStamp } from "../../lib/time";
import { buildTheme } from "../../theme/theme";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";

const API = testConfig.apiBaseUrl;

function EditorMarker() {
  const { id } = useParams();
  return <div data-testid="poster-editor">{id}</div>;
}

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
          <MemoryRouter initialEntries={["/posters"]}>
            <NotifyProvider>
              <Routes>
                <Route path="/posters" element={<PostersList />} />
                <Route path="/posters/:id" element={<EditorMarker />} />
              </Routes>
            </NotifyProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  const um = makeFakeUserManager(
    makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] }),
  );
  installClient({ config: testConfig, userManager: um, onMfaRequired: () => undefined });
});

async function openMenu(name: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `Actions for ${name}` }));
  return { user, menu: await screen.findByRole("menu") };
}

describe("PostersList", () => {
  it("lists each poster with its name, recording, and update time", async () => {
    render(<Harness />);
    const main = await screen.findByTestId("poster-row-12");
    expect(within(main).getByRole("link", { name: "Main street" })).toHaveAttribute(
      "href",
      "/posters/12",
    );
    await waitFor(() => expect(main).toHaveTextContent(f.routes[0]!.name!));
    expect(main).toHaveTextContent(formatStamp(f.posters[0]!.updatedAt));
    expect(screen.getByTestId("poster-row-11")).toHaveTextContent("No recording");
    expect(screen.getByRole("link", { name: "Edit Main street" })).toHaveAttribute(
      "href",
      "/posters/12",
    );
  });

  it("offers Open, Duplicate, and Delete in the row menu; Open opens the editor", async () => {
    render(<Harness />);
    const { user, menu } = await openMenu("Main street");
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
      "Open",
      "Duplicate",
      "Delete",
    ]);
    await user.click(within(menu).getByRole("menuitem", { name: "Open" }));
    expect(await screen.findByTestId("poster-editor")).toHaveTextContent("12");
  });

  it("Create poster asks a name, creates it, and opens the editor", async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/admin/posters`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ...f.posters[0], id: 42, name: "Downtown" }, { status: 201 });
      }),
    );
    render(<Harness />);
    await user.click(await screen.findByTestId("poster-create"));
    const dialog = await screen.findByRole("dialog", { name: "Create poster" });
    const create = within(dialog).getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Name"), "  Downtown ");
    await user.click(create);
    expect(await screen.findByTestId("poster-editor")).toHaveTextContent("42");
    expect(bodies).toEqual([{ name: "Downtown" }]);
  });

  it("Duplicate creates a copy named \"<name> copy\" with the recording and the layout", async () => {
    const layout = { version: 1, theme: "dark", elements: [] };
    const bodies: unknown[] = [];
    server.use(
      http.get(`${API}/admin/posters/:id`, () =>
        HttpResponse.json({ ...f.posters[0], layout }),
      ),
      http.post(`${API}/admin/posters`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ ...f.posters[0], id: 43 }, { status: 201 });
      }),
    );
    render(<Harness />);
    const { user, menu } = await openMenu("Main street");
    await user.click(within(menu).getByRole("menuitem", { name: "Duplicate" }));
    await waitFor(() =>
      expect(bodies).toEqual([{ name: "Main street copy", routeId: 4, layout }]),
    );
    expect(await screen.findByText("Poster duplicated")).toBeInTheDocument();
    expect(screen.queryByTestId("poster-editor")).toBeNull();
  });

  it("names a duplicate after its source", () => {
    expect(copyName("Main street")).toBe("Main street copy");
    expect(copyName("Main street copy")).toBe("Main street copy copy");
  });

  it("Delete goes through the impact preview and deletes the poster", async () => {
    let deleted: string | null = null;
    server.use(
      http.get(`${API}/admin/posters/:id/impact`, () =>
        HttpResponse.json({
          blocked: null,
          deletes: [{ entity: "poster", count: 1, names: ["Main street"] }],
          unlinks: [],
          warnings: [],
        }),
      ),
      http.delete(`${API}/admin/posters/:id`, ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(<Harness />);
    const { user, menu } = await openMenu("Main street");
    await user.click(within(menu).getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Main street?" });
    expect(await within(dialog).findByText("1 poster: Main street")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleted).toBe("12"));
    expect(await screen.findByText("Poster deleted")).toBeInTheDocument();
  });
});

describe("PostersList help buttons (admin.md 6.26)", () => {
  it("mounts the header help and every card help of the default render", async () => {
    render(<Harness />);
    for (const key of ["posters"]) {
      expect(await screen.findByTestId(`help-${key}`)).toBeInTheDocument();
    }
  });
});
