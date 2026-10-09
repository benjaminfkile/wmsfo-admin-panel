# Route map

Every file here belongs to the panel. The panel builds no basemap style of
its own: every map it draws is a tracker theme's style body over a tracker
map row, the way the site draws it, and the two seeded MapLibre themes
(`route-light` and `route-dark`) are the route map style the site used
before themes were rows. The fixtures under `contracts/fixtures/themes/`
are the fidelity check against the site.

`themeStyle.ts` loads a theme's style body (`loadThemeStyle`,
`themeStyleQuery`) and points it at a tracker map row (`applyMap`): the
`basemap` and `terrain` sources at the row's archives, the terrain layers
dropped when there is no terrain, and the layers marked `wmsfo:places`
kept to the given kinds. `index.ts` points a body at the dev basemap
(`applyDevBasemap`, over `VITE_ROUTE_BASEMAP_URL` read by `loadConfig` in
`src/config.ts` into `routeBasemapUrl`) for the theme preview and the box
editors, and re-exports the route layer pieces.

`routeLayers.ts` holds the panel's route layers drawn over a theme body
(`withRouteLayers`: the line, the marks, the start and end markers, the
arrows, and the time labels in the theme's `overlay` colours unless the
route colour is overridden), the Map details groups (`DETAIL_LAYERS`,
`withoutDetails`), the arrowhead image, `pathBounds`, and the
OpenStreetMap attribution.

`poster.ts` holds the poster generator's presets, the offscreen render,
the arrowhead image added to every poster map, and the composed JPEG with
the attribution chip drawn into it. `posterStyle.ts` holds the route
styling options, the time labels, and `buildPosterStyle`, the one style
call the live preview and the export render share. `eventRouteMap.ts`
holds an event's `routeMapConfig` as the panel edits it, the values the
site resolves from it, the Route map card's summary, the theme and map
the dialog's preview draws (`eventRouteMapSource`), and
`eventRouteMapStyle`, the one style call that preview draws with.
`posterLayout.ts` holds the poster layout document saved on a poster (the
whole studio design, the chosen theme and map by id, and its overlay
elements), with positions and sizes as fractions of the poster, and the
defaults of the Theme and Map selects; `posterOverlay.ts` draws its
elements on an offscreen Konva stage at the print scale; `overlayImage.ts`
loads the overlay images with CORS and refuses one that would taint the
canvas.
