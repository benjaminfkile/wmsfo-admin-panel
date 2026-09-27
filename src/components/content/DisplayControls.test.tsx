import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useState } from "react";
import DisplayControls from "./DisplayControls";
import type { Display } from "./display";
import SchemaForm from "./SchemaForm";
import PresentationPanel from "./PresentationPanel";
import { ConfigProvider } from "../../ConfigContext";
import { installClient } from "../../api/client";
import { buildTheme } from "../../theme/theme";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../test/renderWithProviders";
import type { Presentation } from "../../api/types";

function Harness({ children }: { children: ReactNode }) {
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

// Holds an owner object with an optional `display` and prints it as JSON.
function ControlledDisplay({ initial }: { initial?: Display }) {
  const [owner, setOwner] = useState<{ id: string; display?: Display }>(
    initial ? { id: "x", display: initial } : { id: "x" }
  );
  return (
    <>
      <DisplayControls
        value={owner.display}
        onChange={(d) =>
          setOwner(d ? { id: "x", display: d } : { id: "x" })
        }
      />
      <pre data-testid="owner-json">{JSON.stringify(owner)}</pre>
    </>
  );
}

function readOwner(): { id: string; display?: Display } {
  return JSON.parse(screen.getByTestId("owner-json").textContent ?? "{}");
}

async function openAdvanced(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement = document.body
) {
  await user.click(within(scope).getByRole("button", { name: /^Advanced/ }));
}

async function pickOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
  scope: HTMLElement = document.body
) {
  await user.click(within(scope).getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("DisplayControls", () => {
  it("is collapsed by default and reads customised when any key is set", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Harness>
        <ControlledDisplay />
      </Harness>
    );
    expect(screen.getByRole("button", { name: "Advanced" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Size (px)")).not.toBeInTheDocument();
    await openAdvanced(user);
    expect(screen.getByLabelText("Size (px)")).toBeInTheDocument();
    unmount();

    render(
      <Harness>
        <ControlledDisplay initial={{ shadow: true }} />
      </Harness>
    );
    expect(
      screen.getByRole("button", { name: "Advanced (customised)" })
    ).toBeInTheDocument();
  });

  it("writes each key, and only the keys that are set", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <ControlledDisplay />
      </Harness>
    );
    await openAdvanced(user);

    await user.type(screen.getByLabelText("Size (px)"), "64");
    expect(readOwner().display).toEqual({ sizePx: 64 });
    expect(screen.getByText("Empty uses the normal size")).toBeInTheDocument();

    await pickOption(user, "Fit", "Cover");
    expect(readOwner().display).toMatchObject({ fit: "cover" });
    await pickOption(user, "Shape", "Circle");
    expect(readOwner().display).toMatchObject({ shape: "circle" });

    await user.type(screen.getByLabelText("Padding (px)"), "8");
    expect(readOwner().display).toMatchObject({ paddingPx: 8 });

    await pickOption(user, "Background", "Accent");
    expect(readOwner().display).toMatchObject({ background: "accent" });

    await user.click(screen.getByRole("switch", { name: "Shadow" }));
    expect(readOwner().display).toMatchObject({ shadow: true });

    await pickOption(user, "Alignment", "End");
    expect(readOwner().display).toEqual({
      sizePx: 64,
      fit: "cover",
      shape: "circle",
      paddingPx: 8,
      background: "accent",
      shadow: true,
      align: "end",
    });

    await pickOption(user, "Fit", "Default");
    expect(readOwner().display).not.toHaveProperty("fit");
    await user.click(screen.getByRole("switch", { name: "Shadow" }));
    expect(readOwner().display).not.toHaveProperty("shadow");
  });

  it("removes sizePx when the size is emptied, and display when nothing is left", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <ControlledDisplay initial={{ sizePx: 40 }} />
      </Harness>
    );
    await openAdvanced(user);
    await user.clear(screen.getByLabelText("Size (px)"));
    expect(readOwner()).toEqual({ id: "x" });
  });

  it("clamps out of range numbers on blur", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <ControlledDisplay />
      </Harness>
    );
    await openAdvanced(user);
    const size = screen.getByLabelText("Size (px)");
    await user.type(size, "900");
    await user.tab();
    expect(readOwner().display).toEqual({ sizePx: 600 });
    expect(size).toHaveValue(600);

    await user.clear(size);
    await user.type(size, "3");
    await user.tab();
    expect(readOwner().display).toEqual({ sizePx: 12 });

    const padding = screen.getByLabelText("Padding (px)");
    await user.type(padding, "99");
    await user.tab();
    expect(readOwner().display).toMatchObject({ paddingPx: 48 });
  });

  it("Reset removes display", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <ControlledDisplay initial={{ shape: "rounded", sizePx: 80 }} />
      </Harness>
    );
    await openAdvanced(user);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(readOwner()).toEqual({ id: "x" });
    expect(screen.getByRole("button", { name: "Advanced" })).toBeInTheDocument();
  });
});

const fieldSchema = {
  type: "object",
  properties: {
    icon: {
      $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/Icon",
    },
    media: {
      $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/MediaRef",
    },
  },
} as const;

type FieldData = { icon: unknown; media: unknown };

function ControlledForm({ initial }: { initial: FieldData }) {
  const [data, setData] = useState<FieldData>(initial);
  return (
    <>
      <SchemaForm
        schema={fieldSchema as unknown as Record<string, unknown>}
        formData={data}
        onChange={(next) => setData(next as unknown as FieldData)}
      />
      <pre data-testid="form-json">{JSON.stringify(data)}</pre>
    </>
  );
}

function readForm(): FieldData {
  return JSON.parse(screen.getByTestId("form-json").textContent ?? "{}");
}

describe("DisplayControls in the forms", () => {
  it("IconField and MediaField include it and values survive a round trip", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <ControlledForm
          initial={{
            icon: {
              source: "library",
              id: "cookie",
              display: { sizePx: 48, shape: "circle" },
            },
            media: {
              mediaId: "m1",
              alt: null,
              display: { fit: "cover", shadow: true },
            },
          }}
        />
      </Harness>
    );

    const iconField = screen.getByTestId("icon-field");
    const mediaField = screen.getByTestId("media-field");
    // Collapsed, and the raw display fields do not render.
    expect(screen.queryByLabelText("Size (px)")).not.toBeInTheDocument();
    expect(screen.queryByText("sizePx")).not.toBeInTheDocument();
    expect(
      within(iconField).getByRole("button", { name: "Advanced (customised)" })
    ).toBeInTheDocument();
    expect(
      within(mediaField).getByRole("button", { name: "Advanced (customised)" })
    ).toBeInTheDocument();

    await openAdvanced(user, iconField);
    expect(within(iconField).getByLabelText("Size (px)")).toHaveValue(48);
    await pickOption(user, "Alignment", "Centre", iconField);
    expect(readForm().icon).toEqual({
      source: "library",
      id: "cookie",
      display: { sizePx: 48, shape: "circle", align: "center" },
    });

    await openAdvanced(user, mediaField);
    expect(
      within(mediaField).getByRole("switch", { name: "Shadow" })
    ).toBeChecked();
    await user.type(within(mediaField).getByLabelText("Padding (px)"), "4");
    expect(readForm().media).toEqual({
      mediaId: "m1",
      alt: null,
      display: { fit: "cover", shadow: true, paddingPx: 4 },
    });

    await user.click(within(mediaField).getByRole("button", { name: "Reset" }));
    expect(readForm().media).toEqual({ mediaId: "m1", alt: null });
    expect(readForm().icon).toMatchObject({
      display: { sizePx: 48, shape: "circle", align: "center" },
    });
  });

  it("the media block editor includes it", async () => {
    const user = userEvent.setup();
    const blockSchema = {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          items: {
            $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/Block",
          },
        },
      },
    };
    function Blocks() {
      const [data, setData] = useState<{ blocks: unknown[] }>({
        blocks: [
          {
            kind: "media",
            media: { mediaId: "m1", alt: null },
            caption: null,
            size: "medium",
          },
        ],
      });
      return (
        <>
          <SchemaForm
            schema={blockSchema as unknown as Record<string, unknown>}
            formData={data}
            onChange={(next) => setData(next as { blocks: unknown[] })}
          />
          <pre data-testid="blocks-json">{JSON.stringify(data)}</pre>
        </>
      );
    }
    render(
      <Harness>
        <Blocks />
      </Harness>
    );
    const body = screen.getByTestId("block-media");
    await openAdvanced(user, body);
    await pickOption(user, "Shape", "Rounded", body);
    const blocks = JSON.parse(
      screen.getByTestId("blocks-json").textContent ?? "{}"
    ) as { blocks: Array<{ media: unknown }> };
    expect(blocks.blocks[0]!.media).toEqual({
      mediaId: "m1",
      alt: null,
      display: { shape: "rounded" },
    });
  });

  it("the presentation icons and background image each include it", async () => {
    const user = userEvent.setup();
    let last: Presentation | null = null;
    render(
      <Harness>
        <PresentationPanel
          value={
            {
              width: "wide",
              align: "start",
              spacing: "normal",
              background: {
                kind: "media",
                media: { mediaId: "m1", alt: null },
                overlay: 0,
              },
              iconBefore: { source: "library", id: "cookie" },
              iconAfter: { source: "library", id: "cookie" },
              anchor: null,
            } as unknown as Presentation
          }
          onChange={(next) => {
            last = next;
          }}
        />
      </Harness>
    );
    expect(
      screen.getByTestId("presentation-icon-before-display")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("presentation-icon-after-display")
    ).toBeInTheDocument();
    const bgDisplay = screen.getByTestId("presentation-media-display");
    await openAdvanced(user, bgDisplay);
    await user.click(within(bgDisplay).getByRole("switch", { name: "Shadow" }));
    expect(
      (last as unknown as { background: { media: unknown } }).background.media
    ).toEqual({ mediaId: "m1", alt: null, display: { shadow: true } });
  });
});
