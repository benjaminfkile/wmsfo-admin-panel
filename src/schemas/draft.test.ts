import { describe, it, expect } from "vitest";
import { deriveDraftSchema } from "./draft";
import primitives from "../../contracts/schema/primitives.schema.json";
import hero from "../../contracts/schema/sections/hero.schema.json";
import richText from "../../contracts/schema/sections/rich_text.schema.json";
import mediaSection from "../../contracts/schema/sections/media.schema.json";
import mediaItem from "../../contracts/schema/sections/media.item.schema.json";
import links from "../../contracts/schema/sections/links.schema.json";
import linksItem from "../../contracts/schema/sections/links.item.schema.json";
import iconRow from "../../contracts/schema/sections/icon_row.schema.json";
import iconRowItem from "../../contracts/schema/sections/icon_row.item.schema.json";
import divider from "../../contracts/schema/sections/divider.schema.json";
import fundsRing from "../../contracts/schema/sections/funds_ring.schema.json";
import countdown from "../../contracts/schema/sections/countdown.schema.json";
import eventTimes from "../../contracts/schema/sections/event_times.schema.json";
import latestMessage from "../../contracts/schema/sections/latest_message.schema.json";
import map from "../../contracts/schema/sections/map.schema.json";
import leaderboard from "../../contracts/schema/sections/leaderboard.schema.json";
import sponsorCarousel from "../../contracts/schema/sections/sponsor_carousel.schema.json";
import sponsorGrid from "../../contracts/schema/sections/sponsor_grid.schema.json";
import routePreview from "../../contracts/schema/sections/route_preview.schema.json";
import cookieControl from "../../contracts/schema/sections/cookie_control.schema.json";
import alertsSignup from "../../contracts/schema/sections/alerts_signup.schema.json";
import contactForm from "../../contracts/schema/sections/contact_form.schema.json";

const ALL: [string, Record<string, unknown>][] = [
  ["primitives", primitives as Record<string, unknown>],
  ["hero", hero as Record<string, unknown>],
  ["rich_text", richText as Record<string, unknown>],
  ["media", mediaSection as Record<string, unknown>],
  ["media.item", mediaItem as Record<string, unknown>],
  ["links", links as Record<string, unknown>],
  ["links.item", linksItem as Record<string, unknown>],
  ["icon_row", iconRow as Record<string, unknown>],
  ["icon_row.item", iconRowItem as Record<string, unknown>],
  ["divider", divider as Record<string, unknown>],
  ["funds_ring", fundsRing as Record<string, unknown>],
  ["countdown", countdown as Record<string, unknown>],
  ["event_times", eventTimes as Record<string, unknown>],
  ["latest_message", latestMessage as Record<string, unknown>],
  ["map", map as Record<string, unknown>],
  ["leaderboard", leaderboard as Record<string, unknown>],
  ["sponsor_carousel", sponsorCarousel as Record<string, unknown>],
  ["sponsor_grid", sponsorGrid as Record<string, unknown>],
  ["route_preview", routePreview as Record<string, unknown>],
  ["cookie_control", cookieControl as Record<string, unknown>],
  ["alerts_signup", alertsSignup as Record<string, unknown>],
  ["contact_form", contactForm as Record<string, unknown>],
];

const DROPPED = new Set(["required", "minLength", "minItems", "minimum"]);

function findDropped(node: unknown, path: string, hits: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((v, i) => findDropped(v, `${path}[${i}]`, hits));
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (DROPPED.has(k)) hits.push(`${path}.${k}`);
    findDropped(v, `${path}.${k}`, hits);
  }
}

function collectKeys(node: unknown, keys: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((v) => collectKeys(v, keys));
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    keys.add(k);
    collectKeys(v, keys);
  }
}

describe("deriveDraftSchema", () => {
  it("removes required, minLength, minItems, and minimum at every level", () => {
    for (const [name, schema] of ALL) {
      const draft = deriveDraftSchema(schema);
      const hits: string[] = [];
      findDropped(draft, name, hits);
      expect(hits).toEqual([]);
    }
  });

  it("preserves every other keyword", () => {
    for (const [, schema] of ALL) {
      const original = new Set<string>();
      collectKeys(schema, original);
      const draft = deriveDraftSchema(schema);
      const derived = new Set<string>();
      collectKeys(draft, derived);
      for (const k of original) {
        if (DROPPED.has(k)) continue;
        expect(derived.has(k)).toBe(true);
      }
    }
  });

  it("does not mutate the input", () => {
    const before = JSON.stringify(primitives);
    deriveDraftSchema(primitives as Record<string, unknown>);
    expect(JSON.stringify(primitives)).toBe(before);
  });

  it("drops required from a nested Presentation-shaped object", () => {
    const schema = {
      type: "object",
      properties: {
        p: {
          type: "object",
          properties: {
            a: { type: "string", minLength: 1 },
          },
          required: ["a"],
        },
      },
      required: ["p"],
    };
    const draft = deriveDraftSchema(schema);
    expect(draft).toEqual({
      type: "object",
      properties: {
        p: {
          type: "object",
          properties: {
            a: { type: "string" },
          },
        },
      },
    });
  });
});
