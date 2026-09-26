// Human labels, help text, and enum display names for every content
// form (admin.md 6.14). One entry per field of every section and item
// schema; a completeness test in `labels.test.ts` fails when a new
// field is added to a schema without an entry here.
//
// Keys are dotted field paths as they appear in a section or item
// value (arrays are addressed by name, without an index). For example
// `map`'s controls object uses paths like `controls.themePicker`.
// `options` maps enum string or number values to their display text.
// `help` is one short sentence and only where the field name does not
// carry its own meaning.

export interface FieldLabel {
  label: string;
  help?: string;
  options?: Record<string, string>;
}

export type FieldLabels = Record<string, FieldLabel>;

const THEME_OPTIONS: Record<string, string> = {
  standard: "Standard",
  expedition: "Expedition",
  blizzard: "Blizzard",
  charcoal: "Charcoal",
  night: "Night",
  nebula: "Nebula",
};

const SECTION: Record<string, FieldLabels> = {
  rich_text: {
    blocks: { label: "Blocks" },
  },
  hero: {
    title: { label: "Title" },
    tagline: { label: "Tagline" },
    icon: { label: "Icon" },
    links: { label: "Call-to-action links" },
    height: {
      label: "Height",
      options: { short: "Short", tall: "Tall" },
    },
  },
  media: {
    layout: {
      label: "Layout",
      options: { single: "Single", grid: "Grid", carousel: "Carousel" },
    },
    columns: {
      label: "Columns",
      options: { "2": "Two", "3": "Three", "4": "Four" },
    },
  },
  links: {
    heading: { label: "Heading" },
    style: {
      label: "Style",
      options: { buttons: "Buttons", cards: "Cards", list: "List" },
    },
  },
  icon_row: {
    size: {
      label: "Icon size",
      options: { sm: "Small", md: "Medium", lg: "Large" },
    },
    spacing: {
      label: "Spacing between icons",
      options: { tight: "Tight", normal: "Normal", loose: "Loose" },
    },
  },
  divider: {
    style: {
      label: "Style",
      options: { line: "Line", snowflakes: "Snowflakes", lights: "Lights" },
    },
  },
  funds_ring: {
    heading: { label: "Heading" },
    caption: { label: "Caption" },
    size: {
      label: "Size",
      options: { small: "Small", large: "Large" },
    },
    showYear: { label: "Show the event year" },
  },
  countdown: {
    heading: { label: "Heading" },
  },
  event_times: {
    fields: {
      label: "Times to show",
      help: "Pick which of the four event times appear, in the order you want.",
      options: {
        scheduledAt: "Scheduled",
        wentLiveAt: "Liftoff",
        endedAt: "Wheels down",
        airborneFor: "Airborne for",
      },
    },
    labels: {
      label: "Labels for each time",
      help: "Rename the time labels visitors see.",
    },
    "labels.scheduledAt": {
      label: "Scheduled label",
      help: "Text shown next to the scheduled liftoff time.",
    },
    "labels.wentLiveAt": {
      label: "Liftoff label",
      help: "Text shown next to the time the event went live.",
    },
    "labels.endedAt": {
      label: "Wheels down label",
      help: "Text shown next to the time the event ended.",
    },
    "labels.airborneFor": {
      label: "Airborne for label",
      help: "Text shown next to the total time the event was live.",
    },
  },
  latest_message: {
    heading: { label: "Heading" },
    style: {
      label: "Style",
      options: { card: "Card", ticker: "Ticker" },
    },
  },
  map: {
    themes: {
      label: "Themes offered to visitors",
      help: "Themes visitors can pick from in the theme picker.",
      options: THEME_OPTIONS,
    },
    defaultTheme: {
      label: "Starting theme",
      help: "The theme the map opens with.",
      options: THEME_OPTIONS,
    },
    defaultCenter: {
      label: "Map starts centred on",
      help: "Latitude and longitude the map opens at.",
    },
    "defaultCenter.lat": { label: "Latitude" },
    "defaultCenter.lng": { label: "Longitude" },
    defaultZoom: {
      label: "Starting zoom",
      help: "Zoom level the map opens at, from 3 (world) to 18 (street).",
    },
    controls: {
      label: "Controls",
      help: "The small buttons and switches on the map itself.",
    },
    "controls.themePicker": {
      label: "Show the theme picker",
      help: "Lets visitors switch between the themes above.",
    },
    "controls.terrain": {
      label: "Show the terrain switch",
      help: "Lets visitors turn the terrain layer on or off.",
    },
    "controls.snow": {
      label: "Show the snow switch",
      help: "Lets visitors turn falling snow on or off.",
    },
    "controls.flightHistory": {
      label: "Show the flight history switch",
      help: "Lets visitors show or hide the trail of past positions.",
    },
    "controls.timeLabels": {
      label: "Show the time labels switch",
      help: "Lets visitors show or hide times next to markers.",
    },
    "controls.location": {
      label: "Show the my-location button",
      help: "Lets visitors centre the map on their own location.",
    },
    "controls.dataRow": {
      label: "Show the data row",
      help: "Shows speed, altitude, and heading along the bottom of the map.",
    },
    flightHistoryDefault: {
      label: "Show the flight history when the map opens",
      help: "When on, the trail of past positions is visible from the start.",
    },
    overlays: {
      label: "Overlays",
      help: "Panels and chips that float over the map.",
    },
    "overlays.liveIndicator": {
      label: "Show the live indicator",
      help: "A small badge that appears while the event is live.",
    },
    "overlays.liftoffTimer": {
      label: "Show the liftoff timer",
      help: "A countdown to liftoff, then time since liftoff.",
    },
    "overlays.latestMessage": {
      label: "Show the latest message",
      help: "The most recent event message pinned to the map.",
    },
    "overlays.leaderboardPanel": {
      label: "Show the leaderboard panel",
      help: "The cookie leaderboard as a panel on the map.",
    },
    "overlays.sponsorCarousel": {
      label: "Show the sponsor carousel",
      help: "A rotating strip of sponsor logos.",
    },
    "overlays.cookieControl": {
      label: "Show the leave-a-cookie control",
      help: "The button visitors tap to leave a cookie.",
    },
    "overlays.distanceChip": {
      label: "Show the distance chip",
      help: "The distance from the visitor to the balloon.",
    },
  },
  leaderboard: {
    heading: { label: "Heading" },
    variant: {
      label: "Variant",
      options: { panel: "Panel", full: "Full" },
    },
    emptyText: {
      label: "Text shown when the leaderboard is empty",
      help: "Shown to visitors before any cookies have been left.",
    },
  },
  sponsor_carousel: {
    heading: { label: "Heading" },
    logoWidth: {
      label: "Logo width",
      help: "How wide each sponsor logo shows in the carousel.",
      options: { "480": "480 px", "960": "960 px" },
    },
  },
  sponsor_grid: {
    heading: { label: "Heading" },
    columns: {
      label: "Columns",
      options: { "2": "Two", "3": "Three", "4": "Four" },
    },
    showYears: {
      label: "Show the year under each sponsor",
      help: "When on, each logo shows the years the sponsor supported.",
    },
    emptyText: {
      label: "Text shown when there are no sponsors",
      help: "Shown to visitors before any sponsors have been added.",
    },
  },
  route_preview: {
    heading: { label: "Heading" },
    style: {
      label: "Style",
      options: { image: "Image", viewer: "Pan and zoom viewer" },
    },
    disclaimer: { label: "Disclaimer" },
    emptyText: {
      label: "Text shown when there is no route yet",
      help: "Shown to visitors before this year's route is set.",
    },
  },
  cookie_control: {
    heading: { label: "Heading" },
    copy: { label: "Copy" },
    signedOutCopy: {
      label: "Text shown to visitors who are not signed in",
      help: "Explains that signing in is needed to leave a cookie.",
    },
    closedCopy: {
      label: "Text shown when the event is not live",
      help: "Explains that cookies can only be left while the event is live.",
    },
  },
  alerts_signup: {
    heading: { label: "Heading" },
    copy: { label: "Copy" },
    signedOutCopy: {
      label: "Text shown to visitors who are not signed in",
      help: "Explains that signing in is needed to sign up for alerts.",
    },
  },
  contact_form: {
    heading: { label: "Heading" },
    copy: { label: "Copy" },
    successText: { label: "Success message" },
  },
};

const ITEM: Record<string, FieldLabels> = {
  media: {
    media: { label: "Image" },
    caption: { label: "Caption" },
    link: { label: "Link" },
  },
  links: {
    link: { label: "Link" },
    description: { label: "Description" },
  },
  icon_row: {
    icon: { label: "Icon" },
    label: { label: "Label" },
  },
};

export function labelsFor(kind: string, isItem: boolean): FieldLabels {
  const table = isItem ? ITEM : SECTION;
  return table[kind] ?? {};
}

// Every kind name for which a section-level entry exists. Used by the
// completeness test.
export function knownSectionKinds(): string[] {
  return Object.keys(SECTION);
}

// Every kind name for which an item-level entry exists.
export function knownItemKinds(): string[] {
  return Object.keys(ITEM);
}
