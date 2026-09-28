# Route map

`style.ts` and `flavors.ts` are byte-identical copies of `src/routeMap/style.ts`
and `src/routeMap/flavors.ts` in the santa repository (the public site). Santa
holds the canonical copy: every change to the route map style is made there
first and synced here by copying both files unchanged. Never edit them in this
repository.

`index.ts`, `poster.ts`, and `posterStyle.ts` belong to the panel. `poster.ts`
holds the poster generator's presets, the lazy probe of
`<base>/terrain.pmtiles`, the offscreen render, the arrowhead image added to
every poster map, and the composed JPEG with the attribution drawn into it.
`posterStyle.ts` holds the route styling options, the time labels, and
`buildPosterStyle`, the one style call the live preview and the export render
share. `index.ts` reads the basemap base URL from the panel
config (`VITE_ROUTE_BASEMAP_URL`, read by `loadConfig` in `src/config.ts` into
`routeBasemapUrl`) and builds the style over it, so the tiles resolve at
`<base>/tiles.pmtiles` and the glyphs at `<base>/glyphs/{fontstack}/{range}.pbf`.

The panel compiles with `noUncheckedIndexedAccess` and santa does not, so the
two copied files build in their own TypeScript project,
`tsconfig.routemap.json`, with santa's checks; `tsconfig.app.json` excludes
them and references that project.
