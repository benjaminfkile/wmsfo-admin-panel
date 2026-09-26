import { describe, it, expect } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import SchemaForm from "./SchemaForm";
import { buildTheme } from "../../theme/theme";
import kindsJson from "../../../contracts/kinds.json";
import hero from "../../../contracts/schema/sections/hero.schema.json";
import richText from "../../../contracts/schema/sections/rich_text.schema.json";
import mediaSection from "../../../contracts/schema/sections/media.schema.json";
import mediaItem from "../../../contracts/schema/sections/media.item.schema.json";
import links from "../../../contracts/schema/sections/links.schema.json";
import linksItem from "../../../contracts/schema/sections/links.item.schema.json";
import iconRow from "../../../contracts/schema/sections/icon_row.schema.json";
import iconRowItem from "../../../contracts/schema/sections/icon_row.item.schema.json";
import divider from "../../../contracts/schema/sections/divider.schema.json";
import fundsRing from "../../../contracts/schema/sections/funds_ring.schema.json";
import countdown from "../../../contracts/schema/sections/countdown.schema.json";
import eventTimes from "../../../contracts/schema/sections/event_times.schema.json";
import latestMessage from "../../../contracts/schema/sections/latest_message.schema.json";
import map from "../../../contracts/schema/sections/map.schema.json";
import leaderboard from "../../../contracts/schema/sections/leaderboard.schema.json";
import sponsorCarousel from "../../../contracts/schema/sections/sponsor_carousel.schema.json";
import sponsorGrid from "../../../contracts/schema/sections/sponsor_grid.schema.json";
import routePreview from "../../../contracts/schema/sections/route_preview.schema.json";
import cookieControl from "../../../contracts/schema/sections/cookie_control.schema.json";
import alertsSignup from "../../../contracts/schema/sections/alerts_signup.schema.json";
import contactForm from "../../../contracts/schema/sections/contact_form.schema.json";

type Sch = Record<string, unknown>;

const SCHEMAS: Record<string, Sch> = {
  hero: hero as Sch,
  rich_text: richText as Sch,
  media: mediaSection as Sch,
  links: links as Sch,
  icon_row: iconRow as Sch,
  divider: divider as Sch,
  funds_ring: fundsRing as Sch,
  countdown: countdown as Sch,
  event_times: eventTimes as Sch,
  latest_message: latestMessage as Sch,
  map: map as Sch,
  leaderboard: leaderboard as Sch,
  sponsor_carousel: sponsorCarousel as Sch,
  sponsor_grid: sponsorGrid as Sch,
  route_preview: routePreview as Sch,
  cookie_control: cookieControl as Sch,
  alerts_signup: alertsSignup as Sch,
  contact_form: contactForm as Sch,
};

const ITEM_SCHEMAS: Record<string, Sch> = {
  media: mediaItem as Sch,
  links: linksItem as Sch,
  icon_row: iconRowItem as Sch,
};

function Providers({ children }: { children: ReactNode }) {
  const theme = buildTheme("light");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return (
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe("SchemaForm: every vendored kind schema renders from its defaults", () => {
  const kinds = (
    kindsJson as {
      kinds: Array<{
        kind: string;
        defaults: unknown;
        itemDefaults: unknown;
        hasItems: boolean;
      }>;
    }
  ).kinds;

  it.each(kinds.map((k) => [k.kind]))("renders %s from its defaults", (name) => {
    const kind = kinds.find((k) => k.kind === name);
    expect(kind).toBeDefined();
    const schema = SCHEMAS[name as string];
    expect(schema).toBeDefined();
    const { container, unmount } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          kind={name as string}
          formData={kind!.defaults}
          onChange={() => undefined}
        />
      </Providers>
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Option 1|Option 2/);
    expect(text).not.toMatch(/section data/);
    expect(text).not.toMatch(/section item data/);
    unmount();
  });

  it.each(
    kinds
      .filter((k) => k.hasItems && k.itemDefaults !== null)
      .map((k) => [k.kind])
  )("renders %s items from itemDefaults", (name) => {
    const kind = kinds.find((k) => k.kind === name);
    expect(kind).toBeDefined();
    const schema = ITEM_SCHEMAS[name as string];
    expect(schema).toBeDefined();
    const { container, unmount } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          kind={name as string}
          isItem
          formData={kind!.itemDefaults}
          onChange={() => undefined}
        />
      </Providers>
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Option 1|Option 2/);
    expect(text).not.toMatch(/section data/);
    expect(text).not.toMatch(/section item data/);
    unmount();
  });
});

describe("SchemaForm: human labels from labels.ts", () => {
  it("shows Title and Tagline on a hero form and no section data heading", () => {
    const kind = (
      kindsJson as { kinds: Array<{ kind: string; defaults: unknown }> }
    ).kinds.find((k) => k.kind === "hero");
    expect(kind).toBeDefined();
    const { container } = render(
      <Providers>
        <SchemaForm
          schema={hero as Sch}
          kind="hero"
          formData={kind!.defaults}
          onChange={() => undefined}
        />
      </Providers>
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Title");
    expect(text).toContain("Tagline");
    expect(text).not.toMatch(/section data/);
    expect(text).not.toMatch(/hero section/);
  });

  it("shows Small, Medium, Large in the icon_row size select", () => {
    const kind = (
      kindsJson as { kinds: Array<{ kind: string; defaults: unknown }> }
    ).kinds.find((k) => k.kind === "icon_row");
    expect(kind).toBeDefined();
    render(
      <Providers>
        <SchemaForm
          schema={iconRow as Sch}
          kind="icon_row"
          formData={kind!.defaults}
          onChange={() => undefined}
        />
      </Providers>
    );
    const sizeCombo = screen.getByRole("combobox", { name: /icon size/i });
    fireEvent.mouseDown(sizeCombo);
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Small")).toBeInTheDocument();
    expect(within(listbox).getByText("Medium")).toBeInTheDocument();
    expect(within(listbox).getByText("Large")).toBeInTheDocument();
  });

  it("shows the help text for a map control", () => {
    const kind = (
      kindsJson as { kinds: Array<{ kind: string; defaults: unknown }> }
    ).kinds.find((k) => k.kind === "map");
    expect(kind).toBeDefined();
    const { container } = render(
      <Providers>
        <SchemaForm
          schema={map as Sch}
          kind="map"
          formData={kind!.defaults}
          onChange={() => undefined}
        />
      </Providers>
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Show the theme picker");
    expect(text).toContain("Lets visitors switch between the themes above.");
  });
});

describe("SchemaForm: optional primitive is a switch, not an Option dropdown", () => {
  type ItemValue = {
    media: { mediaId: string; alt: string | null };
    caption: string | null;
    link: {
      label: string;
      href: string;
      icon: unknown;
      newTab: boolean;
    } | null;
  };

  function Controlled({ initial }: { initial: ItemValue }) {
    const [value, setValue] = useState<ItemValue>(initial);
    return (
      <>
        <SchemaForm
          schema={mediaItem as Sch}
          formData={value}
          onChange={(next) => setValue(next as ItemValue)}
        />
        <pre data-testid="value">{JSON.stringify(value.link)}</pre>
      </>
    );
  }

  const emptyItem: ItemValue = {
    media: {
      mediaId: "00000000-0000-0000-0000-000000000000",
      alt: null,
    },
    caption: null,
    link: null,
  };

  it("shows a Link switch with no Option text and toggles the link fields on and off", () => {
    render(
      <Providers>
        <Controlled initial={emptyItem} />
      </Providers>
    );
    const optional = screen.getByTestId("optional-field");
    expect(optional.textContent ?? "").not.toMatch(/Option 1|Option 2/);
    const switchInput = within(optional).getByRole("switch", { name: "Link" });
    expect(switchInput).not.toBeChecked();
    expect(screen.queryByTestId("link-field")).toBeNull();

    fireEvent.click(switchInput);
    expect(switchInput).toBeChecked();
    const linkField = screen.getByTestId("link-field");
    expect(linkField).toBeInTheDocument();
    const inputs = within(linkField).getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(screen.getByTestId("value").textContent ?? "null")).toEqual({
      label: "",
      href: "",
      icon: null,
      newTab: false,
    });

    fireEvent.click(switchInput);
    expect(switchInput).not.toBeChecked();
    expect(screen.queryByTestId("link-field")).toBeNull();
    expect(screen.getByTestId("value").textContent).toBe("null");
  });

  it("renders a stored link with the switch on and the link fields visible", () => {
    render(
      <Providers>
        <Controlled
          initial={{
            ...emptyItem,
            link: {
              label: "Home",
              href: "https://x.example/",
              icon: null,
              newTab: false,
            },
          }}
        />
      </Providers>
    );
    const optional = screen.getByTestId("optional-field");
    const switchInput = within(optional).getByRole("switch", { name: "Link" });
    expect(switchInput).toBeChecked();
    expect(screen.getByTestId("link-field")).toBeInTheDocument();
  });
});

describe("SchemaForm: primitive routing", () => {
  it("routes InlineNullable to InlineField", () => {
    const schema = {
      type: "object",
      properties: {
        heading: {
          $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/InlineNullable",
        },
      },
    };
    const { getAllByTestId } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          formData={{ heading: null }}
          onChange={() => undefined}
        />
      </Providers>
    );
    expect(getAllByTestId("inline-field").length).toBeGreaterThan(0);
  });

  it("routes IconNullable to IconField", () => {
    const schema = {
      type: "object",
      properties: {
        icon: {
          $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/IconNullable",
        },
      },
    };
    const { getAllByTestId } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          formData={{ icon: null }}
          onChange={() => undefined}
        />
      </Providers>
    );
    expect(getAllByTestId("icon-field").length).toBeGreaterThan(0);
  });

  it("routes MediaRef to MediaField", () => {
    const schema = {
      type: "object",
      properties: {
        media: {
          $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/MediaRef",
        },
      },
    };
    const { getAllByTestId } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          formData={{ media: { mediaId: "", alt: null } }}
          onChange={() => undefined}
        />
      </Providers>
    );
    expect(getAllByTestId("media-field").length).toBeGreaterThan(0);
  });

  it("routes Link to LinkField", () => {
    const schema = {
      type: "object",
      properties: {
        link: {
          $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/Link",
        },
      },
    };
    const { getAllByTestId } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          formData={{
            link: { label: "l", href: "https://x.example/", icon: null, newTab: false },
          }}
          onChange={() => undefined}
        />
      </Providers>
    );
    expect(getAllByTestId("link-field").length).toBeGreaterThan(0);
  });

  it("routes an array of Block to BlocksField", () => {
    const schema = {
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
    const { getAllByTestId } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          formData={{ blocks: [] }}
          onChange={() => undefined}
        />
      </Providers>
    );
    expect(getAllByTestId("blocks-field").length).toBeGreaterThan(0);
  });

  it("routes Presentation to PresentationPanel", () => {
    const schema = {
      type: "object",
      properties: {
        presentation: {
          $ref: "https://wmsfo.dev/schema/primitives.schema.json#/$defs/Presentation",
        },
      },
    };
    const { getAllByTestId } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          formData={{
            presentation: {
              width: "wide",
              align: "start",
              background: { kind: "none" },
              spacing: "normal",
              iconBefore: null,
              iconAfter: null,
              anchor: null,
            },
          }}
          onChange={() => undefined}
        />
      </Providers>
    );
    expect(getAllByTestId("presentation-panel").length).toBeGreaterThan(0);
  });

  it("renders an unknown scalar as the default widget", () => {
    const schema = {
      type: "object",
      properties: {
        columns: { type: "integer" },
      },
    };
    const { container } = render(
      <Providers>
        <SchemaForm
          schema={schema as Sch}
          formData={{ columns: 3 }}
          onChange={() => undefined}
        />
      </Providers>
    );
    const input = container.querySelector('input[type="number"]');
    expect(input).not.toBeNull();
  });
});
