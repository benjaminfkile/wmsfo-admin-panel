import { describe, it, expect } from "vitest";
import kindsJson from "../../../contracts/kinds.json";
import alertsSignup from "../../../contracts/schema/sections/alerts_signup.schema.json";
import contactForm from "../../../contracts/schema/sections/contact_form.schema.json";
import cookieControl from "../../../contracts/schema/sections/cookie_control.schema.json";
import countdown from "../../../contracts/schema/sections/countdown.schema.json";
import divider from "../../../contracts/schema/sections/divider.schema.json";
import eventTimes from "../../../contracts/schema/sections/event_times.schema.json";
import fundsRing from "../../../contracts/schema/sections/funds_ring.schema.json";
import hero from "../../../contracts/schema/sections/hero.schema.json";
import iconRow from "../../../contracts/schema/sections/icon_row.schema.json";
import iconRowItem from "../../../contracts/schema/sections/icon_row.item.schema.json";
import latestMessage from "../../../contracts/schema/sections/latest_message.schema.json";
import leaderboard from "../../../contracts/schema/sections/leaderboard.schema.json";
import links from "../../../contracts/schema/sections/links.schema.json";
import linksItem from "../../../contracts/schema/sections/links.item.schema.json";
import map from "../../../contracts/schema/sections/map.schema.json";
import mediaItem from "../../../contracts/schema/sections/media.item.schema.json";
import mediaSection from "../../../contracts/schema/sections/media.schema.json";
import richText from "../../../contracts/schema/sections/rich_text.schema.json";
import routePreview from "../../../contracts/schema/sections/route_preview.schema.json";
import sponsorCarousel from "../../../contracts/schema/sections/sponsor_carousel.schema.json";
import sponsorGrid from "../../../contracts/schema/sections/sponsor_grid.schema.json";
import siteSettings from "../../../contracts/schema/site-settings.schema.json";
import primitives from "../../../contracts/schema/primitives.schema.json";
import { CARD_OPACITY_LABELS, labelsFor, siteSettingsLabels } from "./labels";

type Sch = Record<string, unknown>;

const SECTION_SCHEMAS: Record<string, Sch> = {
  alerts_signup: alertsSignup as Sch,
  contact_form: contactForm as Sch,
  cookie_control: cookieControl as Sch,
  countdown: countdown as Sch,
  divider: divider as Sch,
  event_times: eventTimes as Sch,
  funds_ring: fundsRing as Sch,
  hero: hero as Sch,
  icon_row: iconRow as Sch,
  latest_message: latestMessage as Sch,
  leaderboard: leaderboard as Sch,
  links: links as Sch,
  map: map as Sch,
  media: mediaSection as Sch,
  rich_text: richText as Sch,
  route_preview: routePreview as Sch,
  sponsor_carousel: sponsorCarousel as Sch,
  sponsor_grid: sponsorGrid as Sch,
};

const ITEM_SCHEMAS: Record<string, Sch> = {
  media: mediaItem as Sch,
  links: linksItem as Sch,
  icon_row: iconRowItem as Sch,
};

// Every field path a form renders for the given schema. Recurses into
// nested objects (map.controls, event_times.labels), stops at a `$ref`
// (primitives are handled by their custom fields) and at arrays.
function collectFieldPaths(schema: Sch, prefix = ""): string[] {
  const results: string[] = [];
  const props = (schema as { properties?: unknown }).properties;
  if (props === null || typeof props !== "object") return results;
  for (const [key, raw] of Object.entries(props as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    results.push(path);
    if (raw === null || typeof raw !== "object") continue;
    const sub = raw as Sch;
    const hasRef = typeof sub.$ref === "string";
    const hasOneOf = Array.isArray(sub.oneOf);
    const hasAnyOf = Array.isArray(sub.anyOf);
    const isArray = sub.type === "array";
    if (hasRef || hasOneOf || hasAnyOf || isArray) continue;
    if (sub.type === "object" && sub.properties) {
      results.push(...collectFieldPaths(sub, path));
    }
  }
  return results;
}

// The fields of an array's entries when the entries are a primitives
// object (the site settings link lists hold `Link` entries).
function arrayEntryPaths(schema: Sch): string[] {
  const results: string[] = [];
  const props = (schema as { properties?: Record<string, Sch> }).properties ?? {};
  const defs = (primitives as { $defs: Record<string, Sch> }).$defs;
  for (const [key, sub] of Object.entries(props)) {
    if (sub.type !== "array") continue;
    const ref = (sub.items as { $ref?: string } | undefined)?.$ref ?? "";
    const def = defs[ref.slice(ref.lastIndexOf("/") + 1)];
    if (!def) continue;
    results.push(...collectFieldPaths(def, key));
  }
  return results;
}

describe("labels.ts: every field of the site settings schema has an entry", () => {
  it("has a label for every field, the link list entries included", () => {
    const paths = [
      ...collectFieldPaths(siteSettings as Sch),
      ...arrayEntryPaths(siteSettings as Sch),
    ];
    expect(paths).toContain("navExtraLinks.href");
    expect(paths).toContain("theme.ornaments");
    expect(paths).toContain("theme.cardOpacityLight");
    expect(paths).toContain("theme.cardOpacityDark");
    const table = siteSettingsLabels();
    const missing = paths.filter((p) => !(p in table));
    expect(missing, `missing site settings labels: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("labels.ts: the card opacity pair of Presentation has entries", () => {
  it("has a label for every card opacity field of Presentation", () => {
    const defs = (primitives as { $defs: Record<string, Sch> }).$defs;
    const paths = collectFieldPaths(defs.Presentation as Sch).filter((p) =>
      p.startsWith("cardOpacity")
    );
    expect(paths).toEqual(["cardOpacityLight", "cardOpacityDark"]);
    const missing = paths.filter((p) => !(p in CARD_OPACITY_LABELS));
    expect(missing, `missing card opacity labels: ${missing.join(", ")}`).toEqual([]);
    expect(CARD_OPACITY_LABELS.cardOpacity?.label).toBe("Card opacity");
  });
});

describe("labels.ts: every field of every section and item schema has an entry", () => {
  const kinds = (
    kindsJson as { kinds: Array<{ kind: string; hasItems: boolean }> }
  ).kinds;

  it.each(kinds.map((k) => [k.kind]))("has a label for every field of %s", (name) => {
    const schema = SECTION_SCHEMAS[name as string];
    expect(schema, `no vendored schema for ${name}`).toBeDefined();
    const paths = collectFieldPaths(schema as Sch);
    const table = labelsFor(name as string, false);
    const missing = paths.filter((p) => !(p in table));
    expect(missing, `missing labels for ${name}: ${missing.join(", ")}`).toEqual([]);
  });

  it.each(
    kinds.filter((k) => k.hasItems && k.kind in ITEM_SCHEMAS).map((k) => [k.kind])
  )("has a label for every field of %s items", (name) => {
    const schema = ITEM_SCHEMAS[name as string];
    expect(schema, `no vendored item schema for ${name}`).toBeDefined();
    const paths = collectFieldPaths(schema as Sch);
    const table = labelsFor(name as string, true);
    const missing = paths.filter((p) => !(p in table));
    expect(missing, `missing item labels for ${name}: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("labels.ts: the map overlays include the online count", () => {
  it("labels overlays.onlineCount as a switch that defaults to on", () => {
    const paths = collectFieldPaths(map as Sch);
    expect(paths).toContain("overlays.onlineCount");
    const entry = labelsFor("map", false)["overlays.onlineCount"];
    expect(entry?.label).toBe("Online count");
    expect(entry?.help).toBe(
      "How many people are watching, while the event is live and sockets are healthy"
    );
    expect(entry?.switchDefault).toBe(true);
  });
});
