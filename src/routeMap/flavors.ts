// docs/site.md section 8.9. The two basemap flavors of the route map and
// the palette of what the site draws over them. Each flavor is one table
// holding every colour key of the @protomaps/basemaps flavor, with the
// tracker theme value it is taken from beside it, so the route map reads
// as the same world as the tracker:
//  - light follows src/map/themes/standard.ts. That theme leaves Google's
//    default roadmap unstyled, so the ground, water, roads, and landuse
//    are Google's default roadmap colours, and the labels and halos take
//    standard.ts's chrome text colours.
//  - dark follows src/map/themes/night.ts: every colour is a value of its
//    style array or its overlay palette.
// The hillshade paint of the terrain view is one table per appearance
// too: a low exaggeration and shadow and highlight colours close to the
// ground, so the relief is visible but stays well below the route line's
// contrast.
// The route palette also carries the time label pair of the poster's time
// labels: dark text on a light halo for light, light text on a dark halo
// for dark, so each label stands off the basemap in its own flavor.

import type { Flavor } from "@protomaps/basemaps";

export type Appearance = "light" | "dark";

export type RoutePalette = {
  routeColor: string;   // the path line and the start marker fill
  routeOpacity: number; // the path line opacity
  markerStroke: string; // the ring around the start and end markers
  endFill: string;      // the end marker fill
  labelText: string;    // the time label text
  labelHalo: string;    // the halo around the time label text
};

export type HillshadePaint = {
  "hillshade-exaggeration": number; // how strongly the relief is shaded
  "hillshade-shadow-color": string; // slopes facing away from the light
  "hillshade-highlight-color": string; // slopes facing the light
  "hillshade-accent-color": string; // steep terrain edges
};

export const LIGHT_FLAVOR: Flavor = {
  background: "#f8f9fa",              // Google default land
  earth: "#f8f9fa",                   // Google default land
  park_a: "#c3ecb2",                  // Google default park
  park_b: "#c3ecb2",                  // Google default park
  hospital: "#fce8e6",                // Google default medical area
  industrial: "#f1f3f4",              // Google default built-up area
  school: "#f1f3f4",                  // Google default built-up area
  wood_a: "#c3ecb2",                  // Google default natural green
  wood_b: "#c3ecb2",                  // Google default natural green
  pedestrian: "#f1f3f4",              // Google default built-up area
  scrub_a: "#c3ecb2",                 // Google default natural green
  scrub_b: "#c3ecb2",                 // Google default natural green
  glacier: "#ffffff",                 // Google default ice
  sand: "#f6ecd2",                    // Google default sand
  beach: "#f6ecd2",                   // Google default sand
  aerodrome: "#e8eaed",               // Google default airport
  runway: "#dadce0",                  // Google default runway
  water: "#aadaff",                   // Google default water
  zoo: "#c3ecb2",                     // Google default park
  military: "#e8eaed",                // Google default restricted area
  tunnel_other_casing: "#dadce0",     // Google default road stroke
  tunnel_minor_casing: "#dadce0",     // Google default road stroke
  tunnel_link_casing: "#dadce0",      // Google default road stroke
  tunnel_major_casing: "#dadce0",     // Google default road stroke
  tunnel_highway_casing: "#f9ab00",   // Google default highway stroke
  tunnel_other: "#f1f3f4",            // Google default tunnel
  tunnel_minor: "#f1f3f4",            // Google default tunnel
  tunnel_link: "#f1f3f4",             // Google default tunnel
  tunnel_major: "#f1f3f4",            // Google default tunnel
  tunnel_highway: "#fde293",          // Google default highway
  pier: "#f1f3f4",                    // Google default built-up area
  buildings: "#e8eaed",               // Google default building
  minor_service_casing: "#dadce0",    // Google default road stroke
  minor_casing: "#dadce0",            // Google default road stroke
  link_casing: "#dadce0",             // Google default road stroke
  major_casing_late: "#dadce0",       // Google default road stroke
  highway_casing_late: "#f9ab00",     // Google default highway stroke
  other: "#ffffff",                   // Google default road
  minor_service: "#ffffff",           // Google default road
  minor_a: "#ffffff",                 // Google default road
  minor_b: "#ffffff",                 // Google default road
  link: "#ffffff",                    // Google default road
  major_casing_early: "#dadce0",      // Google default road stroke
  major: "#ffffff",                   // Google default road
  highway_casing_early: "#f9ab00",    // Google default highway stroke
  highway: "#fde293",                 // Google default highway
  railway: "#bdc1c6",                 // Google default rail line
  boundaries: "#9aa0a6",              // Google default administrative line
  bridges_other_casing: "#dadce0",    // Google default road stroke
  bridges_minor_casing: "#dadce0",    // Google default road stroke
  bridges_link_casing: "#dadce0",     // Google default road stroke
  bridges_major_casing: "#dadce0",    // Google default road stroke
  bridges_highway_casing: "#f9ab00",  // Google default highway stroke
  bridges_other: "#ffffff",           // Google default road
  bridges_minor: "#ffffff",           // Google default road
  bridges_link: "#ffffff",            // Google default road
  bridges_major: "#ffffff",           // Google default road
  bridges_highway: "#fde293",         // Google default highway
  roads_label_minor: "#5f6368",       // standard.ts chrome.fg
  roads_label_minor_halo: "#ffffff",  // standard.ts chrome.bg
  roads_label_major: "#5f6368",       // standard.ts chrome.fg
  roads_label_major_halo: "#ffffff",  // standard.ts chrome.bg
  ocean_label: "#1a56c4",             // standard.ts chrome.accent
  subplace_label: "#5f6368",          // standard.ts chrome.fg
  subplace_label_halo: "#ffffff",     // standard.ts chrome.bg
  city_label: "#202124",              // standard.ts chrome.text
  city_label_halo: "#ffffff",         // standard.ts chrome.bg
  state_label: "#5f6368",             // standard.ts chrome.fg
  state_label_halo: "#ffffff",        // standard.ts chrome.bg
  country_label: "#5f6368",           // standard.ts chrome.fg
  address_label: "#5f6368",           // standard.ts chrome.fg
  address_label_halo: "#ffffff",      // standard.ts chrome.bg
};

export const DARK_FLAVOR: Flavor = {
  background: "#242f3e",              // night.ts geometry
  earth: "#242f3e",                   // night.ts geometry
  park_a: "#263c3f",                  // night.ts poi.park geometry
  park_b: "#263c3f",                  // night.ts poi.park geometry
  hospital: "#242f3e",                // night.ts geometry
  industrial: "#242f3e",              // night.ts geometry
  school: "#242f3e",                  // night.ts geometry
  wood_a: "#263c3f",                  // night.ts poi.park geometry
  wood_b: "#263c3f",                  // night.ts poi.park geometry
  pedestrian: "#242f3e",              // night.ts geometry
  scrub_a: "#263c3f",                 // night.ts poi.park geometry
  scrub_b: "#263c3f",                 // night.ts poi.park geometry
  glacier: "#242f3e",                 // night.ts geometry
  sand: "#242f3e",                    // night.ts geometry
  beach: "#242f3e",                   // night.ts geometry
  aerodrome: "#2f3948",               // night.ts transit geometry
  runway: "#38414e",                  // night.ts road geometry
  water: "#17263c",                   // night.ts water geometry
  zoo: "#263c3f",                     // night.ts poi.park geometry
  military: "#242f3e",                // night.ts geometry
  tunnel_other_casing: "#212a37",     // night.ts road geometry.stroke
  tunnel_minor_casing: "#212a37",     // night.ts road geometry.stroke
  tunnel_link_casing: "#212a37",      // night.ts road geometry.stroke
  tunnel_major_casing: "#212a37",     // night.ts road geometry.stroke
  tunnel_highway_casing: "#1f2835",   // night.ts road.highway geometry.stroke
  tunnel_other: "#2f3948",            // night.ts transit geometry
  tunnel_minor: "#2f3948",            // night.ts transit geometry
  tunnel_link: "#2f3948",             // night.ts transit geometry
  tunnel_major: "#2f3948",            // night.ts transit geometry
  tunnel_highway: "#746855",          // night.ts road.highway geometry
  pier: "#2f3948",                    // night.ts transit geometry
  buildings: "#2f3948",               // night.ts transit geometry
  minor_service_casing: "#212a37",    // night.ts road geometry.stroke
  minor_casing: "#212a37",            // night.ts road geometry.stroke
  link_casing: "#212a37",             // night.ts road geometry.stroke
  major_casing_late: "#212a37",       // night.ts road geometry.stroke
  highway_casing_late: "#1f2835",     // night.ts road.highway geometry.stroke
  other: "#38414e",                   // night.ts road geometry
  minor_service: "#38414e",           // night.ts road geometry
  minor_a: "#38414e",                 // night.ts road geometry
  minor_b: "#38414e",                 // night.ts road geometry
  link: "#38414e",                    // night.ts road geometry
  major_casing_early: "#212a37",      // night.ts road geometry.stroke
  major: "#38414e",                   // night.ts road geometry
  highway_casing_early: "#1f2835",    // night.ts road.highway geometry.stroke
  highway: "#746855",                 // night.ts road.highway geometry
  railway: "#2f3948",                 // night.ts transit geometry
  boundaries: "#746855",              // night.ts labels.text.fill
  bridges_other_casing: "#212a37",    // night.ts road geometry.stroke
  bridges_minor_casing: "#212a37",    // night.ts road geometry.stroke
  bridges_link_casing: "#212a37",     // night.ts road geometry.stroke
  bridges_major_casing: "#212a37",    // night.ts road geometry.stroke
  bridges_highway_casing: "#1f2835",  // night.ts road.highway geometry.stroke
  bridges_other: "#38414e",           // night.ts road geometry
  bridges_minor: "#38414e",           // night.ts road geometry
  bridges_link: "#38414e",            // night.ts road geometry
  bridges_major: "#38414e",           // night.ts road geometry
  bridges_highway: "#746855",         // night.ts road.highway geometry
  roads_label_minor: "#9ca5b3",       // night.ts road labels.text.fill
  roads_label_minor_halo: "#242f3e",  // night.ts labels.text.stroke
  roads_label_major: "#f3d19c",       // night.ts road.highway labels.text.fill
  roads_label_major_halo: "#242f3e",  // night.ts labels.text.stroke
  ocean_label: "#515c6d",             // night.ts water labels.text.fill
  subplace_label: "#746855",          // night.ts labels.text.fill
  subplace_label_halo: "#242f3e",     // night.ts labels.text.stroke
  city_label: "#d59563",              // night.ts administrative.locality labels.text.fill
  city_label_halo: "#242f3e",         // night.ts labels.text.stroke
  state_label: "#746855",             // night.ts labels.text.fill
  state_label_halo: "#242f3e",        // night.ts labels.text.stroke
  country_label: "#746855",           // night.ts labels.text.fill
  address_label: "#9ca5b3",           // night.ts road labels.text.fill
  address_label_halo: "#242f3e",      // night.ts labels.text.stroke
};

export const FLAVORS: Record<Appearance, Flavor> = {
  light: LIGHT_FLAVOR,
  dark: DARK_FLAVOR,
};

export const ROUTE_PALETTES: Record<Appearance, RoutePalette> = {
  light: {
    routeColor: "#1a56c4",  // standard.ts routeColor
    routeOpacity: 0.9,      // standard.ts routeOpacity
    markerStroke: "#ffffff", // standard.ts chrome.bg
    endFill: "#202124",     // standard.ts chrome.text
    labelText: "#202124",   // standard.ts chrome.text
    labelHalo: "#ffffff",   // standard.ts chrome.bg
  },
  dark: {
    routeColor: "#33d6ff",  // night.ts routeColor
    routeOpacity: 0.85,     // night.ts routeOpacity
    markerStroke: "#0f1a2b", // night.ts chrome.bg
    endFill: "#f2f6ff",     // night.ts chrome.text
    labelText: "#f2f6ff",   // night.ts chrome.text
    labelHalo: "#0f1a2b",   // night.ts chrome.bg
  },
};

export const HILLSHADE_PAINTS: Record<Appearance, HillshadePaint> = {
  light: {
    "hillshade-exaggeration": 0.25,
    "hillshade-shadow-color": "#5f6368",    // standard.ts chrome.fg
    "hillshade-highlight-color": "#ffffff", // standard.ts chrome.bg
    "hillshade-accent-color": "#9aa0a6",    // Google default administrative line
  },
  dark: {
    "hillshade-exaggeration": 0.3,
    "hillshade-shadow-color": "#1f2835",    // night.ts road.highway geometry.stroke
    "hillshade-highlight-color": "#515c6d", // night.ts water labels.text.fill
    "hillshade-accent-color": "#17263c",    // night.ts water geometry
  },
};
