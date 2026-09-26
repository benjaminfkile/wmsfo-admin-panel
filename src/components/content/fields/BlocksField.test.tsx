import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useState } from "react";
import SchemaForm from "../SchemaForm";
import { ConfigProvider } from "../../../ConfigContext";
import { installClient } from "../../../api/client";
import { buildTheme } from "../../../theme/theme";
import {
  makeFakeUserManager,
  makeUser,
  testConfig,
} from "../../../test/renderWithProviders";
import starter from "../../../../contracts/starter-content.json";

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

describe("BlocksField over starter content", () => {
  it("no heading, paragraph, quote, list, or divider block renders an empty body", () => {
    type StarterDoc = {
      pages: Array<{
        sections: Array<{
          kind: string;
          data?: { blocks?: Block[] };
        }>;
      }>;
    };
    const doc = starter as unknown as StarterDoc;
    const editedKinds = new Set([
      "heading",
      "paragraph",
      "quote",
      "list",
      "divider",
    ]);

    let seen = 0;
    for (const page of doc.pages) {
      for (const section of page.sections) {
        if (section.kind !== "rich_text") continue;
        const blocks = section.data?.blocks ?? [];
        const relevant = blocks.filter((b) => editedKinds.has(b.kind));
        if (relevant.length === 0) continue;
        const { unmount } = render(
          <Harness>
            <Controlled initial={relevant} />
          </Harness>
        );
        for (const b of relevant) {
          seen += 1;
          if (b.kind === "heading") {
            expect(screen.getAllByTestId("block-heading").length).toBeGreaterThan(
              0
            );
          } else if (b.kind === "paragraph") {
            expect(
              screen.getAllByTestId("block-paragraph").length
            ).toBeGreaterThan(0);
          } else if (b.kind === "quote") {
            expect(screen.getAllByTestId("block-quote").length).toBeGreaterThan(
              0
            );
          } else if (b.kind === "list") {
            expect(screen.getAllByTestId("block-list").length).toBeGreaterThan(
              0
            );
          } else if (b.kind === "divider") {
            expect(
              screen.getAllByTestId("block-divider").length
            ).toBeGreaterThan(0);
          }
        }
        unmount();
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
