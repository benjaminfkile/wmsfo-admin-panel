import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useState } from "react";
import SchemaForm from "../SchemaForm";
import { ConfigProvider } from "../../../ConfigContext";
import { installClient } from "../../../api/client";
import { buildTheme } from "../../../theme/theme";
import { server } from "../../../test/msw/server";
import * as f from "../../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../../test/renderWithProviders";
import type { MediaAsset } from "../../../api/types";
import starter from "../../../../contracts/starter-content.json";
import primitives from "../../../../contracts/schema/primitives.schema.json";

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
} as const;

type Block = { kind: string; [k: string]: unknown };

function Controlled({ initial }: { initial: Block[] }) {
  const [data, setData] = useState<{ blocks: Block[] }>({ blocks: initial });
  return (
    <>
      <SchemaForm
        schema={blockSchema as unknown as Record<string, unknown>}
        formData={data}
        onChange={(next) =>
          setData(next as unknown as { blocks: Block[] })
        }
      />
      <textarea
        data-testid="value-json"
        readOnly
        value={JSON.stringify(data.blocks)}
      />
    </>
  );
}

function readValue(): Block[] {
  const el = screen.getByTestId("value-json") as HTMLTextAreaElement;
  return JSON.parse(el.value) as Block[];
}

describe("BlocksField block editors", () => {
  it("renders and edits every field of a heading block", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[{ kind: "heading", level: 2, text: "Hi", icon: null }]}
        />
      </Harness>
    );
    expect(screen.getByTestId("block-heading")).toBeInTheDocument();
    const textInput = within(screen.getByTestId("block-heading")).getByLabelText(
      "Text"
    );
    await user.clear(textInput);
    await user.type(textInput, "Hello");
    expect(readValue()[0]).toMatchObject({ text: "Hello" });

    const levelSelect = within(screen.getByTestId("block-heading-level")).getByRole(
      "combobox"
    );
    await user.click(levelSelect);
    const option = await screen.findByRole("option", { name: "1" });
    await user.click(option);
    expect(readValue()[0]).toMatchObject({ level: 1 });
    expect(screen.getByTestId("block-heading-icon")).toBeInTheDocument();
  });

  it("renders and edits the paragraph block text", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled initial={[{ kind: "paragraph", text: "old" }]} />
      </Harness>
    );
    const input = within(screen.getByTestId("block-paragraph")).getByLabelText(
      "Text"
    );
    await user.clear(input);
    await user.type(input, "new");
    expect(readValue()[0]).toMatchObject({ text: "new" });
  });

  it("renders and edits the quote block; empty attribution stores null", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[{ kind: "quote", text: "t", attribution: "a" }]}
        />
      </Harness>
    );
    const attr = within(
      screen.getByTestId("block-quote-attribution")
    ).getByRole("textbox");
    await user.clear(attr);
    expect(readValue()[0]!.attribution).toBeNull();
    await user.type(attr, "someone");
    expect(readValue()[0]).toMatchObject({ attribution: "someone" });
  });

  it("renders the list block, adds, removes, reorders lines", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[
            {
              kind: "list",
              style: "bullet",
              icon: null,
              items: ["one", "two"],
            },
          ]}
        />
      </Harness>
    );
    await user.click(screen.getByRole("button", { name: "Add line" }));
    expect(readValue()[0]!.items).toEqual(["one", "two", ""]);
    // Move line 1 down
    await user.click(screen.getByRole("button", { name: "Move line 1 down" }));
    expect(readValue()[0]!.items).toEqual(["two", "one", ""]);
    // Remove the middle
    await user.click(screen.getByRole("button", { name: "Remove line 2" }));
    expect(readValue()[0]!.items).toEqual(["two", ""]);
  });

  it("disables Remove when there is only one line", () => {
    render(
      <Harness>
        <Controlled
          initial={[
            { kind: "list", style: "bullet", icon: null, items: ["only"] },
          ]}
        />
      </Harness>
    );
    const btn = screen.getByRole("button", { name: "Remove line 1" });
    expect(btn).toBeDisabled();
  });

  it("list: switching to icon style shows the icon control; switching away clears it", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[
            {
              kind: "list",
              style: "icon",
              icon: { source: "library", id: "star" },
              items: ["a"],
            },
          ]}
        />
      </Harness>
    );
    expect(screen.getByTestId("block-list-icon")).toBeInTheDocument();
    const styleSelect = within(screen.getByTestId("block-list-style")).getByRole(
      "combobox"
    );
    await user.click(styleSelect);
    const bulletsOption = await screen.findByRole("option", {
      name: "Bullets",
    });
    await user.click(bulletsOption);
    expect(readValue()[0]!.icon).toBeNull();
    expect(screen.queryByTestId("block-list-icon")).toBeNull();
  });

  it("renders and edits the divider block style", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled initial={[{ kind: "divider", style: "line" }]} />
      </Harness>
    );
    const styleSelect = within(
      screen.getByTestId("block-divider-style")
    ).getByRole("combobox");
    await user.click(styleSelect);
    const option = await screen.findByRole("option", { name: "Snowflakes" });
    await user.click(option);
    expect(readValue()[0]).toMatchObject({ style: "snowflakes" });
  });

  it("shows a human label and a summary in the block header", () => {
    render(
      <Harness>
        <Controlled
          initial={[
            {
              kind: "paragraph",
              text:
                "The quick brown fox jumps over the lazy dog again and now once more.",
            },
            {
              kind: "list",
              style: "icon",
              icon: { source: "library", id: "star" },
              items: ["one", "two", "three"],
            },
          ]}
        />
      </Harness>
    );
    const row0 = screen.getByTestId("block-row-0");
    expect(within(row0).getByText("Paragraph")).toBeInTheDocument();
    expect(
      within(row0).getByText(
        "The quick brown fox jumps over the lazy dog again and now on"
      )
    ).toBeInTheDocument();
    const row1 = screen.getByTestId("block-row-1");
    expect(within(row1).getByText("List")).toBeInTheDocument();
    expect(within(row1).getByText("3 lines, icon style")).toBeInTheDocument();
  });

  it("reorders blocks by the up and down arrows", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[
            { kind: "paragraph", text: "one" },
            { kind: "paragraph", text: "two" },
          ]}
        />
      </Harness>
    );
    const row0 = screen.getByTestId("block-row-0");
    await user.click(
      within(row0).getByRole("button", { name: "Move Paragraph block down" })
    );
    const after = readValue();
    expect(after[0]).toMatchObject({ text: "two" });
    expect(after[1]).toMatchObject({ text: "one" });
  });

  it("duplicate deep-copies the block", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[
            {
              kind: "list",
              style: "bullet",
              icon: null,
              items: ["a", "b"],
            },
          ]}
        />
      </Harness>
    );
    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    const after = readValue();
    expect(after.length).toBe(2);
    expect(after[1]).toEqual(after[0]);
    // Independence: mutating the second's line does not touch the first
    const remove = screen.getAllByRole("button", { name: "Remove line 2" })[1];
    await user.click(remove!);
    const later = readValue();
    expect((later[0] as unknown as { items: string[] }).items).toEqual([
      "a",
      "b",
    ]);
    expect((later[1] as unknown as { items: string[] }).items).toEqual(["a"]);
  });

  it("preserves an unknown extra field on a block after an edit", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[
            {
              kind: "heading",
              level: 2,
              text: "Hi",
              icon: null,
              unknownField: "kept",
            } as Block,
          ]}
        />
      </Harness>
    );
    const input = within(screen.getByTestId("block-heading")).getByLabelText(
      "Text"
    );
    await user.clear(input);
    await user.type(input, "changed");
    expect(readValue()[0]).toMatchObject({
      text: "changed",
      unknownField: "kept",
    });
  });
});

describe("BlocksField media block", () => {
  it("shows the picked image, alt override, caption, and size select", async () => {
    const user = userEvent.setup();
    const asset: MediaAsset = {
      ...f.mediaAssets[0]!,
      id: "media-block",
      filename: "picnic.jpg",
      variants: { "480": "https://cdn.test/picnic-480.webp" },
    };
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/media/media-block`, () =>
        HttpResponse.json(asset)
      )
    );
    render(
      <Harness>
        <Controlled
          initial={[
            {
              kind: "media",
              media: { mediaId: "media-block", alt: null },
              caption: null,
              size: "medium",
            },
          ]}
        />
      </Harness>
    );
    const body = screen.getByTestId("block-media");
    expect(await within(body).findByText("picnic.jpg")).toBeInTheDocument();

    const alt = within(body).getByLabelText(
      "Alt text (leave empty to use the image's own)"
    );
    await user.type(alt, "override");
    expect(
      (readValue()[0] as unknown as { media: { alt: string | null } }).media
        .alt
    ).toBe("override");

    const caption = within(screen.getByTestId("block-media-caption")).getByRole(
      "textbox"
    );
    await user.type(caption, "cap");
    expect(readValue()[0]).toMatchObject({ caption: "cap" });
    await user.clear(caption);
    expect(readValue()[0]!.caption).toBeNull();

    const sizeSelect = within(screen.getByTestId("block-media-size")).getByRole(
      "combobox"
    );
    await user.click(sizeSelect);
    const opt = await screen.findByRole("option", { name: "Full width" });
    await user.click(opt);
    expect(readValue()[0]).toMatchObject({ size: "full" });
  });
});

describe("BlocksField links block", () => {
  it("renders, adds, removes, and reorders links; enforces 1 to 20 bounds", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[
            {
              kind: "links",
              style: "buttons",
              links: [
                { label: "First", href: "/a", icon: null, newTab: false },
              ],
            },
          ]}
        />
      </Harness>
    );
    const body = screen.getByTestId("block-links");
    expect(within(body).getByTestId("block-links-item-0")).toBeInTheDocument();

    const styleSelect = within(
      screen.getByTestId("block-links-style")
    ).getByRole("combobox");
    await user.click(styleSelect);
    await user.click(await screen.findByRole("option", { name: "List" }));
    expect(readValue()[0]).toMatchObject({ style: "list" });

    // Remove is disabled on the last link.
    const removeOnly = within(
      screen.getByTestId("block-links-item-0")
    ).getByRole("button", { name: "Remove link 1" });
    expect(removeOnly).toBeDisabled();

    // Add a second link.
    await user.click(screen.getByRole("button", { name: "Add link" }));
    expect(
      (readValue()[0] as unknown as { links: unknown[] }).links.length
    ).toBe(2);

    // Edit the second link's label.
    const label2 = within(
      screen.getByTestId("block-links-control-1")
    ).getByLabelText("Label");
    await user.type(label2, "Second");
    expect(
      (readValue()[0] as unknown as { links: Array<{ label: string }> })
        .links[1]!.label
    ).toBe("Second");

    // Move link 1 down.
    await user.click(
      within(screen.getByTestId("block-links-item-0")).getByRole("button", {
        name: "Move link 1 down",
      })
    );
    const links = (
      readValue()[0] as unknown as { links: Array<{ label: string }> }
    ).links;
    expect(links[0]!.label).toBe("Second");
    expect(links[1]!.label).toBe("First");

    // Remove the second link.
    await user.click(
      within(screen.getByTestId("block-links-item-1")).getByRole("button", {
        name: "Remove link 2",
      })
    );
    expect(
      (readValue()[0] as unknown as { links: unknown[] }).links.length
    ).toBe(1);
  });

  it("disables Add link when there are 20 links", () => {
    const links = Array.from({ length: 20 }, (_, i) => ({
      label: `L${i}`,
      href: "/",
      icon: null,
      newTab: false,
    }));
    render(
      <Harness>
        <Controlled initial={[{ kind: "links", style: "buttons", links }]} />
      </Harness>
    );
    const btn = screen.getByRole("button", { name: "Add link" });
    expect(btn).toBeDisabled();
  });
});

describe("BlocksField icon block", () => {
  it("shows the icon, a size select, and an align select; no Clear", async () => {
    const user = userEvent.setup();
    render(
      <Harness>
        <Controlled
          initial={[
            {
              kind: "icon",
              icon: { source: "library", id: "star" },
              size: "md",
              align: "start",
            },
          ]}
        />
      </Harness>
    );
    const body = screen.getByTestId("block-icon");
    expect(within(body).getByTestId("block-icon-icon")).toBeInTheDocument();
    // No Clear button on a required icon control.
    expect(
      within(screen.getByTestId("block-icon-icon")).queryByRole("button", {
        name: "Clear",
      })
    ).toBeNull();

    const sizeSelect = within(screen.getByTestId("block-icon-size")).getByRole(
      "combobox"
    );
    await user.click(sizeSelect);
    await user.click(
      await screen.findByRole("option", { name: "Extra large" })
    );
    expect(readValue()[0]).toMatchObject({ size: "xl" });

    const alignSelect = within(
      screen.getByTestId("block-icon-align")
    ).getByRole("combobox");
    await user.click(alignSelect);
    await user.click(await screen.findByRole("option", { name: "Centre" }));
    expect(readValue()[0]).toMatchObject({ align: "center" });
  });
});

// The gate: build a fixture from contracts.md 1.3a shapes (one block per
// kind, every field populated) plus every rich text block in
// starter-content.json, render it in a single BlocksField, and for each
// block assert that every field of the block's shape has a visible,
// labelled control. Fails if a future kind or field has no control.
describe("BlocksField gate over every block kind", () => {
  type StarterDoc = {
    pages: Array<{
      sections: Array<{
        kind: string;
        data?: { blocks?: Block[] };
      }>;
    }>;
  };

  const CONTRACT_BLOCKS: Block[] = [
    { kind: "heading", level: 2, text: "Head", icon: null },
    { kind: "paragraph", text: "Para" },
    {
      kind: "list",
      style: "icon",
      icon: { source: "library", id: "star" },
      items: ["one"],
    },
    { kind: "quote", text: "Say", attribution: "Anon" },
    {
      kind: "media",
      media: { mediaId: "gate-media", alt: null },
      caption: null,
      size: "medium",
    },
    {
      kind: "links",
      style: "buttons",
      links: [{ label: "L", href: "/", icon: null, newTab: false }],
    },
    {
      kind: "icon",
      icon: { source: "library", id: "star" },
      size: "md",
      align: "start",
    },
    { kind: "divider", style: "line" },
  ];

  // Per kind: for each field of the block's shape, the visible label
  // text of a control that reads and writes it. When a control appears
  // on the top-level block-<kind> body it lives under `body`; controls
  // that live inside a nested sub-testId are listed under `nested`.
  const FIELDS_BY_KIND: Record<
    string,
    { body: string[]; nested?: { testId: string; labels: string[] }[] }
  > = {
    heading: {
      body: ["Text", "Heading level"],
      nested: [{ testId: "block-heading-icon", labels: ["Icon"] }],
    },
    paragraph: { body: ["Text"] },
    list: {
      body: ["Style", "Lines"],
      nested: [{ testId: "block-list-icon", labels: ["Icon (required)"] }],
    },
    quote: { body: ["Text", "Attribution (optional)"] },
    media: {
      body: [
        "Image",
        "Alt text (leave empty to use the image's own)",
        "Caption (optional)",
        "Size",
      ],
    },
    links: { body: ["Style", "Links"] },
    icon: {
      body: ["Size", "Align"],
      nested: [{ testId: "block-icon-icon", labels: ["Icon (required)"] }],
    },
    divider: { body: ["Style"] },
  };

  // Every field of every Block shape in the vendored schema, and the
  // label in FIELDS_BY_KIND that proves its control. A new block kind or
  // field in contracts/schema/primitives.schema.json fails this test
  // until it has an editor and an entry here.
  const CONTROL_BY_FIELD: Record<string, Record<string, string>> = {
    heading: { level: "Heading level", text: "Text", icon: "Icon" },
    paragraph: { text: "Text" },
    list: { style: "Style", icon: "Icon (required)", items: "Lines" },
    quote: { text: "Text", attribution: "Attribution (optional)" },
    media: { media: "Image", caption: "Caption (optional)", size: "Size" },
    links: { links: "Links", style: "Style" },
    icon: { icon: "Icon (required)", size: "Size", align: "Align" },
    divider: { style: "Style" },
  };

  it("covers every block kind and field of the vendored Block schema", () => {
    type Shape = { properties: Record<string, { const?: string }> };
    const defs = (primitives as unknown as { $defs: Record<string, unknown> })
      .$defs;
    const block = defs.Block as { oneOf: Array<Shape | { $ref: string }> };
    const shapes = block.oneOf.map((o) =>
      "$ref" in o ? (defs[o.$ref.split("/").pop()!] as Shape) : o
    );
    const schemaKinds = shapes.map((s) => s.properties.kind!.const!).sort();
    expect(schemaKinds).toEqual(Object.keys(CONTROL_BY_FIELD).sort());
    for (const s of shapes) {
      const kind = s.properties.kind!.const!;
      const fields = Object.keys(s.properties).filter((k) => k !== "kind");
      expect(fields.sort()).toEqual(Object.keys(CONTROL_BY_FIELD[kind]!).sort());
      const spec = FIELDS_BY_KIND[kind]!;
      const labels = [
        ...spec.body,
        ...(spec.nested ?? []).flatMap((n) => n.labels),
      ];
      for (const label of Object.values(CONTROL_BY_FIELD[kind]!)) {
        expect(labels).toContain(label);
      }
    }
  });

  it("renders every kind with a labelled control for every field", () => {
    const doc = starter as unknown as StarterDoc;
    const starterBlocks: Block[] = [];
    for (const page of doc.pages) {
      for (const section of page.sections) {
        if (section.kind !== "rich_text") continue;
        for (const b of section.data?.blocks ?? []) starterBlocks.push(b);
      }
    }
    // The starter content must contribute at least one rich text block.
    expect(starterBlocks.length).toBeGreaterThan(0);

    const fixture: Block[] = [...CONTRACT_BLOCKS, ...starterBlocks];
    render(
      <Harness>
        <Controlled initial={fixture} />
      </Harness>
    );

    // Every kind's editor must appear at least once.
    for (const kind of Object.keys(FIELDS_BY_KIND)) {
      const bodies = screen.getAllByTestId(`block-${kind}`);
      expect(bodies.length).toBeGreaterThan(0);
      // Test the first occurrence for label coverage.
      const body = bodies[0]!;
      const spec = FIELDS_BY_KIND[kind]!;
      for (const label of spec.body) {
        expect(within(body).getAllByText(label).length).toBeGreaterThan(0);
      }
      for (const nest of spec.nested ?? []) {
        const scopes = within(body).getAllByTestId(nest.testId);
        expect(scopes.length).toBeGreaterThan(0);
        for (const label of nest.labels) {
          expect(within(scopes[0]!).getByText(label)).toBeInTheDocument();
        }
      }
    }
  });
});
