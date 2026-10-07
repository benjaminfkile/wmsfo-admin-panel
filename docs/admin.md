# WMSFO v2 admin panel

Technical design for the admin panel: the React + MUI single-page app in the `wmsfo-admin-panel` repository, built with Vite, deployed on Vercel from `main`, served at `https://<admin-domain>`. It is the only surface for admin actions. It reads and writes the API's `/admin/*` routes with a Cognito ID token, reads one CDN object on the dashboard, and never joins the hub. Every name and shape below is the one in the shared contracts.

---

## 1. Shape

| Piece | Choice |
|---|---|
| Build | Vite 6, `@vitejs/plugin-react`, TypeScript 5, `strict` |
| UI | React 19, MUI v7 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`), `@uiw/react-json-view` for raw JSON |
| Content forms | `@rjsf/core`, `@rjsf/mui`, `@rjsf/utils`, `@rjsf/validator-ajv8`: forms generated from the vendored section schemas, with custom fields for the shared primitives (section 6.14) |
| Reordering | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for section items and the sponsor order; sections and pages reorder with up and down buttons |
| Maps and codes | `@googlemaps/js-api-loader` (maps, markers, Places autocomplete), `qrcode` (TOTP QR, printed codes, poster QR cards), `@zxing/browser` (camera fallback on Scan), `konva` and `react-konva` (the poster overlay composer and the overlay layer of the poster export) |
| Routing | `react-router-dom` v7, `BrowserRouter` with nested `Routes` |
| Auth | `oidc-client-ts` against the Cognito hosted UI, authorization code with PKCE |
| Data | `@tanstack/react-query` v5 over `fetch` |
| Types | `openapi-typescript` over the vendored `contracts/openapi.json` |
| Tests | Vitest, `@testing-library/react`, `@testing-library/user-event`, `msw`; Playwright against the dev stack |
| Hosting | Vercel, framework preset Vite, output `dist`, SPA rewrite to `index.html` |

Routes and what each one calls:

| Route | Page | API calls |
|---|---|---|
| `/` | Dashboard | `GET /admin/events`, `GET /admin/live`, `GET <cdn>/live/location.json`, `GET /admin/snapshot`, `GET /admin/beacons`, `GET /admin/cookie-types`, `POST /admin/live/republish`, `POST /admin/snapshot/rebuild`, `POST /admin/events/{id}/status`, `GET /admin/subscribers/summary` (inside `StatusDialog`) |
| `/events` | Events list | `GET /admin/events`, `GET /admin/routes`, `POST /admin/events`, `POST /admin/events/{id}/current`, `POST /admin/events/{id}/clone`, `GET /admin/events/{id}/impact`, `DELETE /admin/events/{id}` |
| `/events/:id` | Event detail | `GET /admin/events/{id}`, `GET /admin/events`, `PATCH /admin/events/{id}` (fields, `routeId`), `POST .../status`, `POST .../notify`, `POST .../current`, `GET .../status-history`, `.../messages` (list, post, patch, delete), `GET .../locations` (JSON and CSV), `GET /admin/routes`, `POST /admin/routes`, `POST /admin/routes/from-event/{id}`, `GET /admin/beacons`, `GET /admin/subscribers/summary`, `GET .../impact`, `DELETE /admin/events/{id}`, `POST .../cookies` (Seed cookies, live event only), `GET /admin/cookie-types` |
| `/posters` | Poster studio (the poster list) | `GET /admin/posters`, `GET /admin/routes`, `POST /admin/posters`, `GET /admin/posters/{id}` (duplicate), `GET /admin/posters/{id}/impact`, `DELETE /admin/posters/{id}` |
| `/posters/:id` | Poster editor | `GET /admin/posters/{id}`, `PATCH /admin/posters/{id}` (`name`, `routeId`, `layout`), `GET /admin/routes` (the recording picker), `GET /admin/routes/{id}/route-map`, `POST /admin/media/upload-url`, the presigned `PUT`, `POST /admin/media/{id}/confirm`, `GET /admin/media` and `GET /admin/media/{id}` (overlay images), `GET /admin/site-settings` (the logo), `GET /admin/qr-codes` |
| `/routes` | Flight recordings | `GET /admin/routes`, `GET /admin/events`, `POST /admin/routes`, `POST /admin/routes/from-event/{eventId}`, `GET /admin/routes/{id}/impact`, `DELETE /admin/routes/{id}` |
| `/beacons` | Beacons list | `GET /admin/beacons` (polled), `GET /admin/events`, `POST /admin/beacons`, `.../activate`, `.../deactivate`, `.../rotate`, `.../revoke` |
| `/beacons/:id` | Beacon detail | `GET /admin/beacons` (the same poll), `GET /admin/events`, `PATCH /admin/beacons/{id}`, the four actions, `GET .../logs`, `GET .../logs/{logId}` |
| `/qr-codes` | QR codes | `GET /admin/qr-codes`, `GET /admin/places`, `POST /admin/qr-codes`, `PATCH /admin/qr-codes/{id}`, `POST .../attach`, `POST .../detach`, `GET .../impact`, `DELETE /admin/qr-codes/{id}` |
| `/qr-codes/:id` | QR code detail | `GET /admin/qr-codes/{id}`, `GET /admin/places`, `GET /admin/pages`, `PATCH`, `POST .../attach`, `POST .../detach` |
| `/places` | Places | `GET /admin/places`, `GET /admin/pages`, `POST /admin/places`, `PATCH /admin/places/{id}`, `GET .../impact`, `DELETE /admin/places/{id}` |
| `/places/:id` | Place detail | `GET /admin/places`, `GET /admin/qr-codes`, `GET /admin/pages`, `PATCH /admin/places/{id}`, `PUT .../location`, `DELETE .../location`, `POST /admin/qr-codes/{id}/attach`, `POST .../detach` |
| `/places/map` | Places map | `GET /admin/events`, `GET /admin/places/map` |
| `/scan` | Scan | `GET /admin/qr-codes`, `GET /admin/places`, `POST /admin/places`, `POST /admin/qr-codes/{id}/attach`, `PUT /admin/places/{id}/location` |
| `/pages` | Pages | `GET /admin/pages`, `POST /admin/pages`, `PATCH /admin/pages/{id}`, `GET .../impact`, `DELETE /admin/pages/{id}[?roleTo=]`, `PUT /admin/pages/order` |
| `/pages/:id` | Page editor | `GET /admin/pages/{id}`, `GET /admin/pages`, `GET /admin/content/kinds`, `PATCH /admin/pages/{id}`, `POST .../sections`, `PATCH /admin/sections/{id}`, `DELETE`, `.../duplicate`, `.../move`, `PUT .../sections/order`, `POST .../items`, `PATCH /admin/items/{id}`, `DELETE`, `PUT .../items/order`, `GET /admin/icons` and `GET /admin/media` from the pickers |
| `/media` | Media library | `GET /admin/media`, `POST /admin/media/upload-url`, the presigned `PUT` to S3, `POST /admin/media/{id}/confirm`, `GET .../usage`, `GET /admin/events` (poster usage), `PATCH`, `GET .../impact`, `DELETE` |
| `/site-settings` | Site settings | `GET /admin/site-settings`, `PUT /admin/site-settings`, `POST /admin/content/preview-token`, `GET /admin/pages` (preview page select) |
| `/publish` | Publish | `GET /admin/content/status`, `POST /admin/content/publish`, `GET /admin/content/versions`, `GET .../{id}`, `POST .../{id}/restore` |
| `/sponsors` | Sponsors list | `GET /admin/sponsors`, `POST /admin/sponsors`, `POST /admin/sponsors/import`, `GET /admin/events` (import dialog) |
| `/sponsors/order` | Sponsor order | `GET /admin/events`, `GET /admin/sponsors`, `GET /admin/sponsors/order/{eventYear}`, `PUT /admin/sponsors/order/{eventYear}`, `PUT /admin/sponsors/{id}/years/{eventYear}` (time override) |
| `/sponsors/:id` | Sponsor detail | `GET /admin/sponsors/{id}`, `GET /admin/events`, `GET /admin/settings` (year dialog), `PATCH` (fields and `logoMediaId`), `PUT`/`DELETE .../years/{eventYear}`, `POST .../years/{target}/copy-from/{source}`, `GET .../impact`, `DELETE` |
| `/cookie-types` | Cookie types | `GET /admin/cookie-types`, `GET /admin/events`, `GET /admin/icons`, `POST`, `PATCH .../{id}`, `GET .../impact`, `DELETE .../{id}` |
| `/subscribers` | Subscribers | `GET /admin/subscribers/summary`, `GET /admin/subscribers`, `GET .../impact`, `DELETE /admin/subscribers/{id}` |
| `/people` | People | `GET /admin/people`, `GET .../impact`, `DELETE /admin/people/{id}` |
| `/contact-messages` | Contact messages | `GET /admin/contact-messages`, `GET .../impact`, `DELETE /admin/contact-messages/{id}` |
| `/settings` | Settings | `GET /admin/settings`, `PUT /admin/settings/{key}` |
| `/api-keys` | API keys | `GET /admin/api-keys`, `POST /admin/api-keys`, `POST /admin/api-keys/{id}/revoke` |
| `/agents` | Agents | the same three calls through the embedded keys table; the prompt is built in the panel |
| `/audit` | Audit | `GET /admin/audit/entities`, `GET /admin/audit` |
| `/auth/callback` | OIDC callback | none |

`MfaSetup` is not a route: it replaces the shell whenever the auth state is `mfa_required` (section 3.5).

Roles: a member of `admin` sees everything. A member of `editor` sees Pages, Media, Site settings, Publish, Sponsors, Sponsor order, QR codes, Places, Scan, and Audit, and lands on Pages. A member of `canvasser` sees QR codes, Places, and Scan only, and lands on Scan. The panel hides what a role cannot use and the API enforces it (`403 forbidden`).

**Edit controls.** Every row the panel can edit carries an edit icon button (the MUI pencil, `aria-label="Edit <name>"`) that opens the same dialog or page the row's name link opens: events, beacons (including revoked ones in their accordion), sponsors, sponsor years, cookie types, pages, QR codes, places, posters, and media cards (the pencil opens the detail drawer). Flight recordings and API keys have no pencil (a recording's name is not editable; a key is revoked, never edited). Names stay links as well; the pencil is the discoverable control. State-changing row actions (set current, clone, delete, activate, rotate, revoke, attach, detach, enable, move) sit in a `MoreVert` row menu next to the pencil. Subscribers, people, and contact messages, which have delete as their only action, carry a delete icon button instead of a menu.

**Audit column.** Every table of an audited resource (events, flight recordings, beacons, sponsors, sponsor years, cookie types, API keys, people, subscribers, contact messages, settings, pages, content versions, QR codes, places, posters) ends with a column headed `Audit`, the last `<td>` of every row, holding one icon button (`HistoryIcon`, `aria-label="Audit <name>"`) rendered by `AuditCell`. Its tooltip shows the row's newest stamp from `audit` on the DTO: "<Action> by <actor> · <time in the viewer's zone>" (the actor without its `person:` prefix, API keys as "key <name>"), or "No changes recorded since the audit log began" when `audit` is null. Sponsor year and poster rows pass a null stamp (a poster summary carries none). Clicking opens `AuditHistoryDialog` for that entity and id: `GET /admin/audit?entity=&entityId=` newest first, paged with Load more, each entry a row with the time, the actor, the action, and the changed top-level fields as "field: before → after" computed from the two JSON objects (arrays and objects summarised as "changed"), expandable to the raw before and after. Media cards, event messages, sections, and items have no audit cell.

---

## 2. Repository layout and configuration

### 2.1 Source tree

```
wmsfo-admin-panel/
  index.html  vite.config.ts  vercel.json  tsconfig*.json  eslint.config.js  playwright.config.ts  .env.example
  contracts/                    vendored copy of the API repository's contracts/ (openapi.json, schema/, fixtures/, icons/, kinds.json, starter-content.json, admin-thresholds.json, CONTRACTS_VERSION)
  CONTRACTS_SHA                 API commit the copy came from
  scripts/check-contracts.mjs   diffs contracts/ against that commit
  e2e/                          Playwright specs (01 to 09 plus 05a; 09 is the phone-viewport project) and helpers.ts
  docs/                         admin.md (this file), README.md, DESIGN.md and contracts.md (copies)
  src/
    main.tsx  App.tsx  AppRoutes.tsx  routesConfig.ts  ConfigContext.tsx  config.ts  vite-env.d.ts  setupTests.ts
    auth/       userManager.ts  AuthProvider.tsx  RequireAdmin.tsx  claims.ts  signOut.ts  mfa.ts
    api/        client.ts  errors.ts  cdn.ts  impact.ts  schema.d.ts (generated)  types.ts
                resources/  index.ts  events.ts  routes.ts  beacons.ts  sponsors.ts  cookieTypes.ts  settings.ts
                            subscribers.ts  people.ts  contactMessages.ts  snapshot.ts  live.ts  pages.ts  sections.ts
                            siteSettings.ts  content.ts  icons.ts  media.ts  upload.ts  apiKeys.ts  audit.ts  qr.ts  places.ts
    queries/    keys.ts  polling.ts
    validation/ sponsor.ts  page.ts  settings.ts  image.ts  routeFile.ts
    schemas/    draft.ts (derive the draft-level schema)  bundle.ts (inline the primitives)
    lib/        time.ts  csv.ts  download.ts  publishedState.ts  beaconFlags.ts  thresholds.ts  statusNames.ts  statusCopy.ts
                roles.ts  errorMessages.ts  fieldErrors.ts
    hooks/      useNotify.tsx  useNow.ts  useDebouncedSave.ts  useCompact.ts
    components/ layout/MainLayout.tsx  layout/PageHeader.tsx  EnvBadge.tsx  NetworkBanner.tsx  ErrorAlert.tsx  AppDialog.tsx  ConfirmDialog.tsx  DeleteDialog.tsx
                KeyRevealDialog.tsx  ThemedJsonView.tsx  CommentBox.tsx  StatusChip.tsx  FlagChip.tsx
                audit/    AuditCell.tsx  AuditHistoryDialog.tsx  auditFormat.ts
                list/     ResponsiveTable.tsx
                content/  SchemaForm.tsx  PresentationPanel.tsx  SectionCard.tsx  SectionPalette.tsx  ItemsEditor.tsx
                          ProblemList.tsx  MoveSectionDialog.tsx  PreviewFrame.tsx  MediaPicker.tsx  IconPicker.tsx
                          fields/IconField.tsx  MediaField.tsx  LinkField.tsx  InlineField.tsx  BlocksField.tsx
                                 PresentationPanelField.tsx  ThemeField.tsx
                          pickers/IconPicker.tsx
                media/    Uploader.tsx  useMediaUpload.ts  MediaGrid.tsx  MediaCard.tsx  MediaDetailDrawer.tsx  UsageList.tsx
    pages/      Dashboard.tsx  NotAvailable.tsx  Placeholder.tsx
                auth/     SignIn.tsx  Callback.tsx  NoRole.tsx  MfaSetup.tsx  ConfigError.tsx
                events/   EventsList.tsx  EventDetail.tsx  EventCreateDialog.tsx  EventCloneDialog.tsx  StatusDialog.tsx
                          NotifyDialog.tsx  MessagesSection.tsx  SeedCookiesSection.tsx  RouteSection.tsx
                          RouteUploadDialog.tsx  LocationsSection.tsx  ClearRecordingDialog.tsx  MessageHelper.tsx
                posters/  PostersList.tsx  copyName.ts  PosterEditor.tsx  PosterStudioWorkspace.tsx
                          RoutePosterPreview.tsx  PosterOverlayComposer.tsx  PosterOverlayControls.tsx  overlaySources.ts
                routes/   RoutesList.tsx
                beacons/  BeaconsList.tsx  BeaconDetail.tsx  BeaconCreateDialog.tsx  TelemetryPanel.tsx  BeaconLogs.tsx
                sponsors/ SponsorsList.tsx  SponsorDetail.tsx  SponsorYearDialog.tsx  SponsorImportDialog.tsx
                          LogoSection.tsx  SponsorOrder.tsx
                cookieTypes/CookieTypesList.tsx  settings/Settings.tsx
                pages/    PagesList.tsx  PageCreateDialog.tsx  PageEditor.tsx  PageSettingsDialog.tsx
                media/    MediaLibrary.tsx
                siteSettings/SiteSettings.tsx
                publish/  Publish.tsx  VersionsList.tsx  VersionDialog.tsx
                subscribers/Subscribers.tsx  people/People.tsx  contact/ContactMessages.tsx
                apiKeys/  ApiKeysList.tsx  ApiKeyCreateDialog.tsx
                agents/   AgentsPage.tsx  agentPrompt.ts
                audit/    AuditPage.tsx
                qr/       QrCodesList.tsx  QrCodeDetail.tsx  Scan.tsx  AttachSheet.tsx  AttachDialog.tsx
                          PrintSheetDialog.tsx  DailyChart.tsx  qrHelpers.ts  qrRender.ts  barcodeReader.ts
                places/   PlacesList.tsx  PlaceDetail.tsx  PlacesMap.tsx  PlaceDialog.tsx  LocationCard.tsx
                          placeHelpers.ts  googleMaps.ts
    routeMap/   style.ts  flavors.ts (copied from santa)  index.ts  poster.ts  posterStyle.ts  posterLayout.ts
                posterOverlay.ts  overlayImage.ts  README.md
    theme/      theme.ts  themeStorage.ts
    test/       msw/server.ts  msw/handlers.ts  msw/fixtures.ts  renderWithProviders.tsx
```

There are two icon pickers: `components/content/pickers/IconPicker.tsx` (Library and Uploaded SVG tabs, picks on click) backs the schema-form fields; `components/content/IconPicker.tsx` (Library, SVG assets, Upload SVG tabs, a Choose button) backs the cookie type dialog.

### 2.2 Scripts and dependencies

`package.json` is the source for versions. Scripts:

| Script | Runs |
|---|---|
| `dev` | `vite --port 5174 --strictPort` |
| `build` | `tsc -b && vite build` into `dist/` |
| `preview` | `vite preview --port 5174 --strictPort` |
| `typecheck` | `tsc -b` |
| `lint` | `eslint .` |
| `test`, `test:watch` | `vitest run`, `vitest` |
| `gen:api-types` | `openapi-typescript contracts/openapi.json -o src/api/schema.d.ts` |
| `check:contracts`, `contracts:check` | `node scripts/check-contracts.mjs` |
| `e2e` | `playwright test` |

Port 5174 is the origin registered on the `wmsfo-admin` Cognito client, in the API's dev `WMSFO_CORS_ORIGINS`.

### 2.3 index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <link rel="icon" href="/favicon.ico" />
    <title>WMSFO Admin</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Files in `public/` (`favicon.ico`, `robots.txt`) are referenced by absolute path. On `dev` and `local` the title is prefixed `[DEV]` or `[LOCAL]` at boot.

### 2.4 vite.config.ts

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  build: { outDir: "dist", sourcemap: true, target: "es2022" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
```

### 2.5 Environment variables

Nine variables, all prefixed `VITE_`, read through `import.meta.env`; the first eight are required and `VITE_ROUTE_BASEMAP_URL` is optional:

| Variable | Meaning |
|---|---|
| `VITE_ENV` | `prod`, `dev`, or `local` (`local` when the API runs on this machine) |
| `VITE_API_BASE_URL` | base URL of the WMSFO API |
| `VITE_CDN_BASE_URL` | base URL of the public CDN |
| `VITE_SITE_BASE_URL` | base URL of the public site; the `/q/<tag>` QR target |
| `VITE_COGNITO_AUTHORITY` | `https://cognito-idp.<region>.amazonaws.com/<admin-pool-id>` (the admin pool; the panel never talks to the people pool) |
| `VITE_COGNITO_DOMAIN` | the admin pool's managed login domain |
| `VITE_COGNITO_CLIENT_ID` | the `wmsfo-admin` app client id |
| `VITE_GOOGLE_MAPS_KEY` | the site's browser key with the Maps and Places libraries enabled and the panel's origins in its referrers |
| `VITE_ROUTE_BASEMAP_URL` | optional; the route map basemap base URL, the same value the site uses (`<base>/tiles.pmtiles` and `<base>/glyphs/...`); empty when unset, and only the route map (section 2.11) reads it |

`.env.example` lists the nine names with empty values, plus the six `E2E_*` names section 9.3 uses, and is committed; `.env.local` is ignored. Trailing slashes are stripped from every URL.

```ts
// src/config.ts
export type AppEnv = "prod" | "dev" | "local";
export type Config = {
  env: AppEnv;
  apiBaseUrl: string;
  cdnBaseUrl: string;
  siteBaseUrl: string;
  cognitoAuthority: string;
  cognitoDomain: string;
  cognitoClientId: string;
  googleMapsKey: string;
  routeBasemapUrl: string; // "" when VITE_ROUTE_BASEMAP_URL is unset
};

export type ConfigResult = { config: Config } | { missing: string[] };
export function loadConfig(env: ImportMetaEnv = import.meta.env): ConfigResult;
```

`main.tsx` calls `loadConfig()` first. A missing or empty variable, or a `VITE_ENV` outside the three values, renders `ConfigError` with the list of names and nothing else; no auth, no fetch. The `Config` reaches components through `ConfigProvider` and `useConfig()`.

### 2.6 TypeScript configuration

`tsconfig.json` is a solution file referencing four projects:

- `tsconfig.routemap.json`: the two route map files copied from santa (`src/routeMap/style.ts`, `src/routeMap/flavors.ts`), `composite` with declarations only into `node_modules/.tmp/routemap`, `strict` without `noUncheckedIndexedAccess` (santa's checks), so the copies stay byte-identical.
- `tsconfig.app.json`: `src` without those two files (it references `tsconfig.routemap.json`), target ES2022, `moduleResolution: bundler`, `jsx: react-jsx`, `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `isolatedModules`, `resolveJsonModule`, `noEmit`, types `vite/client`, `vitest/globals`, `@testing-library/jest-dom`, `google.maps`.
- `tsconfig.node.json`: `vite.config.ts`, `scripts/`, `playwright.config.ts`, types `node`.
- `tsconfig.e2e.json`: `e2e/`, DOM libs, types `node`.

### 2.7 Vitest setup

```ts
// src/setupTests.ts
import "@testing-library/jest-dom/vitest";
import { server } from "./test/msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`src/test/renderWithProviders.tsx` supplies a fake `UserManager` (`makeFakeUserManager`, with `__fire*` hooks for the OIDC events), `makeUser`, a `testConfig`, and `AllProviders` (theme, config, a retry-free `QueryClient`, `MemoryRouter`, `AuthProvider`).

### 2.8 ESLint

`eslint.config.js` (flat config): `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended and `eslint-plugin-react-refresh` on `src/**`, explicit globals for `scripts/**` and `e2e/**`; ignores `dist`, `build`, `node_modules`, `playwright-report`, `test-results`, and `src/api/schema.d.ts`. Unused variables prefixed `_` are allowed.

### 2.9 Vercel

Framework preset Vite, install `npm ci`, build `npm run build`, output `dist`. Client-side routes (`/auth/callback` included) need the rewrite:

```json
// vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Static files under `dist` are served before the rewrite applies. The eight variables in 2.5 are set on the project. Production deploys from `main`.

### 2.10 Vendored contracts

`contracts/` is a byte-identical copy of the API repository's `contracts/` at the commit named in `CONTRACTS_SHA`. `scripts/check-contracts.mjs` fetches that commit's tarball from GitHub (`GITHUB_TOKEN` or `GH_TOKEN` when set, `CONTRACTS_REPO` to override the repository), extracts it, and diffs every file. Updating the contracts is one commit: copy `contracts/`, bump `CONTRACTS_SHA`, regenerate `schema.d.ts`, fix the type errors. `lib/thresholds.ts` re-declares `contracts/admin-thresholds.json` and a test keeps the two in step.

### 2.11 Route map module

`src/routeMap/` holds the route map style builders the poster studio draws with, on `maplibre-gl`, `pmtiles`, and `@protomaps/basemaps`. `style.ts` (`buildStyle`, `tilesUrl`, `glyphsUrl`, `terrainUrl`, `pathBounds`, the source and layer ids, the terrain support: with `terrain` set, a `raster-dem` source over `<base>/terrain.pmtiles` and a hillshade layer under the water fill, and the poster options of its `StyleOptions`: `routeColor` replacing the palette's route colour, `arrows` adding the `route-arrows` symbol layer that repeats the `ROUTE_ARROW_ICON` image along the line, `timeLabels`, a `{ lat, lng, label }` list drawn as dots with their labels, `poiKinds`, the basemap POI kinds whose labels show (absent: no POI layer; empty: none), `landmarks`, a `{ lat, lng, label }` list drawn as dots in the palette's landmark colours with their labels under the time labels, and `details`, whose `landmarks`, `placeNames`, and `roadLabels` set to false drop the basemap layers `DETAIL_LAYERS` names for that group; `makeRouteArrowImage` returns that SDF arrowhead image for the map owner to add) and `flavors.ts` (the light and dark basemap flavors, the route palettes with their landmark dot colours, the hillshade paints, and `POI_COLOURS`, the POI label colours the style adds only for a chosen kind list) are byte-identical copies of the same two files in santa's `src/routeMap/`. Santa holds the canonical copy: a change to the route map style is made in santa first and synced here by copying both files unchanged, never by editing them in this repository; the module's `README.md` states the rule. `index.ts` is the panel's own: `routeBasemapBase(config)` returns `config.routeBasemapUrl` (from `VITE_ROUTE_BASEMAP_URL` through `loadConfig`, section 2.5) or null when unset, and `buildRouteMapStyle(config, appearance, path, marks, terrain, options)` builds the style over it (`terrain` defaults to false, `options` to none), so the tiles resolve at `pmtiles://<base>/tiles.pmtiles` and the glyphs at `<base>/glyphs/{fontstack}/{range}.pbf`; it throws while the variable is unset. `poster.ts` is the panel's own too: the poster presets and sizes, the 5 minute marks, the terrain probe (`probeTerrain(base)` reads the header of `<base>/terrain.pmtiles` once per base per page load, on the first call, and resolves false with one console warning when the archive is missing or fails, the site's lazy probe rule), the offscreen render (which adds the arrowhead image on create through `addRouteArrowImage`, shared with the preview), and the composed poster image (JPEG at quality 0.92: the terrain hillshade makes a print size PNG pass the 20 MB raster limit, while the JPEG stays a few MB and reads the same at 300 dpi) with the attribution chip (6.3, Poster studio). `posterStyle.ts` is the panel's too: the route styling options and their defaults, the time labels (`timeLabelEntries`, `formatWallClock`, `formatElapsed`, `posterTimeLabels`), and `buildPosterStyle(config, { theme, routeMap, terrain, options })`, the one style call the poster preview and the poster export both draw through; it passes the options with `POSTER_LABELS` from `style.ts` (a label scale of 1 on the flat curve), so the poster's time labels and landmark names keep their full sizes (20 px and 14 px, the dots on their own zoom stops) at every zoom. `poster.ts` also holds `toRouteMapData`, which reads a `GET .../route-map` response into numbers for the studio and the event's Route map dialog. `eventRouteMap.ts` is the panel's: an event's `routeMapConfig` as the panel edits it (`toRouteMapConfig`, which keeps only contract values; `withGroup`; `routeMapConfigBody`, null for a config with no group; `readControl` and `withControl`, each control on unless stored as false), the values the site resolves from it (santa's rules: each display key its own default, the arrow and route line sizes as the scales 0.75, 1, 1.5, and 2, the label sizes Small, Medium, and Large as the label scales 0.8, 1, and 1.3, the time labels at the interior multiples of the interval as elapsed time), `routeMapConfigSummary` for the event card, and `eventRouteMapStyle(config, { appearance, routeMap, routeMapConfig, terrain })`, the one style call the Route map dialog's preview draws with: the path with every timeline point as a mark, the time labels, the POI kinds, the arrows and their scale, the route width scale, the label scale (on the site's zoom curve), and the hillshade only while the config keeps the terrain toggle. `posterLayout.ts` is the panel's: the poster layout document saved on a poster as its `layout`, the whole studio design (its types, `toLayoutDocument`, `parsePosterLayout`, `elementPixels` and `placementFromPixels` between fractions and pixels, `snapShift` for the snap guides). `posterOverlay.ts` is the panel's: `renderOverlayCanvas(elements, images, size)` draws the elements on an offscreen `konva` stage 1000 px wide and renders it with `toCanvas` at the print pixel ratio (the poster width over 1000) to a canvas of exactly the poster size. `overlayImage.ts` is the panel's: `loadOverlayImage(url, fallbackAspect)` loads an image with `crossOrigin = "anonymous"`, reads one pixel back through a scratch canvas so an image that would taint the export fails at load with a reason, times out after 30 seconds, and reports the height over width (the fallback for an svg without an intrinsic size); `svgDataUrl` wraps an svg document for it.

---

## 3. Sign-in and authorization

### 3.1 UserManager

```ts
// src/auth/userManager.ts
import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import type { Config } from "../config";

export const SCOPE = "openid email profile aws.cognito.signin.user.admin";   // the last scope is for in-place TOTP enrolment

export function createUserManager(c: Config): UserManager {
  return new UserManager({
    authority: c.cognitoAuthority,
    client_id: c.cognitoClientId,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: "code",
    scope: SCOPE,
    automaticSilentRenew: true,
    accessTokenExpiringNotificationTimeInSeconds: 120,
    monitorSession: false,
    loadUserInfo: false,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });
}
```

The authority's discovery document supplies the hosted UI endpoints (`/oauth2/authorize`, `/oauth2/token`, `/oauth2/revoke` on `<cognito-domain>`). PKCE is on by default for `response_type: "code"`. `monitorSession` is off because Cognito has no session-check iframe. Tokens live in `sessionStorage`: closing the tab ends the session.

### 3.2 Claims

```ts
// src/auth/claims.ts
export const ADMIN_GROUP = "admin";
export const EDITOR_GROUP = "editor";
export const CANVASSER_GROUP = "canvasser";
export type Role = "admin" | "editor" | "canvasser";

export function roleOf(user: User): Role | null {
  const groups = user.profile["cognito:groups"];
  if (!Array.isArray(groups)) return null;
  if (groups.includes(ADMIN_GROUP)) return "admin";
  if (groups.includes(EDITOR_GROUP)) return "editor";
  if (groups.includes(CANVASSER_GROUP)) return "canvasser";
  return null;
}

export function emailOf(user: User): string;
```

`user.profile` is the ID token's claim set. `cognito:groups` is the only authorization input; the panel never asks the API what the caller may do. `lib/roles.ts` holds the three drawer lists (`ADMIN_NAV`, `EDITOR_NAV`, `CANVASSER_NAV`), `navFor(role)`, `canAccess(role, key)`, and `landingFor(role)` (`/` for admin, `/pages` for editor, `/scan` for canvasser). `routesConfig.ts` maps every `NavKey` to its path and label; the layout and the router both read these.

### 3.3 Boot sequence and route guard

`AuthProvider` owns one state value and nothing renders under the layout until it is `member`:

```ts
type AuthState =
  | { kind: "loading" }
  | { kind: "signed_out"; returnTo: string }
  | { kind: "no_role"; email: string }
  | { kind: "mfa_required"; email: string }
  | { kind: "member"; email: string; role: Role };
```

1. `main.tsx`: `loadConfig()`; on `missing`, render `ConfigError` and stop.
2. Create the `UserManager`; render `App` inside `BrowserRouter`. `App` builds the theme and a `QueryClient` (`retry: false`, `staleTime: 0`, `refetchOnWindowFocus: true`), installs the API client and the CDN client (module singletons, section 4.3) with the config, the user manager, and the provider's `requireMfa`, and renders `AppRoutes`.
3. `AuthProvider` on mount: `const user = await userManager.getUser()`.
   - `user === null`: state `signed_out` with `returnTo = location.pathname + location.search`.
   - `user.expired && user.refresh_token`: `await userManager.signinSilent()`; failure sets `signed_out`.
   - Otherwise `evaluate(user)`: `roleOf(user)` gives `member` with that role, else `no_role`.
4. Subscriptions for the life of the app: `addUserLoaded(u => setState(evaluate(u)))` (every renewal re-checks the group), `addUserUnloaded`, `addSilentRenewError`, and `addAccessTokenExpired` all set `signed_out`.
5. Rendering by state (`RequireAdmin`): `loading` shows a centred spinner; `signed_out` shows `SignIn` (title, environment badge, one "Sign in" button calling `userManager.signinRedirect({ state: { returnTo } })`); `no_role` shows `NoRole`; `mfa_required` shows `MfaSetup`; `member` renders `AuthedShell`: `NotifyProvider`, then `MainLayout` as the layout route with one child route per `routesConfig` entry (an entry the role cannot open renders `NotAvailable`, "Not available for your role"; the index route redirects to `landingFor(role)` when the role cannot open the dashboard), the seven detail routes (`events/:id`, `beacons/:id`, `sponsors/:id`, `pages/:id`, `qr-codes/:id`, `places/map`, `places/:id`) with the same guard, and a catch-all redirect to the landing path.

`AppRoutes` mounts `/auth/callback` outside the guard and everything else under `/*` inside `RequireAdmin`, so no page component mounts, and no API call is made, before the group check has passed. The context also exposes `refresh()` (re-evaluate the stored user after TOTP enrolment) and `reset()`.

### 3.4 Callback, tokens, refresh, sign-out

`/auth/callback`:

```ts
const user = await userManager.signinCallback();
const returnTo = (user?.state as { returnTo?: string } | undefined)?.returnTo ?? "/";
navigate(returnTo, { replace: true });
```

An exception (state missing because the tab is not the one that started, code already used, network) renders "Sign-in failed" with the error message and a "Try again" button that calls `signinRedirect()`.

Token per request: the API client reads the ID token before every call.

```ts
export async function idToken(): Promise<string> {
  let user = await userManager.getUser();
  if (!user || user.expired) user = await userManager.signinSilent();   // throws when the refresh token is gone
  if (!user?.id_token) throw new AuthRequired();
  return user.id_token;
}
```

Renewal: `automaticSilentRenew` runs `signinSilent()` two minutes before expiry using the refresh token (Cognito issues one on the code grant and answers the `refresh_token` grant with a new ID and access token). ID and access tokens both live 60 minutes, so `user.expired` tracks the ID token. The `wmsfo-admin` refresh token lives one day; when it lapses the renew fails, state becomes `signed_out`, and the next sign-in goes through the hosted UI with TOTP again.

`401 unauthenticated` from the API: the client calls `signinSilent()` once and retries the request once; a second `401` or a renew failure throws `AuthRequired`. The auth state moves to `signed_out` through the `UserManager` events (a failed silent renew fires `silentRenewError`); the panel has no query-level error handler for `AuthRequired`.

Sign-out:

```ts
// src/auth/signOut.ts
export async function signOut(um: UserManager, c: Config): Promise<void> {
  await um.revokeTokens(["refresh_token"]).catch(() => undefined);
  await um.removeUser();
  const url = new URL(`${c.cognitoDomain}/logout`);
  url.searchParams.set("client_id", c.cognitoClientId);
  url.searchParams.set("logout_uri", `${window.location.origin}/`);
  window.location.assign(url.toString());
}
```

`logout_uri` is the registered sign-out URL for the current origin. Cognito returns to `/`, which renders `SignIn`; there is no automatic redirect back into the hosted UI.

### 3.5 MFA

The admin pool's MFA setting is optional with TOTP; every member of `admin`, `editor`, or `canvasser` has TOTP enabled on their user, and the API enforces it by answering `403 mfa_required` after `AdminGetUser` on the admin pool. The panel's part:

- Any response with `code: "mfa_required"` calls the provider's `requireMfa()`, which sets state `mfa_required`; the layout is replaced by `MfaSetup` until the next sign-in or a successful `refresh()`.
- `MfaSetup` shows who is signed in, why the panel is blocked (TOTP is not enabled on this account), and a sign-out button.
- `MfaSetup` enrols the authenticator in place through the Cognito IdP service endpoint (`new URL(config.cognitoAuthority).origin`), using the access token:

```ts
// src/auth/mfa.ts
async function idp<T>(config: Config, target: IdPTarget, body: unknown): Promise<T> {
  const res = await fetch(`${new URL(config.cognitoAuthority).origin}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? `IdP ${res.status}`);
  return res.json() as Promise<T>;
}

export const associate = (config: Config, accessToken: string) =>
  idp<{ SecretCode: string }>(config, "AssociateSoftwareToken", { AccessToken: accessToken });
export const verify = (config: Config, accessToken: string, code: string) =>
  idp<{ Status: "SUCCESS" | "ERROR" }>(config, "VerifySoftwareToken", { AccessToken: accessToken, UserCode: code, FriendlyDeviceName: "WMSFO admin" });
export const prefer = (config: Config, accessToken: string) =>
  idp<Record<string, never>>(config, "SetUserMFAPreference", { AccessToken: accessToken, SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true } });
export function otpauthUri(secret: string, email: string): string;   // otpauth://totp/WMSFO%20Admin:<email>?secret=<secret>&issuer=WMSFO%20Admin
```

  Flow: "Start enrolment" calls `associate`, which returns `SecretCode`; the page renders the otpauth URI as a QR (`qrcode.toDataURL`) and as a read-only text field; the admin enters the six-digit code; `verify` must answer `SUCCESS`; `prefer` turns TOTP on; the page then says MFA is enabled and offers Continue, which calls `refresh()` and opens the panel (the API admits an enrolled admin on the next request); the next sign-in asks for a code. Sign-out stays available throughout. These three calls need the access token to carry scope `aws.cognito.signin.user.admin`.

### 3.6 No-role page

State `no_role` renders "This account has no role" with the signed-in email and a sign-out button. Nothing else is reachable. A `403 forbidden` from any `/admin/*` call renders as an alert ("Not available for your role") with the request id; the layout stays.

---

## 4. API client

### 4.1 Generated types

`npm run gen:api-types` runs `openapi-typescript` over the vendored `contracts/openapi.json` into `src/api/schema.d.ts` (committed; CI fails on drift, section 10). `src/api/types.ts` names the shapes the pages use, each an alias of a generated `*Dto` component so a contract change is a type error:

```ts
import type { components } from "./schema";
type S = components["schemas"];

export type Event = S["EventDto"];
export type EventMessage = S["EventMessageDto"];
export type StatusHistory = S["StatusHistoryDto"];
export type Route = S["RouteDto"];
export type Beacon = S["BeaconDto"];
export type Enrollment = S["EnrollmentDto"];
export type BeaconLog = S["BeaconLogDto"];
export type Sponsor = S["SponsorDto"];
export type SponsorYear = S["SponsorYearDto"];
export type SponsorOrderRow = S["SponsorOrderRow"];
export type ApiKey = S["ApiKeyDto"];
export type ApiKeyMinted = S["ApiKeyMintedDto"];
export type ApiKeyCapability = "events" | "routes" | "beacons" | "sponsors" | "cookie_types" | "pages" | "sections" | "site_settings" | "content" | "media" | "icons" | "settings" | "contact_messages" | "subscribers" | "people" | "diagnostics" | "audit";
export type CookieType = S["CookieTypeDto"];
export type Subscription = S["SubscriptionDto"];
export type SubscriberAdmin = S["SubscriberAdminDto"];
export type Person = S["PersonDto"];
export type ContactMessage = S["ContactMessageDto"];
export type Setting = S["SettingDto"];
export type SnapshotInfo = S["SnapshotInfoDto"];
export type LocationRow = S["LocationRowDto"];
export type PageAdmin = S["PageAdminDto"];
export type PageDetail = S["PageDetailDto"];
export type SectionAdmin = S["SectionAdminDto"];
export type SectionItemAdmin = S["SectionItemAdminDto"];
export type SiteSettingsDraft = S["SiteSettingsDraftDto"];
export type KindInfo = S["KindInfoDto"];
export type IconInfo = S["IconInfoDto"];
export type MediaAsset = S["MediaAssetDto"];
export type UploadTicket = S["UploadTicketDto"];
export type MediaUsage = S["MediaUsageDto"];
export type ContentVersionInfo = S["ContentVersionInfoDto"];
export type ContentStatus = S["ContentStatusDto"];
export type ContentBundle = S["ContentBundleDto"];
export type PreviewToken = S["PreviewTokenDto"];
export type Problem = S["ProblemDto"];
export type ProblemRef = S["ProblemRefDto"];
export type Icon = S["IconValue"];
export type MediaRef = { mediaId: string; alt: string | null };
export type Presentation = S["PresentationDto"];
export type AuditStamp = S["AuditStampDto"];
export type AuditEntry = S["AuditEntryDto"];
export type Page<T> = { items: T[]; nextCursor: string | null };
export type StatusId = 1 | 2 | 3 | 4 | 5 | 6;
```

Shapes declared by hand from the contracts, because they are CDN objects, heartbeat bodies, or endpoints the vendored `openapi.json` does not describe: `LiveObject`, `Heartbeat` (`sentAt`, a `health` core of `batteryPercent`, `lastFixAgeS`, `socketState`, and a free `debug` object), `LiveState` (the `/admin/live` answer with the node's in-memory copy), and the QR and places family (`QrCode`, `QrCodeDetail` with `history` and `daily`, `Place` with `location`, `pin`, `codes`, `scans`, `PlacePin`, `Opens`). A test checks the live object, snapshot, and heartbeat fixtures against the hand-declared types.

`debug` is whatever the beacon sent; the beacon page renders it as a JSON tree in the panel's theme (`ThemedJsonView`) and reads nothing out of it.

### 4.2 Errors

```ts
// src/api/errors.ts
export type ErrorBody = { code: string; message: string; details: Record<string, unknown> | null; requestId: string };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: ErrorBody | null);
  get code(): string;                       // body.code, "method_not_allowed" for a bodiless 405, else "unknown"
  get requestId(): string | null;
  get fields(): Record<string, string>;     // details.fields, string values only
  get retryAfterSeconds(): number | null;   // details.retryAfterSeconds
}
export class NetworkError extends Error {}   // fetch itself threw
export class AuthRequired extends Error {}   // no usable ID token
export class CdnError extends Error { constructor(public readonly status: number) }
```

### 4.3 Request wrapper

```ts
// src/api/client.ts
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Query = Record<string, string | number | boolean | undefined>;
type Req = { method: Method; path: string; query?: Query; json?: unknown; form?: FormData; accept?: string; parse?: "json" | "text" | "blob" | "none" };

export function installClient(d: { config: Config; userManager: UserManager; onMfaRequired: () => void }): void;

export async function request<T>(req: Req): Promise<T> {
  const url = new URL(config.apiBaseUrl + req.path);
  for (const [k, v] of Object.entries(req.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  const send = (token: string) => fetch(url, {
    method: req.method,
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(req.json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(req.accept ? { Accept: req.accept } : {}),
    },
    body: req.json !== undefined ? JSON.stringify(req.json) : req.form,
  });

  let res: Response;
  try {
    res = await send(await idToken());
    if (res.status === 401) {
      const renewed = await userManager.signinSilent().catch(() => null);
      if (!renewed?.id_token) throw new AuthRequired();
      res = await send(renewed.id_token);
      if (res.status === 401) throw new AuthRequired();
    }
  } catch (e) {
    if (e instanceof TypeError) throw new NetworkError(e.message);
    throw e;
  }

  if (!res.ok) {
    const body = res.status === 405 ? null : await res.json().catch(() => null);
    const err = new ApiError(res.status, body);
    if (err.code === "mfa_required") onMfaRequired();
    throw err;
  }
  switch (req.parse ?? "json") {
    case "none": return undefined as T;
    case "text": return (await res.text()) as T;
    case "blob": return (await res.blob()) as T;
    default: return (res.status === 204 ? undefined : await res.json()) as T;
  }
}

export const get = <T>(path: string, query?: Query) => request<T>({ method: "GET", path, query });
export const post = <T>(path: string, json?: unknown) => request<T>({ method: "POST", path, json });
export const patch = <T>(path: string, json: unknown) => request<T>({ method: "PATCH", path, json });
export const put = <T>(path: string, json: unknown) => request<T>({ method: "PUT", path, json });
export const putForm = <T>(path: string, form: FormData) => request<T>({ method: "PUT", path, form });
export const del = (path: string) => request<void>({ method: "DELETE", path, parse: "none" });
```

The client is a module singleton installed once by `App`; `installCdn({ cdnBaseUrl })` does the same for the CDN read. `FormData` bodies carry no explicit `Content-Type`; the browser sets the multipart boundary.

### 4.4 Resource modules

One module per resource under `src/api/resources/`, re-exported from `index.ts`. Every path is bare and appended to `VITE_API_BASE_URL`. Bodies are typed objects built by the forms; unknown fields cannot be sent.

```ts
// events.ts
export type CreateEventBody = { year: number; name: string; scheduledAt: string | null; fundsPercent: number; routeId: number | null; inheritRoute: boolean };
export type PatchEventBody = Partial<{ name: string; year: number; scheduledAt: string | null; wentLiveAt: string | null; endedAt: string | null; fundsPercent: number; routeId: number | null }>;
export type CloneEventBody = { year: number; name: string; copy: { sponsors: boolean; route: boolean; poster: boolean; routeMapConfig: boolean } };
export type StatusBody = { statusId: StatusId; notify: boolean; message: string | null };
export type NotifyBody = { message: string | null };
export type MessageBody = { body: string; notify: boolean };   // patchMessage sends Pick<MessageBody, "body">
export type LocationsQuery = { cursor?: string; limit?: number; beaconId?: number; publishedOnly?: boolean };

export const events = {
  list, get, create, patch, remove, setCurrent, clone,
  setStatus: (id, b: StatusBody) => post<Event>(`/admin/events/${id}/status`, b),
  notify: (id, b: NotifyBody) => post<Event>(`/admin/events/${id}/notify`, b),
  statusHistory, messages, postMessage, patchMessage, deleteMessage,
  locations: (id, q: LocationsQuery) => get<Page<LocationRow>>(`/admin/events/${id}/locations`, q),
  locationsCsv: (id, q) => request<Blob>({ method: "GET", path: `/admin/events/${id}/locations`, query: q, accept: "text/csv", parse: "blob" }),
};

// routes.ts
export type RoutePoint = { lat: number; lng: number; recordedAt: string | null };
export type RouteUploadBody = { name: string; points: RoutePoint[] };
export const routes = { list, get, create, fromEvent: (eventId, b: { name: string }) => post<Route>(`/admin/routes/from-event/${eventId}`, b), remove,
  routeMap: (id) => get<RouteMapResponse>(`/admin/routes/${id}/route-map`) };

// posters.ts
export type CreatePosterBody = { name: string; routeId?: number | null; layout?: object | null };
export type PatchPosterBody = Partial<{ name: string; routeId: number | null; layout: object | null }>;
export const posters = { list, get, create: (b: CreatePosterBody) => post<Poster>("/admin/posters", b), patch, remove };

// beacons.ts
export type BeaconsResponse = { items: Beacon[]; staleAfterS: number };
export type KeyMint = { beacon: Beacon; key: string; enrollment: Enrollment };
export const beacons = { list, get, create: (b: { name: string; notes: string }) => post<KeyMint>(...), patch, activate, deactivate, rotate: (id) => post<KeyMint>(...), revoke, logs, logText: (id, logId) => request<string>({ ..., parse: "text" }) };

// sponsors.ts
export type SponsorBody = { name: string } & Partial<Record<"contactPerson" | "email" | "phone" | "address" | "websiteUrl" | "fbUrl" | "igUrl" | "logoMediaId", string | null>>;
export type SponsorYearBody = { amountDonated: number | null; active: boolean; canAdvertise: boolean; anonymous: boolean; pinnedPosition: number | null; lingerMsOverride: number | null };
export type SponsorImportResult = { created: number; skipped: number };
export const sponsors = { list, get, create, patch, remove, putYear, deleteYear,
  copyYearFrom: (id, targetYear, sourceYear) => post<SponsorYear>(`/admin/sponsors/${id}/years/${targetYear}/copy-from/${sourceYear}`),
  importFromYear: (fromYear, toYear, sponsorIds) => post<SponsorImportResult>("/admin/sponsors/import", { fromYear, toYear, sponsorIds }),
  order: (eventYear) => get<{ items: SponsorOrderRow[] }>(`/admin/sponsors/order/${eventYear}`),
  putOrder: (eventYear, pinnedSponsorIds) => put(`/admin/sponsors/order/${eventYear}`, { pinnedSponsorIds }) };

// cookieTypes.ts
export type CookieTypeBody = { name: string; sort: number; active: boolean; icon: Icon | null };
export const cookieTypes = { list, create, patch, remove };

// settings.ts, subscribers.ts, people.ts, contactMessages.ts, snapshot.ts, live.ts, icons.ts
export const settings = { list, put: (key, value: number) => put<Setting>(`/admin/settings/${key}`, { value }) };
export type SubscriberStatus = "verified" | "pending" | "unsubscribed";
export const subscribers = { summary, list: (q: { cursor?, limit?, status? }) => get<Page<SubscriberAdmin>>(...), remove };
export const people = { list: (q) => get<Page<Person & { cookieCount: number }>>(...), remove };
export const contactMessages = { list: (q) => get<Page<ContactMessage>>(...), remove };
export const snapshot = { get, rebuild };
export const live = { get: () => get<LiveState>("/admin/live"), republish: () => post<LiveObject>("/admin/live/republish") };
export const icons = { list: () => get<{ items: IconInfo[] }>("/admin/icons") };

// pages.ts, sections.ts
export type PageBody = { slug: string; title: string; navLabel: string | null; icon?: Icon | null; navPosition?: number; isHidden?: boolean };
export const pages = { list, get, create, patch, remove: (id, roleTo?: number | null) => del(roleTo == null ? `/admin/pages/${id}` : `/admin/pages/${id}?roleTo=${roleTo}`), order: (ids) => put("/admin/pages/order", { ids }) };
export type SectionBody = { kind: string; position?: number; data?: object; presentation?: Presentation };
export const sections = { create, patch: (id, b: Partial<{ data: object; presentation: Presentation; isHidden: boolean }>), remove, duplicate, move: (id, b: { pageId; position }), order, createItem, patchItem, removeItem, orderItems };

// siteSettings.ts, content.ts
export const siteSettings = { get, put: (data: object) => put("/admin/site-settings", { data }) };
export const content = { kinds, status, draft, publish: (label: string | null), versions, version: (id) => get<ContentVersionInfo & { document: object }>(...), restore, previewToken };

// media.ts, upload.ts
export type MediaQuery = { cursor?: string; limit?: number; kind?: "raster" | "svg" | "gif"; state?: "pending" | "ready" | "orphaned"; q?: string };
export const media = { list, get, usage, uploadUrl: (b: { filename; contentType; sizeBytes; alt; title }) => post<UploadTicket>(...), confirm, patch: (id, b: Partial<{ alt; title; credit }>), remove };
export function uploadToS3(ticket: UploadTicket, file: File, onProgress: (fraction: number) => void): Promise<void>;
// XMLHttpRequest PUT to ticket.uploadUrl with exactly ticket.headers and the file as the body (progress events need XHR);
// no Authorization header, no credentials; any non-2xx rejects with UploadFailed(status).

// apiKeys.ts, audit.ts
export type ApiKeyCreateBody = { name: string; allCapabilities: boolean; capabilities: ApiKeyCapability[]; expiresAt: string | null };
export const apiKeys = { list, create: (b) => post<ApiKeyMinted>(...), revoke };
export const AUDIT_ACTIONS = ["create", "update", "delete", "activate", "deactivate", "revoke", "rotate", "publish", "restore", "reorder", "duplicate", "move", "hide", "unhide"] as const;
export type AuditQuery = { entity?: string; entityId?: string; action?: string; actor?: string; cursor?: string; limit?: number };
export const audit = { list: (q) => get<Page<AuditEntry>>("/admin/audit", q), entities: () => get<{ items: string[] }>("/admin/audit/entities") };

// qr.ts, places.ts
export type QrPatchBody = Partial<{ opensPageId: number | null; forwardUrl: string | null; note: string; active: boolean }>;
export const qr = { list, get, generate: (b: { count }) => post<{ items: QrCode[] }>("/admin/qr-codes", b), patch, attach: (id, b: { placeId }), detach, remove };
export type PlaceLocationBody = { lat: number; lng: number; accuracyM: number | null; source: "phone" | "search" | "drag" };
export type PlaceMapQuery = { eventId?: number; from?: string; to?: string };
export const places = { list, create, patch, remove, putLocation, deleteLocation: (id) => request<Place>({ method: "DELETE", path: `/admin/places/${id}/location` }), map: (q) => get<{ items: PlacePin[]; unpinned: number; unattached: number }>("/admin/places/map", q) };
```

`src/api/impact.ts` is the delete-impact reader used by `DeleteDialog`: `impact.get(resource, id)` calls `GET /admin/<resource>/{id}/impact` for `events`, `routes`, `sponsors`, `cookie-types`, `pages`, `media`, `places`, `qr-codes`, `beacons`, `api-keys`, `subscribers`, `people`, `contact-messages`, `posters` and returns `{ blocked: string | null; deletes: ImpactGroup[]; unlinks: ImpactGroup[]; warnings: string[] }` where a group is `{ entity, count, names }`.

### 4.5 CDN read

```ts
// src/api/cdn.ts
export async function fetchLiveObject(): Promise<LiveObject> {
  const res = await fetch(`${cdnBaseUrl}/live/location.json`, { credentials: "omit", cache: "no-store" });
  if (!res.ok) throw new CdnError(res.status);
  return (await res.json()) as LiveObject;
}
```

No custom headers, so the request needs no preflight; the CDN answers CORS for every origin. Unknown fields are tolerated. A `schemaVersion` other than `1` renders the raw object with a banner "unknown schemaVersion" instead of the field grid.

### 4.6 Queries, polling, and writes

```ts
// src/queries/keys.ts
export const keys = {
  events, event(id), eventHistory(id), eventMessages(id), eventLocations(id, q),
  routes, routeMap(id), posters, poster(id), beacons, beaconLogs(id),
  sponsors, sponsor(id), cookieTypes, settings,
  subscribersSummary, subscribers(status), people, contactMessages,
  snapshot, live, cdnLive,
  pages, page(id), kinds, icons, contentStatus, versions, siteSettings,
  media(q), mediaOne(id), mediaUsage(id),
  apiKeys, audit(q), auditEntities, qrCodes, qrCode(id), places,
};
// Ad hoc keys: ["impact", resource, id] (DeleteDialog), ["sponsors", "order", year], ["places", "map", q], ["content", "version", id].

// src/queries/polling.ts
export const POLL_MS = 5000;
export const polled = { refetchInterval: POLL_MS, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
```

`QueryClient` defaults: `staleTime: 0`, `retry: false` for queries and mutations, `refetchOnWindowFocus: true`. With `refetchIntervalInBackground: false` the interval pauses while the document is hidden, and `refetchOnWindowFocus` fires an immediate fetch on `visibilitychange` to visible. That is the contracts' data loop: poll while visible, stop while hidden, fetch immediately on return.

| View | On entry | Polled at `POLL_MS` | After a write |
|---|---|---|---|
| Dashboard | `keys.events`, `keys.live`, `keys.cdnLive`, `keys.snapshot`, `keys.beacons`, `keys.cookieTypes` | `keys.live`, `keys.cdnLive`, `keys.beacons` | invalidate the first five |
| Beacons list and beacon detail | `keys.beacons`, `keys.events` | `keys.beacons` | invalidate `keys.beacons` |
| Event detail | `keys.event(id)`, `keys.events`, `keys.eventHistory(id)`, `keys.eventMessages(id)`, `keys.beacons`, `keys.subscribersSummary` | `keys.eventHistory(id)` and `keys.eventMessages(id)` at 3 seconds each, only while that list's newest row is notifying, under ten minutes old, and has a `sentCount` below the verified count (6.3) | invalidate the event, its history, and its messages |
| Layout (`MainLayout`, admin and editor only) | `keys.contentStatus` | `keys.contentStatus` at 30 seconds (`refetchInterval: 30_000`, `refetchIntervalInBackground: false`), refetched on focus by the client defaults | none of its own; the page editor, pages list, site settings, and publish writes (the Publish page, the bar's Publish button, and the versions list's restores) invalidate `keys.contentStatus` |
| Page editor | `keys.page(id)`, `keys.pages`, `keys.kinds` | none | invalidate `keys.page(id)` (and `keys.pages` after a page or move write) and `keys.contentStatus` |
| Pages list | `keys.pages` | none | invalidate `keys.pages` and `keys.contentStatus` |
| Every other view | its list key | none | invalidate the list; settings and sponsor detail also `setQueryData` with the returned row |

`keys.icons` is fetched with `staleTime: Infinity` by the cookie types page and its icon picker. Nothing else overrides the defaults. Paged lists (`Page<T>`: subscribers, people, contact messages, media, audit) use `useInfiniteQuery` with `getNextPageParam: (last) => last.nextCursor ?? undefined` and a "Load more" button; `limit` is 50.

---

## 5. Observing the live state

### 5.1 Published-state comparison

```ts
// src/lib/publishedState.ts
export type Mismatch = { field: "eventStatusId" | "snapshotUrl" | "publishedAt"; cdn: unknown; api: unknown };
export type SampledAt = { cdn: number; api: number };   // dataUpdatedAt of the CDN poll and the /admin/live poll (browser clock)
export const CDN_LAG_TOLERANCE_MS = 3000;

export function compare(cdn: LiveObject, current: Event | null, snap: SnapshotInfo, state: LiveState, sampledAt: SampledAt): Mismatch[] {
  const out: Mismatch[] = [];
  const apiStatus = current?.statusId ?? null;
  if (cdn.eventStatusId !== apiStatus) out.push({ field: "eventStatusId", cdn: cdn.eventStatusId, api: apiStatus });
  if (cdn.snapshotUrl !== snap.url) out.push({ field: "snapshotUrl", cdn: cdn.snapshotUrl, api: snap.url });
  if (cdnLagMs(cdn, state, sampledAt) > CDN_LAG_TOLERANCE_MS) out.push({ field: "publishedAt", cdn: cdn.publishedAt, api: state.lastWriteAt });
  return out;
}

// (age of the CDN object when it was fetched) - (age of the row's last write when it was fetched)
export function cdnLagMs(cdn: LiveObject, state: LiveState, sampledAt: SampledAt): number;

export type PublishedState =
  | { kind: "loading" }
  | { kind: "cdn_unreachable"; status: number | null; error?: string | null }
  | { kind: "ok" }
  | { kind: "behind"; mismatches: Mismatch[] }
  | { kind: "write_error"; error: string };

export function resolvePublishedState(input: ResolveInput): { state: PublishedState; mismatchedNow: boolean };
```

Freshness, not equality. The CDN poll and the `/admin/live` poll run on independent 5 s timers, so the two samples can be seconds apart, and while a beacon streams the ingest node writes the live object several times a second: `cdn.seq` and `lastWriteSeq` are equal only when both samples happen to land inside the same write interval, whatever the fix rate. The comparison therefore asks whether the CDN copy is older than the API's last write by more than propagation accounts for. `cdnLagMs` pairs each server stamp with the browser instant its sample arrived (`dataUpdatedAt`), so the browser's clock offset cancels and the skew between the two polls is factored out: a healthy CDN measures near 0 ms however often the API writes (negative when the CDN sample is the newer one), and a stale copy measures its true age. `CDN_LAG_TOLERANCE_MS` (3 s) covers CloudFront's `s-maxage=1` and the writer's PUT-then-row-update ordering. A row that has never recorded a write compares as 0 (nothing to be behind); a CDN object without a parsable `publishedAt` compares as infinitely behind. The rule catches a stale copy whether or not `seq` moved (an admin rewrite with no new fix changes `publishedAt` only).

The card keeps `previousMismatched: boolean` across polls in a ref. `resolvePublishedState` renders `behind` only when the current poll and the previous poll both produced a non-empty `compare()` result; a single mismatched poll renders `ok` (an admin write lands on the CDN within a second of the row, and the two polls may straddle it). A poll with no mismatch resets the flag. `state.lastWriteError !== null` renders `write_error` regardless of the comparison. A `CdnError` (with its HTTP status) or a network failure (with its message) on the CDN fetch renders `cdn_unreachable` and does not touch the flag; a CDN query that has never settled renders `loading`. `current` is the event with `isCurrent === true` from the events list.

Rendering: `ok` green "CDN current, written <age> ago by <lastWriteNode>"; `behind` red "CDN behind" with the mismatch list (a `publishedAt` mismatch renders both sides as wall-clock times); `write_error` red with the error text; `cdn_unreachable` amber with the status or the message. The card's Republish button (always present, confirmed by `ConfirmDialog`) calls `POST /admin/live/republish` and invalidates the dashboard keys.

### 5.2 Beacon flags

```json
// contracts/admin-thresholds.json (vendored from the API repository)
{ "batteryLowPercent": 20, "noFixAgeS": 30, "noLocationAgeS": 30 }
```

```ts
// src/lib/beaconFlags.ts
export type BeaconFlag = "battery_low" | "no_recent_fix" | "socket_down" | "stale" | "heartbeat_old";

export function beaconFlags(b: Beacon, staleAfterS: number, anyEventLive: boolean, nowMs: number, t = thresholds): BeaconFlag[] {
  if (b.revokedAt != null) return [];
  const f: BeaconFlag[] = [];
  const h = (b.telemetry as Heartbeat | null)?.health ?? null;
  const battery = h?.batteryPercent ?? null;
  if (battery !== null && battery < t.batteryLowPercent) f.push("battery_low");
  const fixAge = h?.lastFixAgeS ?? null;
  const locAge = ageS(b.lastLocationAt, nowMs);
  if ((fixAge !== null && fixAge > t.noFixAgeS) || (anyEventLive && locAge !== null && locAge > t.noLocationAgeS)) f.push("no_recent_fix");
  const hub = b.hubConnected ?? null;
  if (hub === false || (hub === null && (h?.socketState ?? null) !== "connected")) {
    if (b.hubAllowed !== false) f.push("socket_down");   // a beacon with the hub switched off is on HTTP by design
  }
  if (b.staleSince != null) f.push("stale");
  const hbAge = ageS(b.lastHeartbeatAt, nowMs);
  if (hbAge !== null && hbAge > staleAfterS) f.push("heartbeat_old");
  return f;
}
export const FLAG_LABEL: Record<BeaconFlag, string>;   // "Battery low", "No recent fix", "Socket down", "Stale", "Heartbeat old"
```

`anyEventLive` is `events.some(e => e.statusId === 3)` from the events list the page fetches on entry. `staleAfterS` comes from the beacons response (60 while it is loading). Each flag renders as a red `FlagChip` on the row and on the beacon page header, and colours the underlying value red on the beacon page (`heartbeat_old` and `stale` in the Ages card; `battery_low`, `no_recent_fix`, `socket_down` in the Health block). Nothing else is coloured, and nothing inside `debug` is ever read. A shared `useNow()` hook ticks once a second so ages and flags move without a fetch. `Beacon.healthy` from the API is what the go-live gate uses (6.3); the flags are advisory colour.

---

## 6. Pages

### 6.1 Layout, navigation, environment badge

`MainLayout`: a fixed `AppBar` (the title, `EnvBadge`, the Publish button described below, the signed-in email hidden below `md`, a theme toggle, a sign-out button), a permanent `Drawer` at 220 px on `md` and up and a temporary drawer below (opened from a menu button in the bar, paper `width: min(280px, 85vw)` with a header row of the title, the `EnvBadge`, and a `Close navigation` icon button, and a scrolling `List` under the divider), and the page content in a `flexGrow: 1, minWidth: 0, overflowX: hidden` column under a `Toolbar` spacer with `p: 2`. The `AppBar` keeps `zIndex.drawer + 1` only at `md` and above, so on compact the temporary drawer renders over the bar. The drawer is one flat `List` of `ListItemButton`s, no groups and no icons, in the order `navFor(role)` returns; the entry whose path equals the current pathname is selected. The theme is `createTheme({ palette: { mode } })` with darker `background` values in dark mode, stored under `localStorage` key `appThemeMode`, light by default.

The compact vocabulary is the MUI `md` cut-off (below 900 px), read through the `useCompact` hook in `src/hooks/useCompact.ts`. `PageHeader` (`src/components/layout/PageHeader.tsx`) shows the title (`h4` on desktop, `h5` on compact) with any chips beside it and the actions on the right on desktop; on compact the actions wrap to their own row full width so a phone can still reach every button (the events page's "New event" is the driving example). Every page header row in `src/pages` uses `PageHeader`. `AppDialog` (`src/components/AppDialog.tsx`) is the wrapper the whole panel opens dialogs through: it forwards every prop to MUI `Dialog` and sets `fullScreen` when the viewport is below `sm` (600 px) unless the caller passes `fullScreen` in itself; the actions bar stays at the bottom and the content scrolls. `KeyRevealDialog` keeps its no-escape and no-backdrop rules through the same wrapper.

**On a phone, lists are cards.** `ResponsiveTable` (`src/components/list/ResponsiveTable.tsx`) is the one component every list page adopts: on desktop (not compact) it renders the same `TableContainer component={Paper}` with `Table size="small"` the pages render today (a head row with every column's header, honouring `align`; the `leading` cell first when given, then the columns, then the Actions cell holding `actions(row)` when given, then the `AuditCell` when `audit` is given; every row carries `data-testid={rowTestId(row)}` and `hover`; the empty state is one row spanning every column with `emptyText`), so its output on desktop is byte-for-byte the same markup the page rendered before adoption. On compact it renders a `Stack spacing={1}` of outlined `Card`s instead, one per row, each carrying the same `data-testid` on the card root: the `title` column's value as `subtitle1` with the `leading` node before it, the `subtitle` column as `body2` secondary text under it, the `chip` columns in a wrapped row of chips, then every `line` column as "label: value" lines (`label` falls back to the header text) in the column order, `desktop-only` columns omitted (a column may carry `renderCompact` for the card, used where the table cell shows a placeholder such as "none" that has no place on a card; a chip column that renders null on compact is skipped), and a footer row with `actions(row)` on the left and the audit icon button on the right; the empty state is the `emptyText` in secondary text. `AuditCell` carries an `asCell?: boolean` prop (default true): when false it renders a plain `IconButton` for the card footer. The same `aria-label`s (`Edit <name>`, `Actions for <name>`, `Audit <name>`) appear in both layouts, so the existing specs keep working. `useInfiniteQuery` pages keep their "Load more" button outside the component. A column is `{ key: string; header: ReactNode; render: (row: T) => ReactNode; align?: "left" | "right"; role?: "title" | "subtitle" | "chip" | "line" | "desktop-only"; label?: string; renderCompact?: (row: T) => ReactNode }` and the props are `{ rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; rowTestId?: (row: T) => string; rowSx?: (row: T) => SxProps; actions?: (row: T) => ReactNode; audit?: (row: T) => { entity: string; entityId: string | number; name: string; audit: AuditStamp | null | undefined }; emptyText: string; leading?: (row: T) => ReactNode; size?: "small" | "medium" }`. The events page adopts it (6.3).

Drawer entries for `admin`: Dashboard, Events, Flight recordings, Beacons, QR codes, Places, Scan, Pages, Media, Poster studio, Site settings, Publish, Sponsors, Sponsor order, Cookie types, Subscribers, People, Contact messages, Settings, API keys, Agents, Audit. For `editor`: Pages, Media, Site settings, Publish, Sponsors, Sponsor order, QR codes, Places, Scan, Audit. For `canvasser`: QR codes, Places, Scan. The Poster studio is an `admin` entry only: its recording picker reads `GET /admin/routes`, which the API holds to the Admin policy. There is no cookie view: the tally on the dashboard's live object is all the panel shows about cookies.

**The Publish button in the bar.** `PublishBarButton` (`src/components/layout/PublishBarButton.tsx`) sits between the `EnvBadge` and the email. `MainLayout` renders it only when `navFor(role).includes("publish")`, that is for `admin` and `editor`; a `canvasser` never sees it and never queries the status. It reads `keys.contentStatus` polled every 30 seconds while the tab is visible (4.6) and renders nothing while the status is loading, failed, or `hasUnpublishedChanges` is false, so it shows only while the draft has unpublished changes. On desktop it is a contained "Publish" button, on compact a 44 px `IconButton` with a publish icon and `aria-label="Publish"`; both carry `data-testid="bar-publish"`. With no problems a click opens the same `PublishLabelDialog` the Publish page uses (6.18) and confirming publishes through the shared `usePublishMutation` from any page: success toasts "Published version <id>" and refreshes the status (the button then disappears), `409 content_unchanged` toasts "Nothing to publish", and `422 content_invalid` toasts "The draft has publish problems" and opens `/publish`. With problems the same button carries an MUI `Badge` in the warning colour with the problem count and a click opens `/publish` instead of the dialog.

`EnvBadge`: an MUI `Chip` with `config.env.toUpperCase()`; colour `error` for `prod`, `success` for `dev`, `info` for `local`; tooltip shows `config.apiBaseUrl`. On `dev` and `local` the document title is prefixed `[DEV]` or `[LOCAL]`. The badge also appears on `SignIn`, `NoRole`, and `MfaSetup`.

`NetworkBanner` renders "API unreachable" under the bar when `MainLayout` receives `networkDown`; no page passes it, so the banner never shows. `NetworkError` surfaces through `ErrorAlert` on the page that made the call.

### 6.2 Dashboard

Six cards in a `Grid` (two halves, one full width, three halves); the grid already stacks at `xs` so the cards flow top-down on a phone. Every `LabeledLine` value wraps under its label on compact when the value is a URL or a key (`flexWrap` on the row and `overflowWrap: "anywhere"` on the value), so the snapshot `s3Key` and both `snapshotUrl` links break anywhere and never push the card wider than the viewport. The two `ThemedJsonView` blocks on compact start collapsed to one level (`collapsed={1}`) and scroll horizontally inside their box. The Change status menu button and the Open event link wrap in the Current event card actions; the Republish and Rebuild snapshot buttons stay as one small button per card.

1. **Current event.** From `keys.events`: the event with `isCurrent`. Shows name and year, `StatusChip` (1 Planned, 2 Scheduled, 3 Live, 4 Ended, 5 Cancelled, 6 Postponed, the last an outlined warning chip), `scheduledAt`, `wentLiveAt`, `endedAt` (in the viewer's zone, section 7.5), `fundsPercent`, the route as `#<routeId>` or "no route", a "Change status" menu with one entry per other status (Postponed included, never gated) that opens the same `StatusDialog` as the event page (6.3), and an "Open event" link. "No current event" with a link to Events when none is flagged.
2. **Active beacon.** From `keys.beacons`: the beacon with `isActive`. Name, a Healthy or Unhealthy chip from `healthy`, `keyPrefix`, heartbeat age, last location age, `staleSince`, `staleAfterS`, and an "Open beacon" link. "No active beacon" in red when an event is live, grey otherwise.
3. **Published state.** Section 5.1, plus `lastWriteAt`, `lastWriteSeq`, `lastWriteVersion`, `lastWriteNode`, and the answering node's `instance`, `isLeader`, `leaderEvaluatedAt`, `cacheRefreshedAt` from `GET /admin/live`, and the Republish button behind a confirmation.
4. **Snapshot.** `version`, `builtAt`, `s3Key`, `url` as a link, and a "Rebuild snapshot" button (`POST /admin/snapshot/rebuild`, no confirmation).
5. **Live object.** The CDN object as a field grid: `eventId`, `eventStatusId`, `seq`, `lat`, `lng`, `speedMps`, `altitudeM`, `headingDeg`, `accuracyM`, `recordedAt`, `receivedAt`, `publishedAt` with its age, `pollIntervalMs`, `snapshotUrl` as a link, and `cookieTally` joined with `keys.cookieTypes` names when that query is loaded (fetched on entry, not polled). Below it the raw JSON in `ThemedJsonView`, and a second `ThemedJsonView` with `node.live` from `GET /admin/live` for a side-by-side check. "CDN object unavailable." when the CDN fetch has no data.
6. **Email quota.** From `GET /admin/email/quota` (`keys.emailQuota`, polled on the dashboard's interval): `sentLast24Hours` of `max24HourSend` sent in the last 24 hours, `queued` waiting, `verifiedSubscribers` verified subscribers, and `maxSendRate` per second, with numbers formatted with `toLocaleString()`. "No limit" in place of the limit or the rate when the SES value is null. A warning-coloured line "One alert to every subscriber would not fit" appears when `wouldExceed`. "Not checked (dry run)" when `dryRun`. "Could not be checked" when the answer is unavailable.

### 6.3 Events

**List** (`/events`): a `ResponsiveTable` (section 1) over the events ordered as returned. Desktop: year, name (link), `StatusChip`, "Current" chip, `scheduledAt`, route (name from `keys.routes` by `routeId`, `#<id>` when the recording is unknown, or "none"), `fundsPercent`, then the edit pencil (opens the detail page), a row menu, and the Audit cell. Compact: one card per event with the name (link) as the title and the year as the subtitle, the `StatusChip` and the Current chip in the chip row, the scheduled time, the route, and the funds percent as "label: value" lines, and a footer with the edit pencil and the row menu on the left and the audit icon button on the right. The row menu holds "Set current" (hidden on the current event), Clone, and Delete (disabled with the tooltip "This event is live. End it first." or "This is the current event. Make another event current first."). "New event" opens `EventCreateDialog`. Clone opens `EventCloneDialog`: `year` (default the source year plus one), `name` (default the source name with the year replaced), and three checkboxes, all on by default: "Sponsors for the year" (`copy.sponsors`), "Flight history" (`copy.route`), and "Route map settings" (`copy.routeMapConfig`, which starts the new event with the source's `routeMapConfig`); "Clone" sends `POST /admin/events/{id}/clone { year, name, copy }` and navigates to the new event; `409 year_taken` marks the year field.

**Create dialog**: fields `year` (number, default the current year), `name`, `scheduledAt` (datetime-local, optional), `fundsPercent` (number, default 0), and a route radio group with three explicit choices:

| Choice | Body |
|---|---|
| Inherit the most recent route | `inheritRoute: true, routeId: null` |
| Choose a route (select from `keys.routes`) | `inheritRoute: false, routeId: <selected>` |
| No route | `inheritRoute: false, routeId: null` |

Under the inherit choice the dialog shows what the rule selects, computed from the two lists it holds: the event with the greatest `year` whose `routeId` is not null, as "Will inherit <route name> from <event name>", or "No earlier event has a route" (the API applies the same rule; this is a preview of it). Success navigates to the new event.

**Detail** (`/events/:id`): the shared `PageHeader` carries the name as the title with the `StatusChip` and, when `isCurrent`, a "Current event" chip beside it; then a `Grid` of cards: Details and Status side by side on desktop and full width on compact (on desktop the Details card sets the row height and the Status card is exactly as tall, positioned over its grid item, with the title, chip, notified line, and buttons at the top and the History box taking the rest and scrolling inside the card under a sticky table header, so a long history never makes the row taller; on compact the History box is capped at 320 px and scrolls), then Messages (on desktop the Messages card below the row is at most as tall as the Status card, whose height `useElementHeight` in `src/hooks/useElementHeight.ts` measures with a `ResizeObserver`, with its title and post form at the top and its list scrolling inside it; on compact the list is capped at 320 px and scrolls), Seed cookies (only while the event's `statusId` is 3), Flight history, Route map, and Locations full width.

- **Details**: `name`, `year`, `scheduledAt`, `wentLiveAt`, `endedAt`, `fundsPercent`; Save is enabled only while a field differs from the event and sends only the changed fields as `PATCH`. Each of the three datetimes has a Clear button beside it; a cleared field saves as null and clears the stored value. The fields are labelled with the site's words too: "Went live at (Liftoff)" and "Ended at (Wheels down)", so every flight time the site shows (Scheduled, Liftoff, Wheels down, the airborne clock derived from liftoff, and the recorded fixes) is clearable per event: the three here and Clear recording for the fixes. A message has no time of its own to clear: its time is `createdAt`, when it was posted. The Clear button on `scheduledAt` is disabled with the tooltip "Required while the event is scheduled" when `statusId === 2`. Save, "Set current" (hidden on the current event), and Delete (disabled with the same tooltips as the list) live here with their confirmations (8.3) in a wrapping button row (`flexWrap`) with Delete last so the row folds to two lines on a narrow card without hiding anything.
- **Status**: the current `StatusChip`, then whether subscribers know: `statusNotifiedAt` set renders "Subscribers were notified <age> ago"; null renders "Nobody was notified of <status>" in the warning colour with a "Notify subscribers" button that opens `NotifyDialog` (the verified count line, an optional "Message (optional)" field of up to 1000 characters with the stock paragraph for this status as its placeholder and the helper line "Posted on the site as the latest message. With notify it replaces the stock paragraph in the email." followed by the counter, while the field is empty the notice "No message typed. This default message will be emailed:" with that stock paragraph in a quoted block, and "Send now", which calls `POST /admin/events/{id}/notify { message }` with the trimmed message or null when empty and refreshes the event, the history, and the messages). The typed message is an event message: the API posts it as the event's latest message on the site, so the Messages card lists it at once. Then a wrapping row of one button per other status, disabled with a tooltip: Scheduled when `scheduledAt` is empty ("Set a scheduled time first"); Live when `!isCurrent` ("Set this event current first"), when another event has `statusId === 3` ("<name> is live"), or when no beacon in `keys.beacons` is both `isActive` and `healthy` ("No healthy active beacon: <reason>", the reason being "none is active", "<name> is revoked", "<name> is stale since <stamp>", "<name> has never been heard from", or "<name> is not healthy"). Postponed, Planned, Ended, and Cancelled have no gate. Clicking opens `StatusDialog` (below). The API repeats the check (`409 no_healthy_beacon`, 8.2), so a beacon that goes stale between the render and the click is caught too. Under the buttons, the status history is a `ResponsiveTable` newest first with the change (from → to, or "announced again" when equal) as the title, and who, when, and Notified as label lines; Notified is "No" when `notify` is false, otherwise "Yes · <sentCount> sent" with the custom message's first 60 characters (from `message`) after it when one was given. The API's alert-send chore raises `sentCount` as the emails go out, so the history (`keys.eventHistory(id)`) refetches every 3 seconds while its newest row has `notify` true, a `changedAt` within the last ten minutes, and a `sentCount` below the verified count of `keys.subscribersSummary` (for the whole ten minutes when that count is unknown), and stops otherwise (`historyPollInterval` in `src/pages/events/historyPolling.ts`); a notifying change toasts "Status changed, notifying subscribers" and an announce toasts "Notifying subscribers", since the count fills in after the toast. The history has no row actions and no Audit cell (audit lives on the event, § 6.22).
- **Messages**: the event's messages, whichever way they were written: the post form below, the message typed on a status change (`StatusDialog`), or the message typed on an announce (`NotifyDialog`). The status and notify mutations invalidate `keys.eventMessages(id)` too, so a row posted by either shows here right away. A message has no event time: its time is `createdAt`, when it was posted. Post form with `body` (multiline), then a wrapping row of a `notify` checkbox (off by default) and Post; on a narrow card the row folds so every control keeps its full width. Post sends `POST /admin/events/{id}/messages { body, notify }`. While Notify is ticked the form shows, above `EmailQuotaNotice`, the same "<n> verified subscribers will be emailed" line as `NotifyDialog` from the same source (`keys.subscribersSummary`, `verifiedLine` in `src/pages/events/verifiedLine.ts`; "Verified subscribers will be emailed" while the count is unknown). A post toasts "Message posted", or "Message posted, notifying <n> subscribers" with Notify ticked (<n> the verified count). The list newest first as outlined cards showing body and a caption of `createdBy` · `createdAt`, then "Notified · <sentCount> sent" when the message's `notify` is true and no such line otherwise (a message posted by a status change or an announce has `notify` false; its alert counts on the status history row), each with an edit pencil (inline form for `body` only; `PATCH { body }`, no notify) and a delete icon (`ConfirmDialog`, "Delete message? This cannot be undone.") on one line beside the body. The list sits in the `messages-list` box, which on desktop takes the room the card has left under the post form at the Status card's measured height and scrolls (uncapped until that height is known), and on compact is capped at 320 px and scrolls. The messages (`keys.eventMessages(id)`) refetch every 3 seconds by the same rule as the history, through the same `historyPollInterval` with each message read as `{ notify, changedAt: createdAt, sentCount }`: while the newest message has `notify` true, is under ten minutes old, and has a `sentCount` below the verified count (for the whole ten minutes when that count is unknown).
- **Seed cookies** (`SeedCookiesSection`): rendered only while the event's `statusId` is 3; in every other status the card is absent, not disabled. Cookies are a hidden feature, so nothing else in the panel (the nav, the dashboard, the events list) mentions seeding. The card's title and help line come from `SEED_COOKIES_LABELS` in `labels.ts`: "Seed cookies" and "Adds cookies to the live tally. They count like visitors' cookies and are never shown as anyone's." Then one row per active cookie type from `GET /admin/cookie-types` (`keys.cookieTypes`): the type's `IconPreview` at 24 px and its name, then a number field 0 to 100 (default 0; typing and stepping clamp to the range) between two 44 px icon buttons labelled "One fewer <name>" and "One more <name>". A total line "<n> cookies" sits beside the Seed button, which is disabled at zero and opens a `ConfirmDialog` "Seed <n> cookies on <event name>? This cannot be undone."; its confirm calls `events.seedCookies(id, { items })` (`POST /admin/events/{id}/cookies`) with only the types above zero. Success toasts "Seeded <n> cookies", resets every field to zero, and refreshes `keys.event(id)` and `keys.cookieTypes`; the dashboard's live object card follows on its own poll. `409 event_not_live` shows "The event is no longer live." in the card's `ErrorAlert` and refreshes the event, which hides the card. On compact each row stacks the icon and name above the field and its buttons, and the buttons stay 44 px. The API audits the write as `cookies_seeded` (6.22).
- **Flight history**: helper text "Visitors can turn this on in the tracker menu to see the projected route. Change it any time; the site picks it up on the next snapshot." Current recording (`name`, `pointCount`, `createdAt`, `uploadedBy`, `url` as "CDN link") or "No recording linked." "Shared with" lists the other events whose `routeId` equals this one, from `keys.events`. Actions in the header on desktop, and in a wrapping row under the title on compact: Upload (opens `RouteUploadDialog`, 7.3), "Record from this event" (`POST /admin/routes/from-event/{id}` with the name "<event name> recording", then `PATCH { routeId }`), and Unlink (`PATCH { routeId: null }`) when a recording is linked. Below, "Choose existing": a select over every recording in `keys.routes`, each option "<name> · <pointCount> points · <createdAt> · used by <event years, or 'no event'>", newest first, the current recording preselected, with a "Use this recording" button that sends `PATCH { routeId }` (disabled while the selection equals the linked recording); the select and the button stack on compact so each takes the card's full width. An upload on this page is one action: `POST /admin/routes` then `PATCH /admin/events/{id} { routeId }`.
- **Route map** (`RouteMapSection`): configures how the site draws this event's route map, stored on the event as `routeMapConfig` (RouteMapConfig in `primitives.schema.json`, part of the snapshot). The card shows either "Every setting is at its default." or "Differs from the default:" with one chip per setting whose value is not its default ("Time labels: Every 10 minutes", "Route line: Thick", "Terrain toggle: Off"; a stored value equal to the default is not listed, and no chip names the places, which are sitewide), and one button, "Configure route map". With no recording linked the caption "No flight recording is linked, so the preview stays empty until one is." sits under the summary. The button opens `RouteMapConfigDialog`, a large dialog (full screen below `sm`, the whole window less 32 px on each side above it) that mounts only while open, so each open starts from the saved config. On the left (above on compact) a Light / Dark toggle and the live preview (`EventRouteMapPreview`): the route of `GET /admin/events/{id}/route-map` (`keys.eventRouteMap(id, routeId)`) on an interactive `maplibre-gl` map that fills the area and takes gestures directly (the wheel zooms, a drag pans), fitted to the path, with the arrowhead image added on create; over it stand the site's buttons the draft keeps, a fullscreen button (full screen for the preview box) and a terrain toggle that draws the hillshade when `<base>/terrain.pmtiles` exists. On the right (below on compact) first **Copy from another event**, then two groups. Copy from another event (`RouteMapCopyFrom`) is an "Event" select over every other event of `GET /admin/events` (`keys.events`), newest year first, each option reading "<year> <name>" over "Has route map settings" or "No route map settings"; picking one replaces the whole draft with that event's `routeMapConfig` (the defaults when it has none), so the two groups and the preview show it at once, and an info line reads "Loaded the route map settings of <name>. Review them, then Save to keep them." (or "<name> has no route map settings, so every setting shows its default. Save to keep that."). Nothing is written until Save; Cancel drops the copy with the rest of the draft. **Display** (`RouteMapDisplayControls`: the Time labels, Arrow size, Route line, and Label size selects and the Arrows switch, each showing the built-in default until picked, Every 15 minutes, Medium, Normal, Medium, Arrows on, with a "Default" button beside a picked value that removes the key, then the caption below; Arrow size sits directly under Arrows and, while the arrows are off (stored as false, or the default when unset), its select and its Default button are disabled with the helper "Turn the arrows on to size them." in place of its help, the stored size kept and shown again once the arrows are on), and **Controls** ("Fullscreen button" and "Terrain toggle" switches, on while absent; flipping one writes its value, `true` included). The dialog has no landmarks and no places: both are sitewide, in Site settings (6.16). The dialog holds a draft; every change rebuilds the preview's style through `eventRouteMapStyle` (section 2.11) and applies it with `setStyle`, so the preview shows each change at once. Save sends `PATCH { routeMapConfig }` with the draft, empty groups left out and `null` when no group is set, toasts "Route map saved", and closes; Cancel closes without a request. "Clear all" opens a `ConfirmDialog` ("Clear the route map settings?"); confirming sends `PATCH { routeMapConfig: null }` and toasts "Route map cleared". Without a linked recording the preview area holds only the hint "Link a flight recording to this event under Flight history to preview its route map." and no map is created or route map read, while the controls still edit and save; a recording without a path shows "The linked flight recording has no path to draw." and an unset `VITE_ROUTE_BASEMAP_URL` shows "The route map preview needs VITE_ROUTE_BASEMAP_URL, which is not set." in the same place.


  Under the Display group a caption reads "Places are set for every map in Site settings." with "Site settings" a link to `/site-settings`. The preview labels the places the site labels: the dialog reads the site settings draft (`siteSettings.get()` under `keys.siteSettings`, the query the Site settings page uses) and passes its `places.routeMap.kinds` to `eventRouteMapStyle` as `poiKinds`; a draft without `places.routeMap` passes none, so the preview shows no places, as the site does.

- **Locations**: filters `beaconId` (select from `keys.beacons`, "Any beacon") and `publishedOnly` (switch); on compact the two filters stack under each other and the title and action row also stacks. One page of `LocationRow` (`limit` 100) in a scrolling box that keeps a table on every viewport (a preview of raw rows, not a phone card list), scrolling horizontally when the columns exceed the card width; columns `seq`, `beaconId`, `published`, `recordedAt`, `lat`, `lng`. "Download CSV" calls `events.locationsCsv` with the same filters and saves `locations-<year>.csv` through `downloadBlob`. The download goes through `fetch` because the request needs the `Authorization` header. Beside it, "Clear recording" opens `ClearRecordingDialog` (a wave 10 delete dialog over `GET /admin/events/{id}/locations/impact`, which returns one `location` group per beacon with the beacon's name and the row count, or `blocked: "This event is live. End it first."` while live); the dialog carries a Beacon select ("All beacons" or one of the beacons named in the preview, matched by name against `keys.beacons` for its id) and, on confirm, calls `DELETE /admin/events/{id}/locations` (adding `?beaconId=<id>` for the per-beacon variant). A success toasts "Recording cleared" and refetches the event and its locations; a `409 event_live` or any other error toasts the API's message like the other mutations.

**Poster studio** (`/posters` and `/posters/:id`, drawing with `src/routeMap/poster.ts`, section 2.11). A poster is a document of its own (contracts 4.5 Posters), made freely and never tied to an event: its name, the flight recording its map is built from (`routeId`, or none), and its `layout`, the whole design. Nothing in the studio attaches a poster or a generated image to an event, and the event page has no poster card: a poster is for distribution off the site.

**Poster list** (`/posters`, `PostersList`, the drawer's "Poster studio" entry under Media): the shared `PageHeader` titled "Poster studio" with a "Create poster" button, a short `CommentBox`, and a `ResponsiveTable` over `GET /admin/posters` (`keys.posters`) newest first: the name (a link to `/posters/:id`) as the title, the flight recording's name from `keys.routes` (`#<id>` when the recording is unknown, "No recording" when `routeId` is null), and the updated time (`formatStamp`) as lines; the actions are the edit pencil (opens the editor) and a row menu with Open, Duplicate, and Delete; then the Audit cell (entity `poster`, a null stamp). "Create poster" opens a dialog asking the name (required, trimmed, at most 200 characters); Create sends `POST /admin/posters { name }` and opens the editor on the new poster. Duplicate reads the poster (`GET /admin/posters/{id}`, for its `layout`) and sends `POST /admin/posters { name: "<name> copy", routeId, layout }` (`copyName`), toasts "Poster duplicated", and stays on the list. Delete opens `DeleteDialog` (8.3) with the `posters` impact preview and sends `DELETE /admin/posters/{id}` ("Poster deleted"). Every write refreshes `keys.posters` (exact).

**Poster editor** (`/posters/:id`, `PosterEditor` with `PosterStudioWorkspace`): a full page workspace for designing the poster and generating its image. It reads the poster (`keys.poster(id)`). The shared `PageHeader` has the title "Poster studio", the header row's actions "Back to posters" (a link to `/posters`) and "Save", and under the title the Name field (required; an empty name shows "The poster needs a name." and disables Save) beside the "Flight recording" select: "No recording" and every recording of `GET /admin/routes` (`keys.routes`) by name. While no recording is chosen ("Choose a flight recording to draw the poster's map.") or `VITE_ROUTE_BASEMAP_URL` is unset ("Poster generation needs VITE_ROUTE_BASEMAP_URL, which is not set.") that hint shows as an info alert in place of the workspace; the design the page holds survives the switch, so choosing a recording again reopens the workspace as it was. The workspace is a `Grid`: on desktop (md and up) the preview fills the working column (8 of 12 columns, 9 on lg), large, the point of the page, with the overlay warning under it, and the controls sit in a right rail (4 of 12, 3 on lg) in this order: Theme, Orientation, Size, Terrain, Map details (Landmarks, Town names, Road labels), Route styling (colour, Arrows, Arrow size, Time labels, Start time, Timezone, Label format, stacked), the Overlays row (Add image, Add logo, Add QR code; Forward, Back, Delete, Clear overlays), the output file name, Generate, then the progress states, the error, and the ready block. Below md the rail stacks under the preview, full width. Theme (Light, Dark; default Light), Orientation (Portrait, Landscape; default Landscape), and Size (default Facebook post): "Facebook post" 2048 x 1536, "Flyer, letter at 300 dpi" 2550 x 3300, and "Poster, 11 x 17 at 300 dpi" 3300 x 5100. Portrait puts the longer side vertical and Landscape puts it horizontal, so the orientation swaps the pair; each option shows its size for the current orientation, and the rail shows the output file name. Opening the editor runs the terrain probe; once it finds the archive a Terrain checkbox (default unchecked) appears under the sizes, and while the archive is missing or the probe is pending the checkbox is hidden (a saved Terrain choice is kept and draws once the archive is found).

- Map details: a group in the rail under Terrain with three switches, each on by default: Landmarks (the points of interest names), Town names (the city, town, village, and neighbourhood names), and Road labels (the road names). Their values go to the style as `details` (`{ landmarks, placeNames, roadLabels }`, the `StyleDetails` of santa's `style.ts`, which drops the basemap layers `DETAIL_LAYERS` names for each group turned off) through the one style call the preview and the export share, so a switch changes the preview at once and the export draws the same map. The basemap flavors carry no points of interest layer, so Landmarks draws the same map either way until one does.
- Route styling: a group in the rail under Map details. A colour picker with a hex field (`#rrggbb`; the default is the chosen theme's route colour from `ROUTE_PALETTES`, and follows the theme until a colour is picked; Reset returns to it), an Arrows switch (default on), an Arrow size select directly under it, enabled only while the arrows are on (Small, Medium, Large, Extra large, scales 0.75, 1, 1.5, and 2 of the style's arrowhead size and spacing, the labels carrying no numbers; default Large, since Medium, the style's own size, reads too small on a poster), a Time labels select (Off, Every 5, 10, 15, or 30 minutes; default every 15), a Start time field (`datetime-local`, the flight's start as a wall time, empty by default) with a Timezone select (`TimeZoneSelect`, default the browser's zone), and a Label format select (Wall clock, Elapsed; default Wall clock). While no start time is set the format is locked to Elapsed with the hint "Without a start time the labels show the time since the start." The labels are the entries of `routeMap.timeline` at every whole multiple of the interval, always with the final entry; wall clock is the start (read in the chosen zone through `wallTimeToUtc`) plus the entry's minutes on the twelve hour clock (`h:mm AM`, so "6:15 PM") in that zone through `utcToWallTime`, so a daylight saving change inside the flight follows the zone, and elapsed is the site's form: minutes only under an hour ("45m") and hours plus minutes from one hour ("1h 15m", "2h 0m"). The `{ lat, lng, label }` list goes to the style as `timeLabels`, and the chosen arrow size as `arrowScale`, through the one style call the preview and the export share.
- Preview: the workspace reads `GET /admin/routes/{id}/route-map` for the chosen recording (`keys.routeMap(id)`; a new choice reads the new map) and shows a live preview (`RoutePosterPreview`): a non-interactive `maplibre-gl` map laid out at the export's CSS size (half the chosen size), scaled down to fit the working column (its full width, and at most the viewport's height less 200 px for the bar and the header, never under 360 px) with its pixel ratio lowered to match, fitted to the path with the export's padding, so zoom, line widths, arrows, and label placement are the export's. The arrowhead image is added when the map is created (`makeRouteArrowImage`, added again if a style replacement drops it). Every change of theme, terrain, or route styling rebuilds the style and applies it with `setStyle`; a size or orientation change resizes the map and fits the path again. The preview and Generate both build the style through one call (`buildPosterStyle` with the same input), so the two cannot drift. A route map without a path shows "The chosen flight recording has no path to draw." in place of the preview. Every preset stays under the API's 40 megapixel decode ceiling and at or over 2048 px on the long side, so confirm cuts the deep zoom pyramid and the site's viewer style works over a generated poster.
- Overlays: an "Overlays" group (`PosterOverlayControls`) in the rail and a `konva` stage (`PosterOverlayComposer`, through `react-konva`) laid over the preview at its display size, so the stage has the poster's aspect. Three element types: an image ("Add image" opens `MediaPicker` titled "Choose an overlay image" over every kind; a raster or svg asset is placed, a gif is refused with "Animated GIFs cannot be placed on a poster. Choose a raster image or an SVG."; an svg is drawn through an image element so it rasterises at the export scale and stays sharp), the site logo ("Add logo", shown only when the site settings draft (`GET /admin/site-settings`, `keys.siteSettings`) has `logoMedia`, adds that asset, stored as its media id), and a QR code ("Add QR code" opens "Choose a QR code": `GET /admin/qr-codes` (`keys.qrCodes`) sorted by tag, each row the tag over the attached place path, searched by tag or place; the code is drawn with `renderQrCard` in `pages/qr/qrRender.ts`, the codes pages' `qrcode` rendering of `<VITE_SITE_BASE_URL>/q/<tag>` with error correction M, as an svg card of opaque white with the four module quiet zone and black modules, so it scans in print over any map). A media element's asset comes from `GET /admin/media/{id}` (`keys.mediaAsset`) and its original `url` is loaded through `loadOverlayImage`; a new element lands at the centre (a quarter of the width for an image, a fifth for the logo, 15% for a QR code) and is selected. A click or tap selects an element and puts a `Transformer` on it: move, scale from the corners with the aspect kept, and rotate (snapping at the quarter turns); anchors are larger on compact so they work with a finger. While dragging, the element's edges and centre snap to the poster's edges and centre within 6 px and a dashed guide shows the line it snapped to. Forward and Back move the selected element one step in the stacking order, Delete (the button, or the Delete or Backspace key outside a text field) removes it, "Clear overlays" removes every element, and a click on the empty stage clears the selection. An element whose image is still loading or failed draws as a dashed placeholder, and a failed one also shows the warning "The overlay <name> could not load. <reason>" (names: "image <filename>", "the site logo", "QR code <tag>").
- Layout: the whole design is saved on the poster as its `layout`, a document of the panel's own (`routeMap/posterLayout.ts`):

  ```json
  {
    "version": 1,
    "theme": "light", "orientation": "landscape", "size": "facebook", "terrain": false,
    "details": { "landmarks": true, "placeNames": true, "roadLabels": true },
    "routeStyle": { "colour": "#rrggbb or null for the theme's", "arrows": true, "arrowScale": 1.5,
                    "labels": { "interval": 15, "format": "wall",
                                "start": "2026-12-21T18:00 or null", "zone": "America/Denver or null" } },
    "elements": [
      { "type": "image", "mediaId": "<uuid>", "x": 0.25, "y": 0.5, "width": 0.3, "rotation": 15, "z": 0 },
      { "type": "logo",  "mediaId": "<uuid>", "x": 0.5,  "y": 0.1, "width": 0.2, "rotation": 0,  "z": 1 },
      { "type": "qr", "qrId": 100, "tag": "qr-001", "x": 0.9, "y": 0.9, "width": 0.15, "rotation": 0, "z": 2 }
    ]
  }
  ```

  `theme` is `light` or `dark`, `orientation` `portrait` or `landscape`, `size` the preset id (`facebook`, `flyer`, `poster`), and `terrain` whether the hillshade is drawn. `details` holds the Map details switches (Landmarks, Town names, Road labels); a switch absent from the document, or the whole `details` absent, reads on, and only `false` turns a group off. `x` and `y` are the element's centre over the poster's width and height, `width` is its width over the poster's width (the height follows the image's own aspect; a QR card is square), `rotation` is clockwise degrees about the centre, and `z` is the stacking order from 0 at the back, rewritten as the index on every save. `arrowScale` is 0.75, 1, 1.5, or 2 (Small, Medium, Large, Extra large); an absent or unknown value reads Large. `labels.interval` is 0, 5, 10, 15, or 30 and `labels.format` is `wall` or `elapsed`, the route styling's own values; `labels.start` is the start time as a `yyyy-MM-ddTHH:mm` wall time in `labels.zone` (null for none), and `labels.zone` an IANA zone (null for the viewer's). Because every position is a fraction, one layout survives a preset or orientation change. Reading drops elements of an unknown type or without a placement, reads any missing or unknown map choice or route style value as its default, and ignores any document that is not version 1. Opening the editor restores the whole design once, when the poster loads (a save that refreshes the poster leaves the workspace alone): the theme, orientation, size, and Terrain choices, the Map details switches, the route style into the colour, Arrows, Arrow size, Time labels, Start time, Timezone, and Label format controls, and the elements into the composer; a poster without a layout opens on the defaults. "Save" sends `PATCH /admin/posters/{id} { name, routeId, layout }` with the trimmed name, the chosen recording (null for none), and the whole document ("Poster saved"), and a successful Generate saves the same way after confirm and before the ready block. A failed save shows "The poster could not be saved. <reason>" above the workspace and leaves the design and the poster flow alone. A save puts the answer in `keys.poster(id)` and refreshes `keys.posters` (exact).
- Render: "Generate" uses the route map the preview read (reading it when it is not loaded yet), builds the style through `buildPosterStyle` with the preview's input (the chosen theme, the hillshade when Terrain is checked, the route colour, arrows, arrow size, and time labels, over the smoothed `path` with the timeline points at every whole 5 minutes strictly between the start and the end as the marks), and renders it in an offscreen `maplibre-gl` map (loaded on demand, with the `pmtiles` protocol registered once, and the arrowhead image added on create) with `preserveDrawingBuffer`, no attribution control, no interaction, and an explicit `pixelRatio` of 2 over a container of half the chosen size, so the canvas is exactly the chosen pixel size whatever the admin's screen; `maxCanvasSize` is the chosen size. The bounds of the path are fitted with a padding of 8% of the shorter side. Before the map renders, every overlay image is awaited (a failed one is tried again) and the overlays are drawn through `renderOverlayCanvas` at the print pixel scale. After the map's `idle` event the compose canvas of the same size gets the map canvas first, then the overlay canvas, then the attribution chip last so nothing covers it, and the poster JPEG (quality 0.92) is exported from that. An overlay that cannot load or would taint the canvas stops the run before the map renders with the error "The overlay <name> could not be drawn. <reason>". A canvas of any other size, a map error, or no `idle` within 60 seconds is a render failure.
- Attribution: the composed canvas carries "© OpenStreetMap contributors" (the text of `OSM_ATTRIBUTION`) as a rounded chip in the bottom right corner, light or dark to match the theme, with a font of one eightieth of the shorter side (at least 14 px), so the attribution lives in the exported bytes wherever the image goes.
- Upload: the JPEG goes through the media upload flow (`POST /admin/media/upload-url` with `contentType: "image/jpeg"`, the poster's name as the title, and "The <name> route map" as the alt text, the presigned `PUT`, `POST /admin/media/{id}/confirm`) named `poster-<name>-<theme>-<width>x<height>.jpg` (`posterFilename`: the name lowercased with every run of other characters as one hyphen). An image over the 20 MB raster limit is refused before the ticket. When the asset is ready the rail shows it with its size and an "Open in the media library" link (`/media?id=<id>`, which opens the detail drawer on it). The asset stays in the library.
- States: "Rendering the map", "Uploading" with the progress, "Processing the upload", and the ready block are shown in the rail under the Generate button. A render failure ("The poster could not be drawn. <reason>"), the size limit (the image over 20 MB or a `413` from the ticket, confirm, or `PUT`: "The poster image is over the 20 MB limit for images. Choose a smaller size or the other theme and generate again."), or any other upload failure is an error alert; the choices re-enable, "Generate" reads "Try again", and the header link back to the poster list always works. Leaving the page abandons a run in flight.

**StatusDialog** (shared with the dashboard): title "Change status of <name>: <from> to <to>"; a "Message (optional)" field (multiline, up to 1000 characters) with the helper line "Posted on the site as the latest message. With notify it replaces the stock paragraph in the email." followed by the counter on the same line, whose placeholder is the stock paragraph of the target status' template (`lib/statusCopy.ts`, kept in step with the API's email template by hand), so the admin sees what goes out and can replace it; while the field is empty (or blank) an info notice under it (`DefaultMessageNotice`) reads "No message typed. This default message will be posted on the site, and emailed to subscribers:" followed by that stock paragraph in a quoted block, and it goes as soon as the admin types; the consequence line "<verified count> verified subscribers will be emailed" (count from `keys.subscribersSummary`, fetched when the dialog opens). Two confirm buttons instead of a checkbox: "Change and notify" (primary; sends `notify: true`) and "Change without notifying" (text button), the latter asking once more in a nested dialog ("Change the status without telling subscribers? The message posts on the site now. You can notify subscribers later from the event page.") before it sends `notify: false`; when the field is empty the nested copy reads "The default message posts on the site now. You can notify subscribers later from the event page." with the same notice under it, its lead ending "posted on the site:" without the email part. Both paths send the typed message, trimmed, or null when the field is empty (the API then posts the stock paragraph as the event message and, with notify, emails it): the message is an event message, posted on the site as the latest message whether or not subscribers are emailed, and with notify it also replaces the stock paragraph in the email. On compact the actions row stacks the buttons (`flexDirection: column`) full width so each one is easy to reach. For target 3 the dialog adds the active beacon line from `keys.beacons`: "Active beacon: <name>, healthy or unhealthy, heartbeat <age>, hub connected, polling, or unknown" (or "Active beacon: none"), the gate reason in red with both confirm buttons disabled when the gate fails, and "Another event is already live." when one is. Confirm sends `{ statusId, notify, message }`; a `409 no_healthy_beacon` answer renders `details.beacon` (name, last seen, stale since) or "No beacon is active" in the dialog and the caller refetches beacons. `StatusDialog`, `NotifyDialog`, `EventCreateDialog`, `EventCloneDialog`, and `RouteUploadDialog` all go full screen through `AppDialog` below `sm`; the Expected shape `pre` in `RouteUploadDialog` scrolls horizontally inside its box on a narrow viewport rather than pushing the dialog wider.

**Email quota notice.** `NotifyDialog` always, `StatusDialog` while its notify option is active, and the Messages post form while its Notify checkbox is checked render `EmailQuotaNotice` above the actions: an `Alert` warning when `GET /admin/email/quota` says one alert to every subscriber would not fit, naming the remaining allowance, the last-24 numbers, the queue, the limit, the verified count, and roughly how many would be refused. The notice never disables or blocks the send: the operator decides, and an `Alert` info takes its place when the quota is on a dry run or the check could not run.

### 6.4 Flight recordings

`/routes`, titled "Flight recordings", with the lead text "Recordings of past flights. The one linked to an event is its flight history on the tracker, and what Red-Nose replay and exports use. The route page shows the poster on each event." A `ResponsiveTable` newest first: title is `name`, lines are `pointCount`, `createdAt`, `uploadedBy`, a "CDN" link, "Used by" (events with this `routeId`, from `keys.events`), actions are the row menu with Delete, and the Audit cell. Delete opens `DeleteDialog` (8.3). Toolbar (through `PageHeader`, wrapping under the title on compact): "Build from event" (a dialog listing the ended events, a route name defaulting to "<event name> route", `POST /admin/routes/from-event/{eventId}`) and "Upload recording" (`RouteUploadDialog` without linking to an event). On a phone the rows are cards with the same title, lines, actions, and audit button.

### 6.5 Beacons

**List** (`/beacons`, polled): a `ResponsiveTable` by name: title is the name (link), subtitle is the `keyPrefix` in `<code>`, chips are the "Active" chip, the Healthy or Unhealthy chip (`healthy`), the hub state chip (connected, polling, unknown from `hubConnected`; "off (HTTP only)" when `hubAllowed` is false), and the flag chips (5.2); the lines are last seen, last heartbeat, last location as ages with the absolute time as the title, and three right-aligned counter columns, Stored, Carried, and Rate limited, from `fixesStored`, `fixesCarried`, `fixesRateLimited` (they are counters on the beacon row, not rows anywhere: they count fixes that produced a location row, fixes accepted and published without one, and fixes refused by the beacon's minimum interval, and they never reset); actions are the edit pencil (opens the beacon page) and a row menu; then the Audit cell. The row menu holds Activate (when not active), Deactivate (when active), Rotate, Revoke, and Open. On compact each row becomes a card carrying the same title, subtitle, chips, lines, actions, and audit button (M34). Revoked beacons are not in this list: they sit in a `Revoked (n)` accordion under it, collapsed by default, as a second `ResponsiveTable` with the same title, subtitle, and lines, a "Revoked" chip, no flags, the pencil only, the Audit cell, and rows greyed through `rowSx`; an empty accordion is not rendered. "New beacon" opens `BeaconCreateDialog`: `name` and `notes` only, with the text "A beacon is a key. Anything that holds it can post locations, heartbeats, and logs; what runs behind it is up to you."

**KeyRevealDialog** (after create and after rotate): the `key` in a monospace read-only field with a Copy button; the `enrollment.qrPngDataUrl` as `<img>` fixed at 220 px and centred (same on the full-screen phone dialog); `enrollment.url` as text with Copy; a live countdown to `enrollment.expiresAt` ("QR valid for 14:32"; at zero, "QR expired. The key still works when typed by hand; rotate to mint a new QR"); the warning "This key is shown once. Store it before closing." The dialog has no backdrop close and no escape close; the only button is "I have stored the key".

**Detail** (`/beacons/:id`): selects the row from `keys.beacons` (same poll as the list, `staleAfterS` included). Header through `PageHeader`: title is the name, the chips are the `keyPrefix` in `<code>`, an Active or Revoked chip, and the Healthy chip (not for revoked); below it a revoked banner with `revokedAt`, and the flag chips. Cards: Details (an Edit button unlocks `name`, `notes`, and `minIntervalMs` as "Min interval (ms)" with the helper text "0 to 60000; blank uses the default from settings", Save sends the changed fields with a blank Min interval sent as `null` to clear the override, "Created by <createdBy> on <createdAt>"), Actions (Activate or Deactivate, Rotate key, Revoke, and a Hub allowed switch that applies at once through `PATCH /admin/beacons/{id}` with `{ hubAllowed }` and a toast, labelled "Hub allowed" or "Hub off (HTTP only)"; none for a revoked beacon; the same confirmations as the list; buttons wrap), Ages (`lastSeenAt`, `lastHeartbeatAt`, `lastLocationAt`, `staleSince`, each as an age plus the absolute stamp in the viewer's zone, with the absolute time wrapping under the age on compact; `heartbeat_old` and `stale` colour theirs red), Fixes (`fixesStored`, `fixesCarried`, `fixesRateLimited` as three counter lines), Telemetry (`TelemetryPanel`; its search row and the JSON tree fit and the tree scrolls inside its box, M33), and Logs (`BeaconLogs`).

**TelemetryPanel**: `telemetry === null` renders "No heartbeat received". Otherwise two blocks:

| Block | Content | Coloured by |
|---|---|---|
| Health | `sentAt` with its age; hub: connected, polling, or unknown from `hubConnected`, or "off (HTTP only)" when `hubAllowed` is false; then each of the three `health` leaves the beacon reported (`batteryPercent` %, `lastFixAgeS` s, `socketState`), "not reported" for a missing leaf, "unknown" for null | `battery_low`, `no_recent_fix`, `socket_down` |
| Debug | the beacon's `debug` object as a themed, collapsible JSON tree (`ThemedJsonView`, expanded two levels, copy button, search box filtering keys); "This beacon sends no debug data" when null or empty | nothing; the panel never reads it |

The panel has no idea what a beacon is, so it names nothing inside `debug`; Red-Nose's power, radio, GPS, transport, process, and identity groups appear there exactly as the phone sends them, and the simulator's or the legacy beacon's own objects the same way.

**BeaconLogs**: a `ResponsiveTable` from `GET /admin/beacons/{id}/logs` newest first (title `receivedAt`, lines `appVersion` and `sizeBytes`, action View); View fetches the text and shows it in a `<pre>` under the list with Download (`download.ts`, `beacon-<id>-log-<logId>.txt`) and Close; the `<pre>` scrolls horizontally inside its box. Shown for every beacon; "No logs uploaded." when empty.

### 6.6 Sponsors

**List**: a `ResponsiveTable` as returned: leading is the resolved `logo` asset's 480 px variant or `url` at 40 px (or "none"), title is name (link), lines are latest year and years count derived from `years[]` plus `websiteUrl` as a link, actions are the edit pencil (opens the detail page), and the Audit cell; there is no row menu (delete lives on the detail page). On a phone the rows are cards with the same leading, title, lines, and pencil. "New sponsor" opens a dialog with `name` plus the seven optional fields (contact person, email, phone, address, website, Facebook, Instagram); success navigates to the detail page. "Import from year" opens `SponsorImportDialog`: a from-year select (every year present in any sponsor's `years[]`, newest first), a to-year select (default the current event's year, the events' years as options), then a checkbox list of the sponsors that have the from year and not the to year (logo, name, that year's amount), all ticked by default, and "Import <n>", which sends `POST /admin/sponsors/import { fromYear, toYear, sponsorIds }` and reports "Imported n, skipped m".

**Detail**: a header with the name and "Delete sponsor" (`DeleteDialog`, 8.3); a Details card (`name`, `contactPerson`, `email`, `phone`, `address`, `websiteUrl`, `fbUrl`, `igUrl`; Save sends changed fields; empty strings become `null`; "No changes" when nothing differs); `LogoSection`; the Years card.

**Years**: a `ResponsiveTable` of `years[]` (title `eventYear`, chips for `active`, `canAdvertise`, `anonymous` as small chips, lines are `amountDonated` shown as received, "Tracker time" as `lingerMs` in seconds with "(override)" when `lingerMsOverride` is set, "#n" when `pinnedPosition` is set, and `registeredAt`, actions are the edit pencil and the row menu with Delete, and an Audit cell with no stamp); on a phone the rows are cards with the same title, chips, lines, and actions. The header row wraps the two "Add year" buttons under the title on compact. "Add year", and "Add year from…": a menu of the sponsor's existing years, then a small "Copy year" prompt for the target year (default the current event's year, 2000 to 2100) that sends `POST /admin/sponsors/{id}/years/{targetYear}/copy-from/{sourceYear}` and opens the new row in `SponsorYearDialog` for editing; `409 year_exists` renders "The sponsor already has this year." on the prompt. `SponsorYearDialog` fields: `eventYear` (number; fixed when editing), `amountDonated` (text, optional, "Empty means no amount recorded"), three switches defaulting to `true`, `true`, `false` on add, `lingerMsOverride` as "Tracker time override (seconds)" (number, optional, 0 to 600; the helper text shows the computed value from `amountDonated` and the two settings, fetched from `keys.settings` while the dialog is open), and `pinnedPosition` (number, optional, 1 to 1000; the helper text points to the Sponsor order page). Save is `PUT .../years/{eventYear}` (an upsert, so add and edit are the same call); `409 pinned_position_taken` is a field error on `pinnedPosition`: "Position is taken for this year; use Sponsor order to rearrange". Deleting a year is a `ConfirmDialog` ("Delete the <year> row? This cannot be undone.").

**Sponsor order** (`/sponsors/order`, its own drawer entry, editor and admin): a year select (defaulting to the current event's year, options from `keys.events`), a `CommentBox` ("Largest gift first unless pinned. Tracker time is the gift times the per-dollar rate (Settings), floored at the minimum, unless overridden here."), then one list in the exact order the site will show, from `GET /admin/sponsors/order/{eventYear}`. Rows show a drag handle, logo, name, amount, tracker time, and either "pinned #n" or "by amount". The pinned rows sit at the top and are drag-reorderable (`@dnd-kit`); a row's pin icon moves it to the bottom of the pinned block, unpin drops it back into the by-amount block. Every reorder, pin, or unpin sends the whole pinned list as `PUT /admin/sponsors/order/{eventYear} { pinnedSponsorIds }` and replaces the list with the response. An inline "Time (s)" field per row saves `lingerMsOverride` on blur with `PUT .../years/{eventYear}` (the other year fields resent unchanged from the sponsors list). A sponsor whose year row fails the snapshot filter (inactive, anonymous, or may not advertise) is greyed with "Not on the site" and cannot be pinned or timed.

**LogoSection**: the current `logo` asset (image, filename, dimensions) or "No logo", a "Choose logo" button opening `MediaPicker` (6.15, which can upload on the spot), and "Remove". Both send `PATCH { logoMediaId }`; the response `Sponsor` replaces the cached row. `409 media_not_ready` (an upload that never confirmed) reopens the picker with a warning toast.

### 6.7 Cookie types

A `ResponsiveTable` ordered as returned: leading is the icon (the library icon's image at 32 px, "media" for a media asset, or "none"), title is `name`, an "Active" chip, lines are `sort` and `cookieCount`, actions are the edit pencil (a dialog with `name`, `sort`, `active`, and an icon row with Choose and Clear that opens the shared icon picker at `components/content/pickers/IconPicker`) and the row menu with Delete, plus the Audit cell. On a phone the rows are cards with the same leading icon, title, chip, lines, and actions. Delete opens `DeleteDialog` (8.3): the impact preview carries the cookie count that would go with the type. "New type" opens the same dialog with `active` default on. `active` off removes the type from the snapshot without deleting it. The icon picker is one component used by every icon field in the panel: a Library tab (a search box over name, id, and tags with a grid of tiles that show the icon image and name), a Media library tab over `MediaGrid` fixed to `state=ready` with no kind filter so any ready image can be an icon, and an Upload tab that runs the uploader inline and picks the asset the moment it is ready; Cancel and Choose sit under the tabs, Choose enabled once something is selected.

**Locked while live**: the page fetches `keys.events` on entry. When any event has `statusId === 3`, a `CommentBox` (warning) at the top reads "Locked: <event name> is live. Cookie types can be created, edited, and deactivated again after the event ends." and "New type" and every edit pencil are disabled. A `409 event_live` from a create or patch (the list was stale) shows the same banner and refetches `keys.events`.

### 6.9 Settings

One row per key from `GET /admin/settings`, in this order (unknown keys last), with the description shown next to the input:

| Key | Description shown | Range | Unit |
|---|---|---|---|
| `poll_interval_ms` | How often the public site polls the CDN | 1000 to 60000 | ms |
| `cookie_limit_per_person` | Cookies one person may leave per event (hidden ones count) | 0 to 1000 | |
| `sponsor_linger_ms_per_dollar` | Sponsor carousel time per dollar donated | 0 to 100000 | ms |
| `sponsor_linger_min_ms` | Minimum sponsor carousel time | 0 to 600000 | ms |
| `beacon_stale_after_s` | Seconds without a heartbeat or location before a beacon is flagged stale | 15 to 3600 | s |
| `flight_history_max_points` | Most points of the flight history carried in the snapshot (longer recordings are thinned) | 100 to 50000 | |
| `location_min_interval_ms` | Least time between two accepted fixes from one beacon (0 disables) | 0 to 60000 | ms |
| `location_min_distance_m` | a fix that moved less than this from the last recorded one is shown live but not recorded (0 records every new position; a position already recorded for the event is never recorded twice) | 0 to 10000 | m |
| `hub_enabled` | Whether visitors' browsers use the hub; off takes every visitor onto the poll within one poll | on or off | |

The rows sit in a `ResponsiveTable`: title is the key in `<code>`, subtitle is the description, lines are `updatedBy` and `updatedAt` ("default" when null), and the actions cell carries a number input with the range as helper text next to its own Save button (`PUT /admin/settings/{key}` with `{ value }`), or for a boolean key a switch labelled on or off that saves the moment it is flipped; the Audit cell sits at the end. On a phone the rows are cards with the value input and Save button on one row inside the card. Validation per 7.2; the response `Setting` replaces the row. A `CommentBox` states that every save rebuilds the snapshot and rewrites the live object, so a new poll interval reaches the site within its next poll. The specs live in `validation/settings.ts`.

### 6.10 Subscribers

Header counts from `GET /admin/subscribers/summary` as chips: verified, pending, unsubscribed; the summary chips and the filter wrap under the header on compact. Filter: All, Verified, Pending, Unsubscribed (maps to the `status` query, absent for All). Paged `ResponsiveTable`: title is `personEmail`, lines are `address`, `channel`, `verifiedAt`, `unsubscribedAt`, and `createdAt`, actions are a delete icon (`DeleteDialog`, 8.3), and the Audit cell. On a phone the rows are cards with the same title, lines, and delete icon.

**Export CSV** walks the list for the selected filter with `limit: 500`, following `nextCursor` until it is `null`, showing "Exporting: <n> rows" on the button meanwhile, then builds the CSV with header `id,personId,personEmail,channel,address,verifiedAt,unsubscribedAt,createdAt` (RFC 4180 quoting, CRLF, `null` as empty) and saves `subscribers-<filter>-<yyyyMMdd>.csv`.

### 6.11 People and contact messages

`/people`: paged `ResponsiveTable` with title `email`, lines `cookieCount`, `createdAt`, and `lastSeenAt`, actions are a delete icon, and the Audit cell. `/contact-messages`: paged `ResponsiveTable` with title `name`, lines `email` (as a `mailto:` link), `createdAt`, `clientIp`, and the `body` as a wrapped line, actions are a delete icon, and the Audit cell. On a phone the rows are cards with the same title, lines, and delete icon. Both deletes open `DeleteDialog` (8.3); the impact preview states what goes with the row.

### 6.13 Pages

`/pages`: a `CommentBox` ("Changes here are drafts until you publish.") and two `ResponsiveTable`s. **Status pages**: the seven role pages in status order (No event, Planned, Scheduled, Live, Ended, Cancelled, Postponed), each with the role chip, title (link, after a 20 px `IconPreview` of the page's Menu icon when one is set), section count, problem count (a red chip when non-zero), an edit pencil that opens the editor, and the Audit cell; they have no settings icon and no row menu. **Pages**: the `none` pages in nav order, leading is up and down arrow buttons (each press swaps two rows and sends the whole order as `PUT /admin/pages/order`), title is the title (link, after the same Menu icon preview when one is set), subtitle is the slug, chips are the hidden state and the problems chip, lines are the nav label (or "not in nav") and the section count, actions are the edit pencil, a settings icon (`PageSettingsDialog`: `slug`, `title`, `navLabel` behind a "Show in navigation" checkbox that defaults the label to the title, the Menu icon, `isHidden`; `PATCH`, which always sends `icon`, null when cleared), and a row menu with Delete (`DeleteDialog`, 8.3), plus the Audit cell. On a phone the rows are cards with the same leading, title, subtitle, chips, lines, and actions. "New page" opens `PageCreateDialog` (`title`, `slug` auto-derived from the title until edited, "Show in navigation" with an optional nav label, and the optional Menu icon, sent as `icon` or null); success opens the editor. The Menu icon (`icon`, `PageIconField`) is the same in both dialogs: the label "Menu icon", the picked icon's `IconPreview` or "None", a Choose button that opens the shared icon picker (titled "Choose menu icon"), a Clear button while one is set, and the help "The site shows this beside the page in the mobile menu." under it; a new pick keeps the current icon's `display`. Role pages edit it the same way through the editor's "Page settings" (6.14). The dialogs' labels and help come from `PAGE_SETTINGS_LABELS` in `labels.ts`. Beside it in the header a "Preview site" button opens `PreviewFrame` (6.17) at the home page, with the "Start at" select and the Share menu, to look over every draft change across the site before publishing.

### 6.14 Page editor

`/pages/:id`, the panel's main surface. The header goes through `PageHeader`: title = the page title, subtitle = `/slug`, chips = the problems chip ("No problems" green, or "<n> problems" red, from `problemCount` on the page), actions = a "Preview" toggle button, a "Page settings" button (`PageSettingsDialog`, available on every page), and a "Publish" button that navigates to `/publish`. Below it the section stack; under the stack an "Add section" button.

**Preview**: on viewports at least 1280 px wide the "Preview" button toggles a `PreviewPane` (6.17) as a right-hand column beside the editor: the editor column is 560 px wide and the pane takes the rest of the width, default device Desktop, with a "Preview" heading and a Close button over it. Both columns fill the viewport height under the app bar and scroll on their own, so the pane stays in view while the editor scrolls. Below 1280 px the button opens `PreviewFrame`, the full-screen dialog on a phone. Either way the preview starts at the page being edited (`page=<slug>`) and has no "Start at" select; the site-wide preview is the "Preview site" button of the Pages list (6.13) and Site settings (6.16). The pane's Share menu (6.17) opens the edited page in a new window, or copies a link to it, that lasts up to 24 hours. After any save in the editor finishes (section data, presentation, and hidden state, items, item order, section order, add, duplicate, move, delete, page settings) the preview reloads once, 1.5 s after the last save; the frame stays mounted while its URL changes, and the frame's own scroll position is not read since the site is another origin. Whether the column is open is kept in localStorage under `pageEditorPreviewOpen` (read and written inside try/catch, so a blocked storage only loses the memory), and a returning editor on a wide screen finds it as they left it; the dialog is never opened on its own.

**Section stack**: one `SectionCard` per section in order, spaced apart so each card reads as one unit. A card whose kind is not in `keys.kinds` renders an error alert "Unknown kind: <kind>" instead. Above the stack sit "Expand all" and "Collapse all" buttons that apply to every card in the stack. "Add section" opens `SectionPalette`, full screen on compact: every kind from `keys.kinds` in the order returned as a full-width button with title and description, kinds whose `allowedRoles` exclude this page's role disabled with the tooltip "Not allowed on the "<role>" page"; choosing one calls `POST .../sections { kind, data: defaults }` and the new card appears at the end, expanded by default.

**Section card**: an outlined MUI `Card` with a visible border in both themes and a tinted header bar. The header holds a chevron, the numbered title "<n> · <kind title>" where n is the section's position in the stack, a one-line summary in secondary text drawn from the data (`rich_text`: the block kinds in order, e.g. "Heading, paragraph, list of 4"; a kind with items: "<n> items"; `hero`: the title text; every other kind: the heading when the data has one; every summary text is shown as the site shows it, with inline markers removed and event placeholders filled from the current event by `inlineToPlainText`, which shares the inline preview's parser), a "Live" chip for live kinds, a "Hidden" chip when `isHidden`, the problems badge, the save state ("Saving…", "Saved", "Not saved"), a Hidden switch (`PATCH { isHidden }` at once), up and down arrows (a press swaps two sections and sends the whole order as `PUT .../sections/order`), and a menu next to them (Duplicate, Move to page in `MoveSectionDialog`, Delete in `ConfirmDialog`, "Delete the <kind> section? This cannot be undone."). Clicking the header toggles the card between collapsed and expanded; every card starts collapsed except a section just added, and the collapsed set lives in component state (it is not persisted). When expanded the card body renders the tabs (Content and Presentation): Content renders `SchemaForm` over the kind's `schema` and, for kinds with items, `ItemsEditor`; Presentation renders `PresentationPanel`. Under the tabs, `ProblemList` with the section's problems from the page response, and a "Save now" button. Content edits are saved on blur and on a 1 s debounce with `PATCH { data }` (`useDebouncedSave`); presentation edits on the same debounce with `PATCH { presentation }`; an unmount flushes both. A `400 validation_failed` lands on the named field through RJSF's `extraErrors` (`lib/fieldErrors.ts` turns `details.fields` JSON pointers into an `ErrorSchema`).

**`ItemsEditor`**: a sortable list (`@dnd-kit`, plus up and down buttons per row) of `SchemaForm`s over the kind's `itemSchema`. Each item is a nested outlined `Card` visibly indented inside the parent section card, with a different background shade; its own tinted header carries the drag handle, up and down arrows, "Item <n> of <m>" and a short summary (its `label` or the link's label, when set), a Hidden switch, and a remove icon on one row, with the form under the header. A hidden item's card is dimmed and carries a "Hidden" label in the header. "Add item" posts the kind's `itemDefaults`. Every change to an item's form sends `PATCH /admin/items/{id} { data }` at once; flipping the Hidden switch sends `PATCH /admin/items/{id} { isHidden }` at once and does not send `data`. There is no debounce and no duplicate on items.

**`PresentationPanel`**: a "Show in a card" switch, on when `card` is not `false` (every section is carded by default); turning it off writes `card: false` and on writes `card: true`, and a hint under it reads "Cards are always the standard width". Then selects for Width (Full, Wide, Narrow), Align (Start, Centre), Spacing (Tight, Normal, Loose), Background (None, Colour, Image; the Colour select carries Surface, Muted, Accent, Night); the Image branch renders the picked media (a `MediaPreview` or "No media", a Choose button that opens `MediaPicker`, and an "Alt text (leave empty to use the image's own)" field) and a "Darken the image so text stays readable" slider from 0 to 1 in steps of 0.05 with the percentage shown; picking Image opens the picker at once and cancelling it returns Background to its previous value, so an empty media reference is never stored. Icon before and Icon after each show an `IconPreview` next to a Choose button (opening the shared icon picker) and a Clear button when set; under them, only when either icon is set, an "Icon size" select (Small, Medium, Large, Extra large) writes `iconSize` (`sm`, `md`, `lg`, `xl`), and an absent value reads as Small. A text field for "Anchor (for links like /page#anchor)". Width shows only when the card is off, since a carded section is always the standard card width; while it is hidden the stored value is left untouched. The panel takes the section kind as a prop: for `map` (which the site never cards) both the card switch and Width are hidden. Right under the card switch, only while the card is on, a "Card opacity" row holds Light and Dark number fields (`cardOpacityLight`, `cardOpacityDark`, integers 0 to 100, clamped on blur, an empty field removes the key, helper "Empty uses the sitewide value"), side by side and stacked on compact; turning the card off hides the row and leaves the stored values untouched. The hero's own `iconSize` (the icon above the title) is a field of the hero form: an "Icon size" select with the same four sizes, placed right after Icon through the `ui:order` that `SchemaForm` takes from `orderFor` in `labels.ts`. Between Icon and Icon size sits a "Show the site logo instead of the icon" switch (`showLogo`, help "Uses the logo from Site settings"), read as off while absent or null through `DefaultedSwitchWidget`. While it is on, the Icon field shows the hint "Not shown while the site logo is on" and the size select reads "Icon or logo size". Every field is full width so it uses the whole card width on compact.

**`DisplayControls`** (`src/components/content/DisplayControls.tsx`): a collapsed "Advanced" section, reading "Advanced (customised)" while any key is set, under every icon and media picker once a value is picked: `IconField`, `MediaField`, `LinkField`, the block `IconControl` (heading, list, and icon blocks), the media block, the `LinkControl` icon, `PresentationPanel`'s Icon before and Icon after (one each), and its background image. It edits the reference's `display` object: Size (px) writes `sizePx` (12 to 600, hint "Empty uses the normal size"), Fit writes `fit` (Contain, Cover), Shape writes `shape` (None, Circle, Rounded, Square), Padding (px) writes `paddingPx` (0 to 48), Background writes `background` (None, Surface, Muted, Accent, Night), the Shadow switch writes `shadow: true`, and Alignment writes `align` (Start, Centre, End). An empty number, a select's "Default" option, and the Shadow switch turned off remove their key; numbers out of range are clamped on blur. The object holds only the keys that are set and `display` is removed when none are; Reset removes `display`. Picking a new icon or image keeps its `display`. `SchemaForm` routes `#/$defs/Display` and `#/$defs/DisplayNullable` to a field that renders nothing, so no raw display fields appear.

**`SchemaForm`** is `@rjsf/mui` with `validator-ajv8`, `liveValidate`, no error list, no submit button, and `constAsDefaults: "skipOneOf"` in its default form state behaviour, so an optional `oneOf` object (a viewpoint's `Icon`) stays absent instead of taking the first branch's `const` as a default. The schema is first bundled (`schemas/bundle.ts` rewrites the primitives `$ref` URLs to local `#/$defs/...`, merges the primitives' `$defs`, and drops `$schema` and `$id`), then reduced to the draft level (`schemas/draft.ts` removes `required`, `minLength`, `minItems`, and `minimum` at every level and keeps everything else), so an editor sees type errors immediately and incompleteness only as a publish problem. A custom `SchemaField` routes by the schema's `$ref`:

| `$ref` | Field | Behaviour |
|---|---|---|
| `#/$defs/Inline`, `#/$defs/InlineNullable` | `InlineField` | The shared `InlineText` editor: a text input with a compact toolbar (Bold wraps the selection in `**...**`, Italic wraps in `*...*`, Link asks for the address and wraps the selection as `[label](href)`, Insert icon opens the shared `pickers/IconPicker` and inserts `{icon:<id>}` or `{icon:media:<id>}` at the cursor, Insert event field is a menu with Event name, Year, and Scheduled time that inserts `{event:name}`, `{event:year}`, or `{event:scheduledAt}`; every toolbar button has a tooltip). Under the field a one-line preview renders the same constructs the site does through the pure `renderInlinePreview` (bold, italic, code, links as underlined text, icons as 16 px `IconPreview` images, and the event placeholders filled from the events list's current event; `scheduledAt` is formatted by `formatStamp` in the viewer's zone); with no current event the preview reads "(no current event)" in grey. Never uses innerHTML. A character counter appears only within the last 10 percent of `maxLength` (default 5000); an empty value on a nullable schema is sent as null. The same `InlineText` replaces the plain text fields used for every block's Inline value (heading text, paragraph text, quote text and attribution, list lines, media caption, and link label). |
| `#/$defs/Icon`, `#/$defs/IconNullable` | `IconField` | The current icon as an `IconPreview` (a 32 px image: the library url from `icons.list()`, or the smallest media variant from `media.get(id)`; a missing asset is a warning-bordered "Missing" box with the id in a tooltip) beside the icon's name (library) or filename (media), or "None"; a Choose button opening `pickers/IconPicker` (a Library tab with a search box over name, id, and tags plus a grid of image tiles, a Media library tab over `MediaGrid` fixed to `state=ready` with no kind filter, and an Upload tab that picks the asset the moment it is ready); Clear on nullable schemas |
| `#/$defs/MediaRef` | `MediaField` | The current media as a `MediaPreview` (a thumbnail from the smallest variant or `url`, 96 px tall with `object-fit: contain`, with the filename and dimensions under it; the same "Missing" placeholder for a missing asset) or "No media", a Choose button opening `MediaPicker`, and an "Alt text (leave empty to use the image's own)" field (empty means null) |
| `#/$defs/Link` | `LinkField` | Label and Href text fields, an icon line with `IconPreview` next to the icon's name (or "none"), a Choose icon button (the same icon picker) and a Clear button (both MUI `Button`s), and an "Open in new tab" checkbox |
| an array whose `items` is `#/$defs/Block` | `BlocksField` | A sortable list of blocks. Each row header has the drag handle and up and down arrow buttons (same `@dnd-kit` pattern as `ItemsEditor`), a human label (Heading, Paragraph, Quote, List, Divider, Media, Links, Icon), a short summary (heading, paragraph, quote: the first 60 characters of the text; list: "N lines, <style> style"; media: the picked asset's filename; links: "N links, <style>"; icon: the picked icon's name), Duplicate (a deep copy) and Delete. The body dispatches on `kind`: `heading` has Text, a Heading level select (1, 2, 3), and an Icon control (preview, Choose, Clear); `paragraph` has a multiline Text; `quote` has Text and an optional Attribution (an empty value stores null); `list` has a Style select (Bullets, Numbers, Icon), an Icon that shows and is required only for the Icon style (switching away clears the icon), and the lines as one text field per line with up and down arrows, remove (disabled on the last line), and "Add line" (at least one, at most 100); `divider` has a Style select (Line, Snowflakes, Lights); `media` has the picked image (preview, Choose, alt override), an optional Caption (empty stores null), and a Size select (Small, Medium, Full width); `links` has a Style select (Buttons, List) and a list of `LinkControl` rows (Label, Href, an icon line with Choose and Clear, and "Open in new tab") with per-row up, down, and remove and an "Add link" button (1 to 20 links); `icon` has an Icon control (preview, Choose; required, no Clear), a Size select (Small, Medium, Large, Extra large), and an Align select (Start, Centre). Unknown fields on a block are preserved on edit. "Add block" is a select over the eight kinds that appends the block's default shape. |
| an array whose `items` is `#/$defs/Link` (the hero's `links`, and the site settings' `navExtraLinks`, `headerLinks`, and `footerLinks`) | `LinkListField` | The field's label and help from the labels table, then the shared `blocks/LinkList` (the same list the links block uses): one card per link titled "Link N" (or the entry name from the items' `ui:title`, such as "Menu link N") holding a `LinkControl` (Label, Href, the icon line, "Open in new tab"; part labels come from the items' uiSchema), with per-card up, down, and remove, and an "Add link" button that appends `{ label: "", href: "", icon: null, newTab: false }`. The schema's `minItems` and `maxItems` are the bounds: Add is disabled at the maximum and remove at the minimum, and a hint beside Add reads "Up to 2 links" (or "1 to 20 links" when at least one is required). No generic array controls appear |
| `#/$defs/Presentation` | `PresentationPanelField` | `PresentationPanel` as above |
| a two-branch `oneOf` where one branch is `{ "type": "null" }` and the other is one of the routed primitive `$ref`s above | `OptionalField` | A `Switch` labelled with the field's label; off writes `null` and hides the editor, on writes the primitive's empty value (`Link` starts at `{ label: "", href: "", icon: null, newTab: false }`; `MediaRef` at `{ mediaId: "", alt: null }`) and shows the primitive's routed editor under the switch |

`ThemeField`, `ViewpointsField`, and `PlacesField` are registered by name for `uiSchema` use (6.16). Everything else (strings, numbers, booleans, enums, nested objects, arrays of scalars) is the generator's default MUI widget, so a new field in a kind schema appears in the panel with no panel change. The map section adds `MapStartView` above its `SchemaForm`: a Google map 300 px tall (`@googlemaps/js-api-loader` on the same key, `loadMaps`) showing the current `defaultCenter` and `defaultZoom`, panning or zooming writes those two values back on `idle` (centre rounded to five decimals, zoom to an integer), the three number fields under it still take exact entries and move the map when edited, and with the Maps key absent or the loader failing only the number fields remain, under a one-line note.

The `route_preview` form follows the vendored schema: it holds `heading`, `disclaimer`, and `emptyText` and nothing more, with no style select (the site always draws the route map). How the route map draws (the display knobs and the map buttons) is set per event in its `routeMapConfig` through the event's Route map dialog (6.3), and the landmarks and places it draws are sitewide, in Site settings (6.16); the section form has no route map group.

The map section's overlays list ends with "Online count" (`overlays.onlineCount`, help "How many people are watching, while the event is live and sockets are healthy"), a `DefaultedSwitchWidget` that reads on while the key is absent and writes `false` when switched off.

The map section's controls (`controls`, "Controls", help "The small buttons and switches on the map itself.") are switches labelled "Show the theme picker", "Show the terrain switch", "Show the snow switch", "Show the flight history switch", "Show the time labels switch", "Show the my-location button", "Show the data row", and "Viewpoints toggle" (`controls.landmarks`, help "Lets visitors hide the viewpoints on the tracker."). The Viewpoints toggle is a `DefaultedSwitchWidget` that reads on while the key is absent and writes `controls.landmarks` (`false` or `true`) when flipped; the viewpoints it hides are the sitewide list of Site settings (6.16). The map section has no place filter: the places the tracker labels are sitewide, Site settings "Places on the maps" (6.16). A `when` rule with `is: "off"` holds for `false`, null, and absent. An array of enum values renders as checkboxes (`HintedCheckboxesWidget`, the MUI group with the hint line under it) unless its labels entry is `ordered`, in which case it stays a multi-select that writes values in the order picked (`event_times.fields`, the map's `themes`).

**Labels and help text**: every content form's field labels, enum display names, and one-line help text live in `src/components/content/labels.ts`, one entry per field path per section kind (and per item schema). `SchemaForm` reads the entries for the kind it is rendering, builds a `uiSchema` with `ui:title`, `ui:description`, and `ui:enumNames`, and hides the schema-level root title so a "<kind> section data" heading never appears. The custom fields (Inline, Icon, Media, Link, Blocks, Optional) read the label from the same `uiSchema`. A vitest test walks every vendored section and item schema and fails when any field is missing from `labels.ts`. The walk stops at a `$ref`, so the five display knobs of RouteMapConfig have their own test: each has a label, one line of help, and a name for every contract value in `ROUTE_MAP_DISPLAY_LABELS`, which the event Route map dialog's `RouteMapDisplayControls` reads. The page create and settings dialogs read their labels from `PAGE_SETTINGS_LABELS` ("Slug", "Title", "Nav label", "Menu icon" with the help "The site shows this beside the page in the mobile menu.", "Hidden"), and a test there fails when a field of `CreatePageRequest` or `PatchPageRequest` other than `navPosition` has no entry. The media detail drawer's text fields read their labels from `MEDIA_DETAIL_LABELS` ("Alt", "Title", "Credit" with the help "The site shows this under the photo."), and a test there fails when a text field of `MediaPatchRequest` in the vendored `openapi.json` has no entry. The Seed cookies card (6.3) reads its title, help line, and count label from `SEED_COOKIES_LABELS`, and a test there fails when a field of `SeedCookiesRequest` or `CookiePick` other than `cookieTypeId` has no entry. The same file checks that the route_preview table holds only `heading`, `disclaimer`, and `emptyText` and the site settings table has no `routeMap` entry. An entry with `unset` (the hero's icon size) renders through `DefaultedSelectWidget`: an absent or null value shows that option's label ("Small") and nothing is written until an option is picked. An entry with `switchDefault` (the hero's `showLogo`, the map's `controls.landmarks`, the site settings' `headerShowsSiteName`) renders through `DefaultedSwitchWidget` the same way: an absent or null value shows that default and nothing is written until the switch is flipped. An entry's `when` rule names another top-level field of the same form and, while that field is unset (absent or null) or on (`true`), disables the field, adds a hint under it, or swaps its label; `SchemaForm` applies the rules to the uiSchema on every change. `OptionalField` shows the entry's help under its switch.

### 6.15 Media library

`/media`: an `Uploader` drop zone at the top and a `MediaGrid` below with filters (search, kind, state) backed by `keys.media(q)` as an infinite query. The grid is `repeat(2, 1fr)` on `xs` and widens with the viewport so a phone gets two cards per row without overflow.

**Upload** (`useMediaUpload`): for each dropped or chosen file, the client pre-check (7.4: type by magic bytes, size against 20 MB or 1 MB) runs first; then `POST /admin/media/upload-url`, `uploadToS3` with a progress bar, `POST .../confirm`; the row under the drop zone shows "Checking file", "Queued", "Requesting upload URL", "Uploading <n>%", "Confirming", "Ready", or the failure reason with a Retry that repeats confirm (when only that step failed) or the whole sequence (a pre-check refusal has no Retry). Several files upload in parallel, at most three at a time. Alt and title can be typed before the upload starts and are sent on the ticket; the two fields sit side by side on desktop and stack full width on compact. "Clear completed" removes the ready rows. Filenames are sanitised to letters, digits, dots, dashes, and underscores, at most 100 characters.

**Card**: the 480 px variant (or the original for svg and gif), filename, dimensions, size, kind chip, a "Deep zoom" chip when `dziUrl` is set, a "Dark" chip when the asset has a dark mode version (`darkMediaId`) or an "Inverts" chip when it only inverts (`invertInDark`), a "Credit: <credit>" line under the size when the asset has a saved `credit`, state chip (pending grey, ready none, orphaned amber with "Expires in N d"), and an edit pencil. The pencil and a click on the card open `MediaDetailDrawer` (right-anchored, 480 px on desktop and full width on `xs`): the original, kind, state, and dimensions, `alt`, `title`, and a Credit field (`credit`, at most 200 characters, with the help "The site shows this under the photo."; an empty field saves null, so the asset has no credit) editable and saved together with one Save (`PATCH`, the drawer then shows the credit the API returns), a Dark mode section, the original, every variant, and the deep-zoom descriptor as links with a copy-URL button each (the variant rows break long URLs), a `UsageList` from `GET .../usage` (draft pages as links to their editors, version count, sponsors, cookie types, and site settings), and Delete. Delete opens `DeleteDialog` (8.3), whose impact preview lists what the asset unlinks from; the delete is never refused for a reference. A link to `/media?id=<id>` reads `GET /admin/media/{id}` and opens the drawer on that asset.

**Dark mode** (in the drawer): "Dark mode version" shows a `MediaPreview` of the chosen asset or "None", with Choose (opens `MediaPicker` with the asset itself left out of the grid) and Clear; below it an "Invert in dark mode" switch with the help "For one-colour images: flips the colours when the site is dark. Ignored when a dark version is set." Both are off by default. Each change saves at once through `PATCH /admin/media/{id}` (`darkMediaId`, `invertInDark`) and refreshes the asset and list queries; a refusal (409 when the chosen asset is not ready, 400 when it is the asset itself) shows inline under the section. Directly below it, "Small screen version" works the same way (a `MediaPreview` or "None", Choose, Clear writing `null`, `PATCH` with `smallMediaId`, a 409 or 400 inline under it) with the help "Drawn in this image's place on screens under 760 px wide."

**`MediaPicker`** (used by `MediaField`, the sponsor logo): a dialog (full screen on compact) with a Library tab (the same grid fixed to `state=ready` plus the kind the caller passes, with the search box; two columns on compact) and an Upload tab that runs the uploader inline and picks the asset the moment it is ready; Choose confirms a grid selection.

### 6.16 Site settings

`/site-settings`: the header goes through `PageHeader` with actions = "Preview site" (6.17; the same dialog as the Pages list's button, opening at the home page with the "Start at" select and the Share menu) and Save (enabled once the form is dirty; a media reference whose switch is on but whose asset was never picked is sent as null, `emptyMedia.ts`, because the API rejects an empty id on its pattern). Below it one `SchemaForm` over the vendored `site-settings.schema.json` at the draft level, with the same custom fields plus `ThemeField` for the theme object through `uiSchema` (three switches, "Snow on by default", "Lights on by default", and "Ornaments in the background", with the caption "Colours and fonts are part of the site design; visitors pick light or dark themselves."; the field spreads the incoming value so any theme key it does not know is kept on save; under the switches a "Card opacity" row holds Light and Dark number fields, `theme.cardOpacityLight` and `theme.cardOpacityDark`, integers 0 to 100 clamped on blur, where an empty field removes the key so the site uses 100, with the helper "100 is a solid card; lower lets the backdrop show through"); `footerText` gets three rows and the form's fields are already full width so the page fits a phone without change. Every field, the fields of each extra menu link, header link, and footer link included, takes its label and one line of help from the `SITE_SETTINGS` table in `labels.ts` ("Site name", "Tagline", "Label for the home link in the menu", "Logo", "Browser tab icon", "Extra menu links", "Header links", "Footer links", "Footer text", "Contact email", "Donate page address", "Count visits (analytics)", "Site logo", "Show the site name next to the logo", "Viewpoints", "Places on the maps"; each link entry shows "Link text", "Web address", "Icon", and "Open in new tab" under "Menu link", "Header link", or "Footer link"), which `SchemaForm` turns into a `uiSchema` merged with the page's own; the completeness test covers this schema too. The two logo fields sit right after Site name, "Header links" right after "Extra menu links", and "Places on the maps" right after "Viewpoints", last (the page's `ui:order`, `SITE_SETTINGS_ORDER` in `labels.ts`). "Header links" (`headerLinks`, 0 to 3 `Link` entries) is the list of prominent links the site draws in its header on every page, such as the Facebook page; its help reads "Prominent links shown in the site header on every page, up to three, such as the Facebook page." and it uses the same `LinkListField` as the other link lists. "Site logo" (`logoMedia`) is the optional media field: a switch, then while on a `MediaField` with its preview, Choose, and alt text; its help reads "Shown in the header, and in any hero set to show the site logo. Upload an SVG or a transparent PNG." "Show the site name next to the logo" (`headerShowsSiteName`) is a `DefaultedSwitchWidget` that reads on while the value is absent or null and writes only when flipped; while no logo is set it is disabled with the hint "Set a site logo first". "Viewpoints" (`landmarks`, 0 to 50 `Landmark` entries; the key keeps its name) is the sitewide list of good spots to watch Santa fly over, drawn on the route preview and the live tracker; its help reads "Good spots to watch Santa fly over, drawn on the route preview and the live tracker." The page's `uiSchema` hands it to `ViewpointsField` (`ui:field`), which renders `ViewpointsEditor` (below) with the label and help from the labels table and writes the whole list to `landmarks`; an empty list writes the key absent, so an unset list saves without it. "Places on the maps" (`places`) is the sitewide choice of the places each map labels; its help reads "Which places each map labels. The two lists differ because the two maps sort places differently." The page's `uiSchema` hands it to `PlacesField` (`ui:field`, registered in `SchemaForm`'s `FIELDS` beside `ViewpointsField`), which shows two groups, each a `PoisEditor` (below): **Live tracker** (`places.tracker`, help "Default shows the places the map style draws. Custom shows only the kinds you check.") over `TRACKER_KINDS`, the nine Google kinds one per category, Attractions, Businesses and shops, Government, Medical, Parks, Churches, Schools, Sports, and Transit; and **Route map** (`places.routeMap`, help "Default shows no places. Custom labels only the kinds of places you check.") over `POI_CATEGORIES`, the nine OpenStreetMap categories. Default in a group writes `places` without that group's key; Custom writes `{ kinds }`. With both groups on Default the field writes `places` absent, so the saved document carries it only when set (`withPlacesPart` in `places.ts`). The form has no route map group: how the route map draws is set per event (6.3), and the event's Route map dialog previews the route map places set here.

The **places** editor (`PoisEditor`, one per group): a Default / Custom radio pair. Default reports no key. Custom shows one checkbox per category of its `categories` prop (`POI_CATEGORIES` unless given) and reports `{ kinds }`, the union of the checked categories' kinds, each kind once; Custom with nothing checked reports `{ kinds: [] }` (no places show) and reads "Nothing checked: the map shows no places." The categories are two commented tables in `src/components/content/places.ts`. `POI_CATEGORIES`, the route map's, are each a human label over the `kind` values the basemap tiles carry on their `pois` layer (the OpenStreetMap amenity, shop, tourism, or leisure value): Groceries and stores, Food and drink, Parks and playgrounds, Schools, Churches, Health, Gas and convenience, Hotels, and Fun and attractions; a kind may sit in two categories (`convenience` is a store and a gas stop). `TRACKER_KINDS`, the tracker's, are the nine `PlaceKind` values of the contract, one per category. A stored list reads as Custom with each category checked whose every kind it holds; a stored kind no category names is kept on later changes.

The **Viewpoints** editor (`ViewpointsEditor`): one outlined row per viewpoint with a small preview of its icon when one is set (`IconPreview` at 24 px), its name and point (five decimals), then Move up, Move down, Edit, and Delete buttons (labelled "Move <name> up", and so on); under the rows "Add viewpoint" and the count "<n> of 50". Add is disabled at 50, the schema's `maxItems`. Add and Edit open `ViewpointDialog` (full screen below `sm`): the line "Click the map where the viewpoint is, then name it.", `ViewpointPicker`, a Google map 300 px tall on the site's key (`loadMaps` and `loadMarkers`, the places pages' loader) where a click places a draggable pin, then Latitude and Longitude fields the pin fills and that move it when typed into, a Name field (up to 80 characters, helper "Shown beside the dot on the route map"), an optional Icon (`IconControl`, the shared icon picker over library icons and media images, with Clear and the Advanced display section once one is set), and an optional Description (a multiline field of up to 300 characters, the schema's `maxLength`, whose helper reads "The site shows this when a visitor taps the viewpoint." beside the live count "<n> / 300"; typing past the cap is cut at 300). The map opens on the entry being edited, else on the last viewpoint, else on the map section's default centre, and editing an entry opens its icon and description. Save is enabled once there is a name and a pin and writes `{ name, lat, lng, icon, description }` with the name trimmed and the point rounded to five decimals; `icon` is written only when one is picked and `description` only when its trimmed text is not empty, so clearing either removes its key and an entry without them saves as `{ name, lat, lng }`. With the Maps key absent or the loader failing a one-line note replaces the map and the number fields remain. Deleting the last entry removes the key. The pure list helpers (`toViewpoints`, which keeps a stored icon of the `Icon` shape and a non-empty description and leaves off either of another shape, `makeViewpoint`, which builds an entry with the optional keys only when set, `addViewpoint` refusing at the cap, `replaceViewpoint`, `moveViewpoint`, `removeViewpoint`, `viewpointsValue`) live in `src/components/content/viewpoints.ts`. No generated form shows a schema's own `description` (root or field): `SchemaForm` removes them, since they are developer notes, and only the labels table's help appears. Save sends the whole document with `PUT`; problems from `GET /admin/site-settings` render in a paper above the form. A `CommentBox`: "Settings are drafts until you publish."

### 6.17 Preview

`PreviewPane` frames the preview site and is shared by the "Preview site" dialog (Pages list 6.13, Site settings 6.16) and the page editor (6.14). The site keeps one preview session across pages, so the visitor can follow any link in the frame and every page shows the draft. While it is active it calls `POST /admin/content/preview-token` once and sets the iframe `src` to the token's URL plus `&page=<slug>` (the home page when no slug is chosen); an optional page select labelled "Start at" (Home first, then every page from `keys.pages`) picks the page the preview opens at, and changing it switches the frame without a new token. While the select shows, a one-line hint under the toolbar reads "Click around: every page shows your draft." Its toolbar holds the "Start at" select, a device select (375, 768, or 1200 px frame width; hidden on compact, where the frame is the phone), a Light / Dark / Site default theme toggle (Light adds `&theme=light`, Dark adds `&theme=dark`, Site default, the starting choice, adds nothing so the site decides), the caption "Token expires in <n> min" or "Token expired", a "New token" button that always mints, and a Reload button that changes the frame URL (or mints a new token once the current one has expired). The pane's own token is minted with no body, so it lasts the API's default 15 minutes.

**Share**: a "Share" button in the toolbar opens a small menu (`PreviewShare`) to keep the preview open elsewhere, such as on a second monitor while editing. A "Link lasts" select offers 15 minutes, 1 hour, 8 hours, and 24 hours; the default is 8 hours and the choice is kept in localStorage under `previewShareTtlMinutes` (read and written inside try/catch). "Open in new window" mints a token with `POST /admin/content/preview-token { ttlMinutes }` for that lifetime and opens the site URL (`/preview?token=&page=&theme=`, the same shape the frame uses, so the new window starts a site-wide session at the "Start at" page) with the pane's current `page` and `theme` parameters in a new tab with `noopener`. "Copy link" mints the same way and copies that URL; a snackbar reads "Link copied, valid until <local time>" (with the day when the expiry falls on another day). When the clipboard is unavailable or refuses, the URL appears in a read-only text field with a Select button instead. Each action mints its own token and leaves the pane's token alone. Under the actions the hint reads "The link follows your draft live while it is open.": the site's `/preview` page follows the draft while it is open, so the link stays current without a reload until it expires. A caller can pass a `reloadSignal` number: each change schedules one reload 1.5 s later, and changes inside that window restart the wait. The iframe fills the height the parent gives the pane.

`PreviewFrame` is the large dialog that wraps a `PreviewPane`: a title bar with a Close button over the pane, which is active while the dialog is open. On compact the dialog goes full screen, the toolbar wraps, and the iframe fills the remaining height. The Pages list and Site settings mount it as "Preview site" with the "Start at" select at Home; the page editor mounts it below 1280 px starting at the edited page, with no select and no hint. The frame is the real public site, so it also shows the current live data.

### 6.18 Publish

`/publish`: the `ContentStatus` card at the top: "Published version <id> (<label>) by <email> <age>" (or "Nothing published yet."), "Draft changed <age>", and either "No unpublished changes", "Ready to publish" (green), or "<n> problems block publishing" (red), with a Publish button enabled only when ready. Under it, when there are problems, a Problems paper where every row links to the section (page editor, `#section-<id>`), the page, or site settings. The Publish button opens `PublishLabelDialog` (`src/pages/publish/PublishLabelDialog.tsx`, props `open`, `disabled`, `onCancel`, `onConfirm(label: string | null)`), a `ConfirmDialog` with an optional label (up to 100 characters, blank sends null) and the consequence line "The public site updates within its next poll.", and confirming publishes through `usePublishMutation` (`src/pages/publish/usePublish.ts`: `contentApi.publish(label)`, the "Published version <id>" toast, `keys.contentStatus` and `keys.versions` invalidated, and the status refreshed on `content_invalid`); the bar's Publish button (6.1) uses the same dialog and mutation. Success shows the new version and refreshes the list. `409 content_unchanged` shows "Nothing to publish"; `422 content_invalid` refreshes the status and shows "The draft has publish problems; the list above was refreshed."

**Versions**: a `ResponsiveTable` of the newest 50: title is the id and label with the "Published" chip on the one whose id matches the status card, lines are publisher, time, page and section counts, actions are the row buttons, and the Audit cell. Row actions: View (a dialog with an Overview tab, site settings as JSON and pages with their section kinds, and a Raw JSON tab in `ThemedJsonView`), Restore (`ConfirmDialog`: "Replace the current draft with version <id>? Unpublished changes are lost. Nothing is published until you publish."), and Restore and publish (the two calls in sequence with the label "Restored from version <id>", confirmed the same way with the added line "The public site updates within its next poll."); the three buttons wrap on compact. On a phone the rows are cards with the same title, lines, and actions.

### 6.19 Auth pages

`SignIn`, `Callback`, `NoRole`, `MfaSetup`, `ConfigError` per section 3. Each renders the title, the environment badge, and one action; none fetches from the API.

### 6.20 API keys

`/api-keys`, `admin` only. Lead text: "Keys let a script or an agent, such as Claude Code, configure the site without signing in. A key is shown once."

**List**: a `ResponsiveTable` newest first: title is the name, subtitle is `keyPrefix` in monospace, chips are the status (Active, Expired, or Revoked; revoked rows greyed) and the capability chips ("All" or the list as chips with plain-word labels), lines are `expiresAt` (a stamp in the viewer's zone, or "Never"; red when past), `lastUsedAt` as an age, `createdBy`, and `createdAt`, actions are the row menu with Revoke (absent on revoked rows), and the Audit cell. On a phone the rows are cards with the same title, subtitle, chips, lines, and row menu. Revoke confirms with "Revoke <name>? Anything using it stops working immediately." "New key" opens `ApiKeyCreateDialog`.

**ApiKeyCreateDialog**: `name` (text, 1 to 100); an "All capabilities" switch (on by default) that, when on, disables the individual list and sends `allCapabilities: true` with an empty `capabilities`, and otherwise a checkbox per capability from the contracts list, labelled in plain words (Events, Flight recordings, Beacons, Sponsors, Cookie types, Pages, Sections, Site settings, Publish and versions, Media, Icons, Settings, Contact messages, Subscribers, People, Diagnostics, Audit, QR codes and places), at least one required; and a "Never expires" switch (on by default) with an `expiresAt` datetime-local validated at least one hour ahead. `409 name_taken` is a field error on `name`. Success opens `KeyRevealDialog` (the same component the beacons page uses, without the QR block).

### 6.21 Agents

`/agents`, `admin` only. The page for running an agent (Claude Code or any script) against the admin API for one session. Lead text: mint a key with only the capabilities the job needs, give the agent the key and the prompt, let it work, then revoke the key. An info block spells out the four steps (mint, hand over, work, revoke) and why revocation is the only lasting control: keys are hashed at rest, cannot mint or revoke keys, and skip the TOTP gate.

Below it the page mounts `ApiKeysList` unchanged (the same component as `/api-keys`, so minting and revoking happen in place; on a phone the keys are cards for the same reason), then the **Agent prompt**: `pages/agents/agentPrompt.ts` exports `buildAgentPrompt(baseUrl)`, one plain-text guide to the API for an agent in twelve sections, in this order: 1 identity and secrecy; 2 base URL and auth (the `wak_` bearer header, 401 against 403, and the five Cognito-only routes: `GET /admin/api-keys`, `POST /admin/api-keys`, `POST /admin/api-keys/{id}/revoke`, `GET /admin/api-keys/{id}/impact`, `GET /admin/email/quota`); 3 wire conventions (JSON, status by verb with the POSTs that answer 200, the error body, every error code grouped by status, paging names and caps, timestamps, ids, money, PATCH and the empty-string clear rule, body limits, rate buckets, audit stamps); 4 what goes public when (the working set against publish, the snapshot-affecting writes, what is never public); 5 the 18 capabilities with the routes each reaches; 6 the content model (pages and roles, sections and every presentation key, items, the primitives `Icon`, `MediaRef`, `Display`, `Link`, the inline grammar, every site settings key, draft against publish validation); 7 the endpoint reference by capability; 8 delete safety (the impact preview for every resource, the blocked conditions, cascade against unlink); 9 the media pipeline; 10 the event lifecycle; 11 common workflows; 12 the rules (never change a status, notify, publish, restore, delete, seed cookies, clear locations, touch beacons, or change a setting unless asked; preview the impact before a delete; hand the email quota to the human before a send; read `GET /admin/content/kinds` before writing data; media through the ticket flow; no em or en dashes in copy). The page says the API has three groups (admin, editor, canvasser) and that a key with `qr` reaches the canvasser routes, the two deletes included. It renders the prompt with `config.apiBaseUrl` filled in, in a monospace read-only block with a Copy button (a clipboard failure leaves the text on the page). The prompt is written against the API controllers, not against contracts 4.5 alone; every wave re-checks it against the controllers and corrects it in the same wave. `AgentsPage.test.tsx` asserts it names all 18 capabilities, the five Cognito-only routes, and the POSTs that answer 200, and that it carries no dashes and none of the stale strings "SVG only", "1 to 100", "16 capabilities", and "tight|normal|loose|none".

### 6.22 Audit

`/audit`, its own drawer entry (admin and editor): the filter paper wraps its fields (entity, action, actor, and the "Deletes" chip that toggles `action=delete`) on compact; `entity` reads from `GET /admin/audit/entities` and `action` from the known verbs (`AUDIT_ACTIONS`, which include `cookies_seeded`, the action the API records when cookies are seeded on the live event, 6.3). Under it a `ResponsiveTable` newest first paged with a cursor (Load more): title is the time, subtitle is actor and action (the verbs capitalised, `cookies_seeded` as written), lines are the entity and id (a link to the row's page for events, beacons, sponsors, pages, and QR codes when the entry is not a delete, plain text otherwise) and the same changed-fields summary the history dialog uses, actions are the expand toggle, with the raw before and after JSON rendered under the card when expanded. On a phone the rows are cards with the same title, subtitle, lines, and toggle. Deleted rows are readable here and nowhere else.

### 6.23 QR codes

`/qr-codes` (admin, editor, canvasser): `QrCodesList` renders through `ResponsiveTable` sorted by tag with title = tag (link to the detail), chip = the attached-to place path joined by " › " or the "Unattached" chip (warning when it has scans, muted otherwise), lines = opens (the resolved target with "(from place)", "(own)", or "(default)"), people (unflagged scans), last scan (date, the full time as a tooltip), and printed ("Batch n · <date>"); actions = the pencil and the row menu (Attach…, Detach when attached, Disable or Enable, Delete for admins), plus the Audit cell; inactive rows are greyed. Toolbar (through `PageHeader` actions, wrapping under the title on compact): a "Generate" number field (default 10, 1 to 100) with a "Generate n more" button (`POST /admin/qr-codes { count }`) and "Print sheet", which opens `PrintSheetDialog`: a batch select (default the newest), a size select (50 mm, six per row; 100 mm, three per row; 200 mm, one per row; 300 mm, one per page) with the note "A phone reads a code from about ten times its width.", and a Print button that renders the codes at the chosen size with the tag under each into a print-only stylesheet (`@page` margins, `break-inside: avoid`) and calls `window.print()`. The print stylesheet is unchanged when the dialog goes full screen on compact. Codes are drawn in the browser with the `qrcode` package the panel already uses for TOTP enrolment (`qrRender.ts`), encoding `<VITE_SITE_BASE_URL>/q/<tag>`, error correction M, quiet zone four modules. Attach opens `AttachDialog` (a typeahead over the flattened place paths, full screen on compact). Delete opens `DeleteDialog` (8.3).

**Detail** (`/qr-codes/:id`): the code paper and the settings paper stack in a column on compact and sit side by side on desktop; the code SVG scales to `min(320px, 100%)` with the tag and the address under it, and the size field with the SVG and PNG buttons wraps to a new row when it does not fit; SVG and PNG downloads at a chosen size in millimetres (default 50; the PNG at 300 dpi for that size). Settings paper: attached to (the place path chip with Detach and "Move to another place", or "Unattached" with "Attach…", both through `AttachDialog`), opens (a radio: same as the place, a site page autocomplete over the non-hidden `none` pages, a forward URL field), note (up to 500 characters), an Active switch, printed (read only), and Save (`PATCH`). The history sits under them as a `ResponsiveTable` ("Where it has been": title = place path or "a place since deleted", lines = from, to, people, and "includes n scans from the hour before it was attached" when `earlyScans` is above zero). Three stat papers (people over all attachments, flagged hits, people per day over the last 14 days) sit in one wrapped row of equal thirds on compact (`flexBasis: "30%"`); the daily bar chart of the last 14 days (`DailyChart`, an inline SVG, no chart library) is already fluid.

### 6.24 Places

`/places` (admin, editor, canvasser): the tree as `ResponsiveTable` (`placeHelpers.toTree`; a caret per row with children, expanded by default) with `leading` = the caret or its spacer and the depth indentation applied through `rowSx` as `pl: depth * 2` (the card's left padding on compact): title = name (link), subtitle = description, chip = the location chip ("Pinned" when the row has its own pin, "Uses <ancestor>" when it resolves to one, "Not pinned yet" warning when nothing resolves and the subtree has scans, "No pin" muted otherwise), lines = codes (the tags attached now) and people (the subtree); actions = the pencil and the row menu (New place inside, Move…, Delete for admins), plus the Audit cell. Delete opens `DeleteDialog` (8.3) and removes the place with everything under it; codes hanging anywhere in that subtree become unattached and keep their history (a stay under a deleted place shows "a place since deleted"). Toolbar: "New place" and "Map". `PlaceDialog` (New place, New place inside, Move; full screen on compact): parent picker (an autocomplete over the paths, "(top level)" first; a move excludes the place's own subtree), name (1 to 120), description (up to 500), and opens (inherit, a site page, or a forward URL).

**Detail** (`/places/:id`): a Details paper (name, description, parent picker, opens, Save as `PATCH`) beside `LocationCard`; the two papers already stack at `xs`. The "Opens" radio rows place their autocomplete and URL field on their own row under the radio label at full width on compact. Under them "Codes attached here" (each attached tag as a chip whose delete icon detaches it, and an "Unattached code" autocomplete with "Attach here"); the autocomplete and the button stack on compact. `LocationCard`: the chip "Own pin", "Uses the parent's pin", or "No pin", with the pin's source and who pinned it when set; "Use my location" (the Geolocation API; the accuracy shown; refused fixes worse than 500 m with a hint to search or drag); "Use the parent's pin" (deletes the own location; enabled only with an own pin and a parent); a Places Autocomplete search box (the Places API on the same key); and the pin on a Google map (`@googlemaps/js-api-loader`, the site's key), draggable when the place has its own pin. Every pin write is `PUT /admin/places/{id}/location` with its `source` (`phone`, `search`, or `drag`).

**Map** (`/places/map`): the two selects wrap; an event select (default the current event, "All events" otherwise) and a window select (this event, last 14 days, all time); a Google map (320 px tall on compact, 480 on desktop) centred on the pins' bounds with one circle marker per pinned place sized by its people count (`circleSizeFor`, 24 to 72 px on a square-root scale) with the count inside and a tooltip listing the codes under it with their counts; the side card lists every place with scans in the window (path, people, codes) and the counts of unpinned places and unattached codes with scans, sitting under the map on compact. Pins are read from `GET /admin/places/map`.

### 6.25 Scan

`/scan` (admin, editor, canvasser; the canvasser's landing page): a phone-width column (max 480 px): a camera card (a 3:4 video through the `BarcodeDetector` API where present, else the `@zxing/browser` reader, reading QR codes from the rear camera, with a framing rectangle) and a manual tag field with an Open button under it for when the camera will not cooperate (`extractTag` accepts a bare `qr-<n>` tag or the full `/q/<tag>` URL); a Site card with the target pattern and the number of known codes. A read tag that is unattached opens `AttachSheet` (a bottom drawer): a place picker with "New place" inline (name; parent defaulting to the place chosen), then the pin step: "Use my location" (the phone's fix with its accuracy, then "Pin here"), a Places search, or Skip (the place stays unpinned); Attach then pin, two calls. A read tag that is attached shows a card with where it is and offers Move (the same sheet with the current place preselected) or Done. Every control is reachable with the thumb (the sheet at the bottom).

## 7. Forms and validation

### 7.1 Conventions

- Every string input is trimmed before validation and before sending. An empty optional string is sent as `null`. Required strings fail on empty after trim.
- Length limits count `string.length` (UTF-16 code units), the same unit the API uses.
- Numbers are parsed with `Number()`; `Number.isInteger` where the rule says integer; `Number.isFinite` always.
- Validation runs on submit. Field errors render as MUI `error` plus `helperText`. The submit button is disabled while a mutation is in flight, never on validation state.
- Bodies are built from typed objects (section 4.4), so no unknown field can be sent.
- Server `details.fields` (8.1) are read by `fieldErrorFor` for the fields a dialog maps (`year` on clone, `name` on API keys, `pinnedPosition` on sponsor years); the rest are listed in the form's `ErrorAlert`.
- Hand-rolled validation functions, no form library; MUI `Table`, no data grid.

### 7.2 Rules

| Form | Field | Rule (mirrors the API) | Message |
|---|---|---|---|
| Event create, edit, and clone | `year` | integer, 2000 to 2100 | "Year must be between 2000 and 2100" |
| | `name` | 1 to 200 | "Name is required" / "Name must be 200 characters or fewer" |
| | `scheduledAt` | null or a valid datetime; on edit, cannot be null while `statusId` is 2 | "Required while the event is scheduled" |
| | `fundsPercent` | integer, 0 to 100 | "Must be a whole number between 0 and 100" |
| | route choice (create) | choose implies a selected route | "Choose a route" |
| Status | `statusId` | 1 to 6, not the current status | (buttons for the current status are not shown) |
| | `message` | at most 1000 characters, empty becomes null | (counter) |
| Message | `body` | 1 to 1000 | "Message is required" / "1000 characters or fewer" |
| Route upload | see 7.3 | | |
| Beacon | `name` | 1 to 100 | "Name is required" / "Name must be 100 characters or fewer" |
| | `notes` | 0 to 2000 | "Notes must be 2000 characters or fewer" |
| Sponsor | `name` | 1 to 200 | "Name is required" / "Name must be 200 characters or fewer" |
| | `websiteUrl`, `fbUrl`, `igUrl` | null, or parses with `new URL()` with protocol `http:` or `https:`, length at most 2048 | "Enter an absolute http or https URL" |
| | `contactPerson`, `email`, `phone`, `address` | trimmed; empty becomes null | |
| Sponsor year | `eventYear` | integer, 2000 to 2100 | "Year must be between 2000 and 2100" |
| | `amountDonated` | empty becomes null; otherwise matches `^\d{1,10}(\.\d{1,2})?$` and is at most 1,000,000,000; sent as `Number(text)` | "Amount with at most two decimals, up to 1,000,000,000" |
| | `lingerMsOverride` | empty becomes null; otherwise integer seconds 0 to 600, sent as milliseconds | "Whole number of seconds between 0 and 600" |
| | `pinnedPosition` | empty becomes null; otherwise integer 1 to 1000 | "Whole number between 1 and 1000" |
| | `active`, `canAdvertise`, `anonymous` | booleans, always sent | |
| Media upload | file | raster and gif at most 20,971,520 bytes, svg at most 1,048,576; sniffed type png, jpeg, webp, gif, or svg (7.4); filename sanitised to at most 100 characters | "File is larger than 20 MB" / "SVG is larger than 1 MB" / "Unsupported image type" |
| | `alt` | 0 to 500 | |
| | `title` | 0 to 200 | |
| Media detail | `credit` | trimmed, at most 200 (`CREDIT_MAX` in `components/media/credit.ts`); empty becomes null (no credit) | |
| Page | `slug` | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1 to 60, not `auth`, `preview`, `api`, `admin`, `assets` | "Lowercase letters, digits, and single hyphens" / "This name is reserved" |
| | `title` | 1 to 200 | "Title is required" / "Title must be 200 characters or fewer" |
| | `navLabel` | null or at most 40 | "Nav label must be 40 characters or fewer" |
| | `icon` | null or a library id or a media asset id, from the icon picker | |
| Section, item, site settings | `data` | the draft-level schema through `validator-ajv8`; the API's `400` lands on the field | the schema's message |
| Publish | `label` | null or at most 100 | (input limit) |
| Cookie type | `name` | 1 to 100 | "1 to 100 characters" |
| | `sort` | integer, -1000 to 1000 | "Whole number between -1000 and 1000" |
| | `active` | boolean, always sent | |
| | `icon` | a library id or a media asset id | "Choose an icon" |
| Setting | `value` | integer within the key's range (6.9) | "Must be a whole number between <min> and <max>" |
| API key | `name` | 1 to 100 | "Name is required" / "Name must be 100 characters or fewer" |
| | `capabilities` | at least one unless "All capabilities" | "Choose at least one capability" |
| | `expiresAt` | null, or a valid datetime at least one hour ahead | "Enter a valid date and time" / "Expiry must be at least one hour ahead" |
| Place | `name` | 1 to 120 | "Name is 1 to 120 characters" |
| | `description` | at most 500 (input limit) | |
| QR code | `note` | at most 500 (input limit) | |
| | `forwardUrl` | trimmed; empty becomes null | |

### 7.3 Route file validation

`RouteUploadDialog`: an **Expected shape** panel that is always visible, a file input (`.json`), a `name` field prefilled from the file's `name` key once parsed (editable), and a validation report. The panel shows the exact JSON the dialog accepts,

```json
{
  "name": "2025 flight",
  "points": [
    { "lat": 46.8721, "lng": -114.0012, "recordedAt": "2025-12-22T01:31:07Z" },
    { "lat": 46.8730, "lng": -114.0030, "recordedAt": null }
  ]
}
```

followed by the rules in one line each (`name` 1 to 200 characters; `points` 2 to 50,000 in flight order; `lat` -90 to 90 and `lng` -180 to 180; `recordedAt` an RFC 3339 time or `null`; no other keys; at most 5 MB), a Copy button for the example, and a "Download example" link that saves the example as `route-example.json`. The vendored `contracts/fixtures/route.json` with `schemaVersion` removed is the source of the example, so it can never drift from the contract. Validation runs client-side on file selection and mirrors the route object rules exactly; the API remains the authority and its `400` is shown the same way.

```ts
// src/validation/routeFile.ts
export type RouteIssue = { path: string; message: string };
export type RouteCheck =
  | { ok: true; body: RouteUploadBody; summary: { points: number; latMin: number; latMax: number; lngMin: number; lngMax: number; firstAt: string | null; lastAt: string | null } }
  | { ok: false; issues: RouteIssue[]; total: number };

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
export const ROUTE_MAX_BYTES = 5 * 1024 * 1024;
export const ROUTE_MIN_POINTS = 2;
export const ROUTE_MAX_POINTS = 50_000;
export const MAX_ISSUES_SHOWN = 20;

export function checkRouteFile(text: string, byteLength: number): RouteCheck;
```

Checks, in order, collecting up to `MAX_ISSUES_SHOWN` issues and counting the rest:

1. `byteLength > ROUTE_MAX_BYTES`: `file`: "exceeds 5 MB". Stop.
2. `JSON.parse` fails: `file`: "not valid JSON: <parser message>". Stop.
3. Top level is an object whose keys are exactly `name` and `points`; each extra key is `<key>`: "unknown field"; a missing key is `<key>`: "required".
4. `name`: string, 1 to 200 after trim.
5. `points`: array with `ROUTE_MIN_POINTS` to `ROUTE_MAX_POINTS` items.
6. Each `points[i]`: object with keys exactly `lat`, `lng`, `recordedAt`; `lat` finite number in -90 to 90; `lng` finite number in -180 to 180; `recordedAt` is `null` or a string matching `RFC3339` that `Date.parse` accepts. Issue paths are `points[i].lat`, `points[i].lng`, `points[i].recordedAt`, `points[i].<key>` (unknown field).

The report shows the issues as a list with paths (and "showing first 20" when capped), or the summary (point count, bounding box, first and last `recordedAt`) and an enabled Upload button. Upload sends `{ name, points }` with the edited `name` and the file's `points` unchanged. A downloaded CDN route object fails step 3 on `schemaVersion`; the message tells the admin which key to remove.

### 7.4 Image pre-checks

```ts
// src/validation/image.ts
export type SniffedType = "png" | "jpeg" | "webp" | "gif" | "svg" | null;
export const RASTER_MAX_BYTES = 20 * 1024 * 1024;
export const SVG_MAX_BYTES = 1 * 1024 * 1024;
export async function sniff(file: File): Promise<SniffedType>;   // reads the first 512 bytes
export function checkSize(size: number, sniffed: SniffedType): SizeIssue | null;
export function contentTypeFor(sniffed: Exclude<SniffedType, null>): string;
```

PNG `89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`; WebP `RIFF` at 0 and `WEBP` at 8; GIF `GIF87a` or `GIF89a`; SVG when the bytes decode as UTF-8 text and, after optional BOM, whitespace, an XML declaration, comments, and a DOCTYPE, begin with `<svg` followed by whitespace, `>`, or `/`. Anything else is `null`. The sniffed type decides the `contentType` sent on the upload ticket, so a renamed file is declared as what it is. The API's SVG content rules (no `script`, no `on*` attributes, no `foreignObject`, no external `href`) are not duplicated; its `400` at confirm is displayed on the upload row.

### 7.5 Dates

Inputs are MUI `TextField type="datetime-local"`; they read and fill in the browser's zone, except the event schedule fields below, and the value sent to the API is UTC. Every displayed time renders in the viewer's browser zone followed by that zone's short name from `Intl.DateTimeFormat.formatToParts` with `timeZoneName: "short"` (for example CST or EDT). There is no fixed zone. Conversion:

```ts
// src/lib/time.ts
export function formatStamp(iso: string | null | undefined, timeZone?: string): string;       // "yyyy-MM-dd HH:mm:ss CST" in the viewer's zone, "" for null or invalid
export function formatStampDate(iso: string | null | undefined, timeZone?: string): string;   // "Dec 21, 2025 CST"
export function formatStampTime(iso: string | null | undefined, timeZone?: string): string;   // "19:31:07 CST"
export function toLocalInputValue(iso: string | null | undefined): string;      // yyyy-MM-ddTHH:mm in the browser zone, "" for null
export function fromLocalInputValue(value: string | null | undefined): string | null;   // RFC 3339, UTC, milliseconds, Z; null for empty or invalid
export function wallTimeToUtc(value: string | null | undefined, zone: string): string | null;   // "yyyy-MM-ddTHH:mm" read in the IANA zone to RFC 3339 UTC; null for empty, malformed, or an unknown zone
export function utcToWallTime(iso: string | null | undefined, zone: string): string;   // yyyy-MM-ddTHH:mm in the IANA zone, "" for null, invalid, or an unknown zone
export function browserTimeZone(): string;   // the browser's IANA zone
export function timeZoneOptions(...extra: Array<string | null | undefined>): string[];   // Intl.supportedValuesOf("timeZone") plus UTC and the extras, sorted
export function ageS(iso: string | null | undefined, nowMs: number): number | null;
export function formatAgeS(seconds: number | null): string;   // "12s", "3m", "1h 5m", "2d"; "" for null; negative ages render as "0s"
```

`timeZone` is an IANA zone name; omitted, the formatters use the browser's zone (tests pass one explicitly). Every datetime input shows `formatStamp(fromLocalInputValue(value))` as helper text, the stored UTC instant shown in the viewer's zone with its abbreviation. Every displayed timestamp uses `formatStamp`; every "last X" uses `formatAgeS` (rendered as "<age> ago" or bare) with the absolute value in a title or tooltip where the table has room.

**Event schedule timezone.** The New event dialog and the event detail form each have one "Timezone" select (`components/TimeZoneSelect.tsx`, a filterable MUI Autocomplete over `timeZoneOptions()`). It defaults to the event's stored `scheduleTimeZone`, else the browser's zone (always the browser's zone in the New event dialog). The admin types the wall time the event happens at in that zone: the scheduled field (both forms) and the went live and ended fields (detail form) are read with `wallTimeToUtc(value, zone)` and filled with `utcToWallTime(iso, zone)`. The conversion resolves the zone's offset through `Intl.DateTimeFormat(...).formatToParts`, so it is correct across daylight saving changes: a wall time repeated when clocks fall back reads as its first occurrence, and one skipped when clocks spring forward reads as the same distance past the change (02:30 reads as 03:30). The helper text under each of these fields is `formatStamp(wallTimeToUtc(value, zone))`, the instant in the viewer's zone, so the admin sees both. Switching the Timezone select keeps the instants: every wall time in the form is re-expressed in the new zone through `shiftWallZone(wall, from, to)` (an empty or half-typed value stays as typed), so the moment an event happens never changes just because the zone did; the digits in the fields change instead. What is stored is the UTC instant plus the picked zone: create sends `scheduledAt` (UTC) and `scheduleTimeZone`; the detail form's PATCH sends each time whose instant differs from the stored one at minute precision (the inputs hold minutes, so an untouched field never patches on a zone switch), plus `scheduleTimeZone` when the zone differs from the stored one. On the next edit the stored zone comes back as the select's default and the times are shown as wall times in it.

---

## 8. Error display

### 8.1 From `ApiError` to the screen

- `ErrorAlert` (MUI `Alert severity="error"`) at the top of the form, dialog, or page that made the call: the message from `lib/errorMessages.ts` (`toCopy`), then `details.fields` entries not handled by an input as "field: message" lines, then `requestId` in monospace ("Request <id>") for the CloudWatch lookup.
- Row and card actions that fail outside a form (set current, activate, delete, save a setting, attach a code) report through the `useNotify()` snackbar with the error's message.
- Success: a `Snackbar` ("Event saved", "Status changed", "Key rotated") for 4 s through `useNotify()`, one message at a time, bottom centre.
- Read failures on a list page: an `ErrorAlert` in place of the table; the query refetches on focus and on the next visit.
- `NetworkError` renders as "API unreachable" in the alert.

### 8.2 Codes

`lib/errorMessages.ts` is the only place code strings are matched. The copy per code:

| Code | Copy | Extra handling |
|---|---|---|
| `validation_failed` | the body message, or "Please check the highlighted fields." | field errors where a dialog maps them; the page editor turns `details.fields` into RJSF `extraErrors` |
| `unauthenticated` | "Signed out" | one silent renew and retry inside the client first |
| `forbidden` | "Not available for your role" | the layout stays |
| `mfa_required` | "Two-factor authentication is required" | state `mfa_required` |
| `not_found` | "No longer exists" | |
| `year_taken` | "An event for this year exists" | the clone dialog marks `year` |
| `scheduled_at_required` | "Required while the event is scheduled" | |
| `event_status_unchanged` | "The event is already in that status" | |
| `event_not_current` | "Only the current event can go live. Set it current first." | |
| `another_event_live` | "Another event is live: <name>" when the caller passes the name, else "Another event is live" | |
| `current_event_live` | "The current event is live. End it before changing the current event." | |
| `event_live` | "A live event cannot be deleted" | cookie types: the locked banner (6.7) and a refetch of `keys.events` |
| `event_not_live` | "The event is no longer live." | Seed cookies (6.3): the card's `ErrorAlert` and a refetch of `keys.event(id)`, which hides the card |
| `no_healthy_beacon` | "No healthy active beacon" | the status dialog renders `details.beacon` (name, last seen, stale since) or "No beacon is active"; the caller refetches beacons |
| `pinned_position_taken` | "Position is taken for this year; use Sponsor order to rearrange" | the year dialog marks `pinnedPosition` |
| `name_taken` | "A key with this name exists; revoke it or pick another name" | the key dialog marks `name` |
| `beacon_revoked` | "This beacon is revoked" | |
| `slug_taken`, `slug_reserved` | "That slug is already in use", "That slug is reserved" | |
| `page_has_role` | "Status pages cannot be deleted" | |
| `unknown_kind`, `kind_not_allowed` | "Unknown section kind", "That section kind is not allowed on this page" | |
| `content_unchanged` | "Nothing to publish" | the publish page shows it as an info alert |
| `content_invalid` | "The draft has publish problems" | the publish page refetches the status |
| `media_not_ready`, `media_not_pending`, `upload_not_found` | "The selected media asset is not ready", "The upload has already been confirmed", "The uploaded file did not arrive" | the poster and logo sections reopen the picker on `media_not_ready`; the upload row offers Retry |
| `preview_token_invalid` | "The preview link has expired" | |
| `payload_too_large` | "File too large. Limit: <label>" when the caller passes it, else "The upload is too large" | |
| `unsupported_media_type` | "Unsupported file type. Allowed: <list>" when the caller passes it, else "Unsupported file type" | |
| `rate_limited` | "Too many requests. Retry in <retryAfterSeconds> s" | |
| `snapshot_write_failed`, `route_write_failed`, `media_write_failed`, `upstream_failed` | "Storage write failed; nothing was saved. Try again." | |
| `internal_error` | the body message, or "The API returned an internal error" | |
| `unavailable` | "The API is starting. Try again in a few seconds." | |
| `method_not_allowed`, `unknown` | "Unexpected response <status>" | |
| anything else | the body message, or `HTTP <status>` | |

### 8.3 Confirmation dialogs

`ConfirmDialog` takes a title, body, confirm label, and a `danger` flag (red confirm button).

**Deletes** of resources with an impact endpoint open `DeleteDialog` instead: it takes the resource kind and id (`api/impact.ts`), calls `GET /admin/<resource>/{id}/impact` on open, and renders, above the confirm button: the warnings as an alert (error severity), then "Also deleted" with one line per group ("12 cookies", "3 messages: Doors open, Lift-off, Landing", names joined, at most ten shown, then "+n more"), then "Unlinked" the same way ("2 events lose their reference: 2024 flight, 2025 flight"), or "Nothing else is affected." when both are empty. The confirm button stays disabled until the impact has loaded; a failed impact call shows its message and keeps the button disabled. When `blocked` is set, the dialog shows that sentence alone with a Close button and no confirm; the events list and detail also disable Delete for the live and the current event with the same sentence as the tooltip. For a page holding a role, the dialog adds a required select "Page that takes the <role> role" over the other pages and sends it as `roleTo`.

| Action | Body | Confirm |
|---|---|---|
| Status change (any target) | `StatusDialog` (6.3); "Change without notifying" asks "Change the status without telling subscribers?" with "The message posts on the site now. You can notify subscribers later from the event page.", or with an empty message "The default message posts on the site now. You can notify subscribers later from the event page." and the default message notice | "Change and notify" / "Change without notifying" |
| Set current | "Make <name> the current event? The public site switches to it on its next poll." | "Set current" |
| Delete event, flight recording, sponsor, cookie type, page, media asset, place, QR code, subscriber, person, contact message, poster | `DeleteDialog`: "Delete <name>?" with the impact preview (above) | "Delete" |
| Delete message, sponsor year, section | "Delete <thing>? This cannot be undone." | "Delete" |
| Remove an item | none | |
| Revoke API key | "Revoke <name>? Anything using it stops working immediately." | "Revoke" |
| Restore a version | "Replace the current draft with version <id>? Unpublished changes are lost. Nothing is published until you publish." | "Restore" |
| Restore and publish | the same plus "The public site updates within its next poll." | "Restore and publish" |
| Publish | the label dialog with "The public site updates within its next poll." | "Publish" |
| Republish live object | "Force the ingest node to rewrite the CDN live object from the API's authoritative state." | "Republish" |
| Activate beacon | "Activate <name>? Only its updates are published, starting with its next update." | "Activate" |
| Deactivate beacon | "Deactivate <name>?" plus, when `isActive` and an event is live: "Location fan-out stops until another beacon is activated." | "Deactivate" |
| Rotate key | "Rotate the key for <name>? The current key stops working immediately and the phone must be re-enrolled with the new key." plus, when `isActive` and an event is live: "Location fan-out stops until this phone is re-enrolled with the new key or another beacon is activated." | "Rotate" |
| Revoke beacon | "Revoke <name>? This is permanent." plus, when `isActive` and an event is live: "Location fan-out stops until another beacon is activated." | "Revoke" |

"An event is live" means `keys.events` contains a `statusId === 3` row at the moment the dialog opens. Rebuild snapshot, detach and attach a code, enable and disable a code, move a place, pin writes, section and item edits, and every save have no confirmation.

---

## 9. Tests

### 9.1 Unit (Vitest, jsdom)

| File | Covers |
|---|---|
| `validation/sponsor.test.ts` | sponsor name and URL rules, empty to null, trimming; sponsor year rules (year range, amount pattern and cap, override 0 to 600 s converted to ms, pinned position 1 to 1000), the six-field body |
| `validation/page.test.ts` | the slug pattern, the five reserved names, title and nav label lengths, `slugify` |
| `validation/settings.test.ts` | the six documented keys in order, `specFor`, integer and range checks, the empty string |
| `validation/image.test.ts` | magic bytes for each type, SVG with BOM, XML declaration, comments, and DOCTYPE, `<html` and `<svgfoo` rejected, a renamed PNG declared as SVG returns `png`, the two size limits at the boundary, `contentTypeFor` |
| `validation/routeFile.test.ts` | `contracts/fixtures/route.json` with `schemaVersion` removed passes; with it present fails on `schemaVersion`; one point, 50,001 points, `lat` 91, missing `recordedAt` key, bad RFC 3339, 5 MB + 1 byte, the issue cap with the total, invalid JSON, missing name |
| `lib/publishedState.test.ts` | identical inputs give `[]`; each of the three mismatches; two-poll persistence; reset on a clean poll; `write_error` precedence; `cdn_unreachable` with and without an HTTP status; first load renders `loading` |
| `lib/beaconFlags.test.ts` | each flag on and off; null telemetry; a missing `health` leaf is not flagged; nothing in `debug` is read; revoked returns `[]`; `anyEventLive` gate on `lastLocationAt` |
| `lib/time.test.ts`, `lib/csv.test.ts` | `formatStamp`, `formatStampDate`, and `formatStampTime` in two explicit zones with their abbreviations, standard and daylight time, the datetime-local round trip, ages, RFC 4180 quoting and CRLF |
| `lib/roles.test.ts`, `lib/statusCopy.test.ts`, `lib/statusNames.test.ts`, `lib/thresholds.test.ts` | the drawer order per role and the canvasser landing; a stock paragraph per status, the postponed one word for word; `statusName(6)` is Postponed and the status list ends Cancelled, Postponed; the thresholds match the vendored JSON |
| `lib/noDashes.test.ts` | no em or en dash anywhere under `src/` |
| `api/errors.test.ts` | body parse, `fields`, `retryAfterSeconds`, 405 without body |
| `api/types.test.ts` | `contracts/fixtures/live-object.json`, `snapshot.json`, `heartbeat.json` satisfy `LiveObject`, the snapshot version, `Heartbeat` (compile-time `satisfies` plus a runtime key check, the `socketState` leaf, the debug object verbatim) |
| `auth/claims.test.ts` | admin, editor, canvasser, admin wins over editor, editor over canvasser, absent, not an array, unknown group; `emailOf` |
| `config.test.ts` | the stripped config, the three env values, every missing name reported, a bogus `VITE_ENV`; `VITE_ROUTE_BASEMAP_URL` surfaces as `routeBasemapUrl` without its trailing slash and reads as empty when unset |
| `routeMap/routeMap.test.ts` | `style.ts` and `flavors.ts` match santa's by SHA-256; the copied builders produce a style whose `pmtiles://` tile URL and glyph URL sit under the configured base URL; both appearances share sources and layer ids; the build refuses while the variable is unset; `terrain` adds the `raster-dem` source at `pmtiles://<base>/terrain.pmtiles` and the hillshade layer under the water fill, and without it neither is present |
| `components/content/viewpoints.test.ts` | the viewpoint list round-trips with and without an icon and a description, drops entries of another shape and leaves off an icon or description of another shape, builds an entry with the optional keys only when set and the description trimmed and capped at the schema's 300, adds up to the schema's cap of 50 and refuses past it, edits, reorders, and deletes; an empty list writes the key absent |
| `components/content/places.test.ts` | the nine route map category labels; the tracker table's nine labels, one per contract `PlaceKind` in order; every route map kind fits the schema's pattern and the list cap; the union of the checked categories lands in `kinds` with a shared kind once; Default, Custom with nothing checked, and Custom with categories checked write absent, `[]`, and the union; a stored list checks the categories it holds whole; `withPlacesPart` leaves out a Default part and writes undefined when both parts are Default |
| `schemas/draft.test.ts` | derivation removes `required`, `minLength`, `minItems`, `minimum` at every level and nothing else, does not mutate, handles a nested Presentation |
| `components/audit/auditFormat.test.ts` | actor prefixes, action capitalisation, the stamp text and its fallback, the top-level diff with arrays and objects as "changed", the entry summary for deletes and creates |

### 9.2 Component (Vitest, Testing Library, MSW)

MSW handlers in `src/test/msw/handlers.ts` serve every endpoint in 4.4 from `src/test/msw/fixtures.ts`; unhandled requests fail the test. `renderWithProviders` supplies a retry-free `QueryClient`, the fake `UserManager`, and a `MemoryRouter`. The Maps loader, the barcode reader, and the QR renderer are stubbed where a page needs them.

| Suite | Asserts |
|---|---|
| `boot.test.tsx`, `auth/AuthGuard.test.tsx` | `ConfigError` with no request when a variable is missing; spinner while loading; `SignIn` when no user; `NoRole` for a user without a group; the full drawer for an admin and the editor's entries; a `userLoaded` event without a group switches to `NoRole`; `mfa_required` from the client switches to `MfaSetup`; `userUnloaded` signs out; a route the role cannot open renders Not available, also on direct load; the sign-in button calls `signinRedirect` |
| `pages/Dashboard.test.tsx` | the five cards from fixtures; `write_error` in red; Republish triggers the mutation; the red "No active beacon" while an event is live; the current event fields; on compact (matchMedia stub) the five cards render and both `ThemedJsonView` blocks collapse to one level, asserted through the rendered `.w-rjv-line` count against a desktop render since jsdom's `scrollWidth` is not meaningful; the Change status menu offers Postponed, enabled, and opens `StatusDialog` |
| `pages/events/RouteMapConfigDialog.test.tsx` | with maplibre, pmtiles, the Google loader, and the shared style call mocked: the Route map card summarises a null config (every setting at its default, no landmark line), a full config (one chip per changed setting in order), and leaves out values equal to their default, and no chip says Points of interest; the dialog previews this event's route through `eventRouteMapStyle` on an interactive map; the dialog renders no Landmarks editor and a stored `landmarks` key is dropped; a full config opens into every control and saves back unchanged; the dialog has no Points of interest editor and its caption links to Site settings; the preview style call receives the settings draft's `places.routeMap.kinds` as `poiKinds` when the query returns them and none otherwise; Display and Controls each change alone and save with the other groups untouched, every change landing in the next style input and in the preview's `setStyle`; the defaulted selects and switch show the built-in defaults, a pick writes, and Default removes it back to `null`; Label size shows Medium with its help until picked, each pick passes its scale (Small 0.8, Medium 1, Large 1.3) to the preview's style and saves as `display.labelSize`, and a stored size draws at its scale; the controls read on while absent and write the flipped value, `true` included; Cancel sends nothing and a reopen shows the saved config; Copy from another event lists the other events newest year first with those holding a config marked, loads a picked event's config into both groups and the preview without a request, and Save then sends it (with any edit made after the copy); copying an event with no config empties the draft and Cancel still sends nothing; Clear all asks first and sends `routeMapConfig: null`; with no recording the hint fills the preview area, no map or route map read happens, and the controls still save |
| `routeMap/eventRouteMap.test.ts` | `toRouteMapConfig` keeps only contract values and reads null as no group; a stored `pois` key is dropped; empty groups drop and an empty config saves as null; the absent-true controls; the resolved defaults and scales (the label sizes as 0.8, 1, and 1.3); the site's time labels; the style options (the given place kinds, arrows, scales, the label scale, no landmarks) and the hillshade only while the terrain toggle is kept; the summary |
| `pages/events/*.test.tsx` | the Route map card on the detail page with its summary; rows with name and status; the Current chip hides Set current; the route name from the routes list; Delete opens the impact dialog, and is disabled with the tooltip on the live or current event; the create dialog's inherit preview and the No route body; the clone dialog defaults (all three checkboxes on, no Route poster checkbox), its POST and navigation (`copy` with no `poster` flag), the Route map settings checkbox sending `copy.routeMapConfig`, `409 year_taken` on the year field; "Nobody was notified" and `NotifyDialog`'s POST; `NotifyDialog`'s helper text and the message it sends, null when empty; `StatusDialog`'s helper text, the typed message sent with `notify` true and false and null on both paths when empty, the two confirms, the nested confirmation and its copy; a status change and an announce invalidate the messages query; the stock placeholder per status, the verified count line, and the compact actions row stacks the confirms (matchMedia stub); the history table's Notified column and "announced again", and on compact the history renders as cards and the Details actions row wraps (matchMedia stub); the detail page renders no route poster card (no Route poster heading, Choose poster, Remove poster, or Open poster studio link); Record from this event, Unlink, the flight history select and Use button, "used by no event"; no source file under `src/` names an event `posterLayout` field and the app has no `/events/:id/poster` route (`noPosterLayout.test.ts`); the upload dialog's expected shape equals the fixture minus `schemaVersion`, Copy, and the rule lines; a card per event on compact with the pencil and the menu (matchMedia stub); the Postponed button is enabled with no scheduled time and not current, and posts `statusId` 6 |
| `pages/events/SeedCookiesSection.test.tsx` | the Seed cookies card is absent in status 2 and 4 and present in 3 with one row per active cookie type; stepping and typing clamp to 0 and 100; Seed is disabled at zero; the confirm posts only the non-zero items, toasts "Seeded <n> cookies", resets the fields, and refreshes the event and the cookie types; `409 event_not_live` shows "The event is no longer live." and refetches the event, which hides the card |
| `pages/posters/*.test.tsx` | the poster list: each row's name link, the recording's name or "No recording", the update time, and the edit pencil; the row menu holds Open, Duplicate, and Delete, and Open opens the editor; Create poster asks a name, POSTs it trimmed, and opens the new poster; Duplicate reads the poster and POSTs "<name> copy" with its recording and layout (`copyName`); Delete goes through the `posters` impact preview and deletes (`PostersList.test.tsx`); the poster editor: the app routes `/posters/:id` to it, the header holds the name and the Flight recording select and links back to `/posters`, the map read from the chosen recording's route map, the preview column comes before the rail, the hint stands in place of the workspace with no recording (a picked recording opens the workspace, and the design survives a switch to no recording and back) and with `VITE_ROUTE_BASEMAP_URL` unset; Save sends the trimmed name, the recording (null for none), and the whole layout document, an empty name disables Save, and a failed save shows its message with the design kept; opening restores every part of a saved document (theme, orientation, size, Terrain, colour, Arrows, Arrow size, Time labels, Start time, Timezone, Label format) into the controls and the preview's style and saves it back unchanged; the presets and orientation swap, the flow in order (route map, render, compose, encode, upload ticket, `PUT`, confirm, save, ready) with maplibre and the 2D context mocked, no attach to an event control before or after Generate and no event `PATCH`, the file named after the poster, the attribution text drawn into the composed canvas, and the readable `413` and render failure messages, the Terrain checkbox hidden when the probe rejects and, when the archive exists, unchecked by default and adding the terrain source and hillshade layer to the rendered style once checked, the route styling defaults (the theme's colour following the theme, Reset, Arrows on, Arrow size Large and disabled while the arrows are off, every 15 minutes, Elapsed locked with the hint until a start time is set, then Wall clock), each arrow size landing its scale in `buildPosterStyle` from the preview and from the export, and the preview rebuilt through `setStyle` on every change with the arrowhead image added on create, the export calling `buildPosterStyle` once with an input identical to the preview's last and rendering the identical style (`PosterEditor.test.tsx`, with the unchanged preset list, the preset sizes, the file name, the marks, the pixel ratio, the fit padding, and the arrowhead image added to the offscreen map in `routeMap/poster.test.ts`, and the label entries with the final entry, both formats in two zones and across a daylight saving change, the elapsed form ("45m" under an hour, "1h 15m" from one), the elapsed fallback without a start, the colour, arrows, and labels in the built style, and the label sizes held at 20 px and 14 px with the dots on their own zoom stops whatever label options are passed in `routeMap/posterStyle.test.ts`); the overlay composer with `konva` and `react-konva` replaced by the stand-ins in `src/test/konva/`: opening loads the saved elements in stacking order at their fractional places and a successful Generate PATCHes them after confirm, the export drawing the map, then the overlay canvas rendered at the print pixel ratio, then the attribution, the QR element picked by place and drawn through `qrcode` with the four module quiet zone on the opaque white card and saved with its id and tag, Add logo shown only with a site logo, Forward, Back, the Delete key and button, Clear overlays saving an empty element list with the rest of the design, and a failed or tainted image named in the warning and in the Generate error with the editor still usable (with each element type round-tripping through the layout document onto another size, the whole design round-tripping and an unknown map choice reading its default, every arrow size round-tripping and an absent one reading Large, the z order and the dropped elements, and the snap in `routeMap/posterLayout.test.ts`, crossOrigin, the svg aspect fallback, the tainted and failed loads in `routeMap/overlayImage.test.ts`, and the compose order in `routeMap/poster.test.ts`) |
| `pages/beacons/*.test.tsx` | rows with name and prefix and no role column; the Active and Healthy chips; the create dialog's text, no role field, `{ name, notes }` only; `KeyRevealDialog` with the key and the QR data URL; rotate on the active beacon while live shows the fan-out sentence; the edit pencil links to the page; revoked rows split into the accordion with the count, greyed and pencil-only, no accordion when none; the Health block colours only the flagged leaves and shows "not reported"; the debug tree keyed verbatim and its empty text; the Healthy and Unhealthy chips; logs render for any beacon; on compact each active and each revoked beacon is a card with the flags and the pencil (the menu button too on active), and the logs list is cards with View (matchMedia stub) |
| `pages/routes/RoutesList.test.tsx` | on compact each recording is a card with the row menu (matchMedia stub) |
| `pages/sponsors/*.test.tsx` | the year upsert sends the six fields and rejects an override outside 0 to 600 s; "Add year from…" posts copy-from with the prompted target year and opens the dialog on the new row, and `year_exists` stays on the prompt; the logo `PATCH { logoMediaId }` and the picker reopening on `409 media_not_ready`; the Audit tooltip names the last editor; the import dialog's candidates, re-filtering on the to year, and the tick list in the POST; sponsor order pin, unpin, reorder each send the whole pinned list, and the time field PUTs the year; on compact each sponsor is a card with the pencil (matchMedia stub) |
| `pages/cookieTypes/CookieTypesList.test.tsx` | the locked banner and disabled controls while an event is live and on `409 event_live`; the icon picker offers the library and SVG assets only; on compact each cookie type is a card with the pencil and the menu (matchMedia stub) |
| `pages/pages/*.test.tsx` | role pages render no delete; reorder sends `PUT /admin/pages/order` with every `none` id; the delete dialog names the section count; the palette greys an excluded kind; add section posts the kind's defaults; a field edit patches once after the 1 s debounce and stays quiet after the refetch; a `400` lands on the field; the problems badge; duplicate, move, hide, delete call their endpoints; items reorder sends the new order; on compact each page is a card with the pencil, the section card header wraps into two rows, and the up and down arrows sit in the card header (matchMedia stub); the Menu icon (`PageIcon.test.tsx` and the list and editor suites): set at create and sent in the `POST`, edited, cleared to null, a saved icon reading back and saving unchanged, a role page editing it through Page settings, the 20 px list preview when set and none when not, and the label with its help; the postponed role page carries the Postponed chip and lists after No event (the fixtures carry a postponed page) |
| `components/content/SchemaForm.test.tsx` | every vendored kind schema renders from its defaults; each primitive `$ref` mounts its custom field; an unknown scalar renders the default widget; the `route_preview` section editor renders heading, disclaimer, and emptyText and no style select, map buttons, landmarks, points of interest, or route map display; the map section's Landmarks toggle reads on while absent, shows its help, and writes `controls.landmarks`; the map section form renders no `poiFilter` or `poiKinds` field; a checkbox group under a `when` rule with `is: "off"` is disabled with its hint while the switch is off and writes values in enum order once on |
| `components/content/fields/PoisEditor.test.tsx` | `PoisEditor` reads absent as Default and writes absent, `[]`, and the deduplicated union, shows a stored list with its categories checked, and with `categories` set to `TRACKER_KINDS` offers the nine tracker kinds |
| `pages/siteSettings/SiteSettingsPlaces.test.tsx` | Places on the maps reads absent as Default in both groups with its labels and help; Parks and Schools under Live tracker save `places` as `{ tracker: { kinds: ["park", "school"] } }` with `routeMap` absent; Custom with nothing checked under Route map saves `{ routeMap: { kinds: [] } }` and shows the empty-list caption; both groups back on Default save without `places`; a stored `places` with both parts shows each category checked |
| `components/content/fields/RouteMapDisplay.test.tsx` | the display helpers resolve each key from the first level that sets it, then the built-in default, and an emptied block is removed; `RouteMapDisplayControls` shows Every 15 minutes, Arrows on, Medium, Normal, and a Label size of Medium while unset, writes nothing untouched, writes only each pick, shows stored values, and Default removes a picked key; Arrow size is enabled while the arrows are unset, disabled with "Turn the arrows on to size them." and a disabled Default button while they are off, and its stored size survives switching the arrows off and on (switching off writes only `arrows: false`) |
| `components/content/PreviewFrame.test.tsx` | opening mints a token and sets the frame `src` with the page; Reload keeps a valid token and mints after expiry; New token always mints; switching pages keeps the token; the countdown ticks; on compact the device select is hidden (matchMedia stub) |
| `pages/media/MediaLibrary.test.tsx` | a 21 MB PNG and a 2 MB SVG are refused before any request; the ticket, PUT (mocked XHR with progress), confirm sequence; Retry after a failed PUT repeats the whole sequence; deleting an asset that is in use closes the drawer and reports the delete; the Deep zoom chip |
| `pages/siteSettings/SiteSettings.test.tsx` | the form renders from the vendored schema with the two theme switches; Save sends the whole document, an unset landmarks list absent; problems from the draft response; Preview mints a token; the form carries no Route map group |
| `pages/siteSettings/SiteSettingsViewpoints.test.tsx` | the Viewpoints field renders `ViewpointsEditor` with its label and help after the header links; two viewpoints added save under `landmarks`; a map click places the pin and fills Latitude and Longitude, Save waits for a name, and the entry saves its trimmed name, lat, and lng; edit, reorder, and delete, and an emptied list saves without the key; Add disabled at 50 with the count; an icon picked through the shared picker, the description's help, live count, and 300 cap, both saved and the row's icon preview shown; a stored icon and description open in Edit, survive a reorder, and Clear and an empty description remove both keys |
| `pages/publish/Publish.test.tsx` | the three status states with problem links to sections and site settings; publish with a label refreshes the list; `content_unchanged` and `content_invalid`; restore asks and calls the endpoint; restore and publish issues both calls with the generated label; the Published chip; on compact each version is a card with View, Restore, and Restore and publish (matchMedia stub) |
| `pages/settings/Settings.test.tsx` | every setting from the fixture; `PUT { value }`; out-of-range values never reach the API; a spec for every documented key; on compact each key is a card with the value input and Save inside (matchMedia stub) |
| `pages/subscribers/Subscribers.test.tsx` | the summary counts and rows; the export follows `nextCursor` and writes the documented header; on compact each subscriber is a card with the delete icon (matchMedia stub) |
| `pages/apiKeys/*.test.tsx`, `pages/agents/AgentsPage.test.tsx` | rows with name, prefix, and status; mint reveals once through `KeyRevealDialog`; `409 name_taken` on the name field; revoke after confirmation; the create dialog's rules and bodies; the agents page renders the steps, the keys table, and the prompt with this environment's base URL; the prompt names every capability group and the key endpoints; on compact each key is a card with the row menu (matchMedia stub) |
| `pages/audit/AuditPage.test.tsx`, `components/audit/AuditHistoryDialog.test.tsx`, `pages/auditColumn.test.tsx` | entries newest first with the summary; the Action filter offers `cookies_seeded` and the row reads it as written; the Deletes chip filters; a link on a live row and plain text on a deleted one; the entity filter mounts the entities endpoint; the history dialog fetches by entity and id, expands to raw JSON, and pages with the cursor; every audited table ends with the Audit column; on compact each entry is a card with the expand toggle (matchMedia stub) |
| `pages/editPencils.test.tsx` | every editable row on every list page carries an edit pencil; flight recordings and API keys do not |
| `components/DeleteDialog.test.tsx` | confirm disabled until the impact loads; the Also deleted and Unlinked groups; names capped at ten with "+n more"; warnings as an alert; "Nothing else is affected"; the blocked sentence with Close only; the role takeover select gates Delete and is sent as `roleTo` |
| `components/StatusChip.test.tsx` | Postponed (6) renders as an outlined warning chip |
| `components/AppDialog.test.tsx`, `components/layout/MainLayout.test.tsx`, `components/layout/PageHeader.test.tsx` | `AppDialog` is full screen below `sm` and not above, and honours an explicit `fullScreen` when it disagrees with the viewport; `MainLayout` on compact hides the email, renders the `Open navigation` button, and opens the temporary drawer with a `Close navigation` button and a scrolling list (matchMedia stub); `PageHeader` puts the actions row under the title on compact and inline with the title on desktop |
| `components/list/ResponsiveTable.test.tsx` | on desktop the table renders every column with the actions and the audit cell, and the empty state spans every column; on compact (matchMedia stub) one card per row carries the title, the chips, the "label: value" lines, the actions, and the audit button, and the empty state is the `emptyText` alone |
| `pages/qr/*.test.tsx`, `pages/places/*.test.tsx` | the attachment and Unattached cells; Generate posts the count; the print sheet lists the four sizes; the detail's history card, three stats, and daily chart; the places tree with location cells; New place posts the trimmed name; a refused delete shows the API's message and keeps the row; Use my location writes the pin with source `phone` and refuses a fix worse than 500 m; Use the parent's pin deletes the own location; `circleSizeFor` grows with the count; the map's side list and counts; the scan flow with a fake reader: an unattached tag opens the sheet and New place plus a phone pin runs three calls, an attached tag lands on Move and Done, manual entry opens the same flow; on compact each QR code and each place is a card (the place cards carry the depth indentation on their left padding) and the QR detail's history renders as cards (matchMedia stub) |

### 9.3 End to end (Playwright, dev stack)

Runs against `vite preview` on `http://localhost:5174` with the dev variables, so the origin is registered on the dev Cognito client, in the dev CORS list. `playwright.config.ts` builds and previews the app itself, one worker, two projects: `chromium` (`Desktop Chrome`, every spec except the mobile one) and `mobile` (`Pixel 7`, viewport 390 x 844, `isMobile`, `hasTouch`, only `09-mobile.spec.ts`), traces and video on failure. Secrets on the `dev` GitHub environment: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ADMIN_TOTP_SECRET`, `E2E_EDITOR_EMAIL`, `E2E_EDITOR_PASSWORD`, `E2E_EDITOR_TOTP_SECRET` (dedicated dev users; the specs generate codes with `otpauth` and wait for a fresh TOTP window when a code would repeat), plus `E2E_BEACON_KEY` for the walk beacon. `e2e/helpers.ts` signs in through the managed login pages, reads the ID token out of `sessionStorage`, and drives the API directly for setup and teardown (events, current, status, beacons, heartbeat, the published version id) through the exported `adminApi`. Specs:

1. Sign in through the hosted UI with password and TOTP; the layout renders with the `DEV` badge; sign out returns to `SignIn`.
2. Create a beacon; the key dialog shows a `wbk_` key and a PNG data URL; rotate it; revoke it.
3. Create an event with inherit; set it current; walk planned to scheduled (after setting `scheduledAt`) to live to ended through the confirmations (the silent path of `StatusDialog`); after each change `GET <dev cdn>/live/location.json` reports the new `eventStatusId` within 10 s. `afterAll` restores the event that was current when the spec started and deletes this run's event through the API.
4. Change `poll_interval_ms`; the CDN object's `pollIntervalMs` follows within 10 s; restore it.
5. With the dev walk event (year 2100) live, cookie type controls are disabled; after ended, a type can be edited, a fresh type can be created and deleted, and Delete is disabled on a type with cookies. The walk is driven through the API before and after; the current event is restored in `afterAll`.
5a. Going live is refused while the e2e beacon is stale: the Live button carries the reason until the harness posts a heartbeat for the beacon, then the walk proceeds. The spec swings the current event and the active beacon to the walk event and the e2e beacon for the run and restores both in `afterAll`.
6. Upload the vendored route fixture (with `schemaVersion` stripped by the test) to an event; the flight history section shows its point count.
7. As an editor: the drawer has no Events entry; open the about page, add a `rich_text` section with a paragraph, upload a small PNG through the media library, add a `media` section using it, publish with a label; `GET <dev cdn>/live/location.json` reports a new `snapshotUrl` within 10 s and the snapshot's `content` contains the paragraph and the media map contains the asset with its `url` and no variants (the PNG is 400 px wide); restore the version that was published when the spec started and publish again; delete the asset while the section still references it (the API clears the reference and the card goes), then the section. The editor never opens the preview frame.
8. As the editor, `GET /admin/events` answers `403 forbidden` and the Events route renders "Not available for your role".
9. Mobile project only (`09-mobile.spec.ts`): signs in as the admin against a 390 x 844 Pixel 7 viewport (the sign-in wait is the `Open navigation` button, not the permanent drawer), then visits every route in § 1 (the list routes, one detail per family discovered through `adminApi`, `/places/map`, `/scan`, `/agents`, `/audit`). For each, the spec waits for network idle plus 500 ms, attaches a full-page JPEG screenshot to the test through `testInfo.attach`, and asserts `document.documentElement.scrollWidth <= page.viewportSize().width` (comparing against the emulator's viewport rather than `window.innerWidth`, which mobile emulation enlarges to the content); every failing route is reported in one assertion message rather than stopping at the first. After the overflow sweep, one interaction per family: open the drawer and navigate to Events, open the row menu on the first event card and close it with Escape, open `New event` and Cancel it, open a beacon card's Audit dialog and Close it, and expand an audit row (its `Show raw JSON` toggle flips to `Hide raw JSON`).

The workflow runs on `workflow_dispatch` and nightly at 07:00 UTC, not on every push.

---

## 10. CI and deploy

`.github/workflows/ci.yml` on every push and pull request, Node 20: `npm ci`; `npm run check:contracts` (fetches the API repository at `CONTRACTS_SHA` and diffs its `contracts/` against the vendored copy); `npm run gen:api-types` followed by `git diff --exit-code src/api/schema.d.ts`; `npm run typecheck`; `npm run lint`; `npm test`; `npm run build`.

`.github/workflows/e2e.yml` (section 9.3) uses the `dev` GitHub environment: `VITE_ENV=dev` and the `VITE_*` values (`VITE_API_BASE_URL`, `VITE_CDN_BASE_URL`, `VITE_COGNITO_AUTHORITY`, `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_SITE_BASE_URL`, `VITE_GOOGLE_MAPS_KEY`) from the environment's variables (the build refuses to start without the last two), the `E2E_*` secrets plus `E2E_BEACON_KEY`, installs Chromium, builds, runs `npm run e2e` (both the `chromium` and the `mobile` project), and uploads the Playwright report (always) and the traces (on failure).

Vercel builds `main` into production with the prod variables. A second Vercel project builds `dev` with the dev variables. Local work runs `npm run dev` with `.env.local` holding the dev set.

---

## 11. Decisions made here

- The `MfaSetup` page enrols the authenticator in place through `AssociateSoftwareToken`, `VerifySoftwareToken`, and `SetUserMFAPreference` with the access token; the `wmsfo-admin` app client carries scope `aws.cognito.signin.user.admin` and the panel adds the `qrcode` dependency.
- `contracts/admin-thresholds.json` is `{ "batteryLowPercent": 20, "noFixAgeS": 30, "noLocationAgeS": 30 }`, published by the API repository and re-declared by `thresholds.ts`.
- The route the public sees is a poster chosen on the event through the media picker; the `/routes` page is named Flight recordings, and the recording linked to an event is its tracker flight history as well as the replay and export source.
- Sponsor order is one page per year that sends the whole pinned list on every change; time overrides are edited inline there and in the year dialog.
- Site settings expose only the snow and lights defaults; there is no theme picker in the panel.
- API keys are minted with an "All capabilities" switch or a checkbox per capability plus an optional expiry, and revealed once through the same dialog beacons use.
- The panel does not join the hub; it polls the API and the CDN as the contracts' data loop describes.
- `@tanstack/react-query` provides polling, pause-when-hidden, refetch-on-visible, and refetch-after-write; queries and mutations do not retry.
- The API client is a `fetch` wrapper with types generated by `openapi-typescript` from the vendored `contracts/openapi.json`; `LiveObject`, `Heartbeat`, `LiveState`, and the QR and places shapes are declared by hand and fixture-checked.
- Tokens live in `sessionStorage`; there is no automatic redirect into the hosted UI, a `SignIn` page with one button starts sign-in; sign-out revokes the refresh token before Cognito logout.
- `401` handling is one silent renew and one retry, then `AuthRequired`; every renewal re-runs the group check.
- `VITE_ENV` takes `prod`, `dev`, or `local`; the badge is red, green, or blue; non-prod prefixes the document title.
- The live object preview on the dashboard is the parsed CDN object plus raw JSON, with the node's in-memory copy alongside; there is no iframe of the public site.
- All displayed times are in the viewer's browser zone labelled with that zone's short name; inputs are `datetime-local` in the browser zone with the resulting stamp as helper text; no fixed zone and no timezone variables.
- The beacon detail page reads the polled beacons list rather than polling `GET /admin/beacons/{id}`.
- Flags are not evaluated for revoked beacons; every flag colours red; the `anyEventLive` input to the fix rule comes from the events list.
- There is no cookie view and no moderation; a cookie type's delete goes through the impact preview like every other delete.
- Beacons have no role; the beacon page shows a Health block from the typed core and the beacon's `debug` object as a themed JSON tree it never reads; logs show for every beacon.
- The Live status button and dialog are gated on a healthy active beacon in the panel and by the API.
- Every editable row carries an edit pencil; state-changing actions live in a row menu, except the three delete-only tables, which carry a delete icon.
- The flight recording upload dialog shows the expected JSON shape, built from the vendored route fixture, with Copy and Download.
- Subscriber export is built client-side by paging the list at 500 rows; no export endpoint is assumed.
- Location CSV export goes through `fetch` with the bearer token and a Blob download, not a link.
- Route upload validation mirrors the route object rules client-side before the POST; the route name is editable; the file's points are sent unchanged.
- "Build from event" on the recordings page lists ended events and calls `POST /admin/routes/from-event/{eventId}` with a name; the event page's "Record from this event" does the same and links the result.
- A status change asks for an explicit notify or not, with a nested confirmation when not; the event page says when nobody was told and lets the admin notify later with a custom message. The message form's notify checkbox defaults to off.
- Status buttons for unreachable targets are disabled with the reason as a tooltip; the API's `409` codes are handled as well.
- The `KeyRevealDialog` closes only through its single button.
- Hand-rolled validation functions, no form library; MUI `Table`, no data grid.
- Dev server and preview run on port 5174 with `strictPort`.
- Playwright runs against `vite preview` on `localhost:5174` with the dev variables, nightly and on demand.
- Content forms are generated from the vendored schemas with `@rjsf/mui`; the primitives have hand-written fields keyed by `$ref`, and the draft-level schema is derived client-side by the same rule the API uses, so a new scalar field in a kind needs no panel change.
- Media uploads go from the browser straight to S3 with the ticket's exact headers over `XMLHttpRequest` for progress; the panel never proxies bytes.
- The page editor autosaves with a 1 s debounce, flushes on blur, and shows per-card save state; a "Save now" button flushes by hand.
- Sections and pages reorder with up and down buttons; items and the sponsor order use drag and drop.
- Preview is the real site in an iframe with a minted token and a page parameter, opened from Site settings; the panel never renders content itself.
- Roles come from the token's groups; the layout hides views by role and the API enforces the policy.
- Restore replaces the draft only; "Restore and publish" is two calls with a generated label.
- Every audited table ends with an Audit column: the newest stamp on hover, the row's history on click; deletes live on the Audit page.
- Revoked beacons live in a collapsed section under the list.
- Sponsors copy forward per sponsor ("Add year from…") and in bulk ("Import from year"); events clone with their sponsors, recording, poster, and route map settings; an event's Route map dialog copies another event's settings for review before Save.
- QR codes, places, and scan are three pages; a canvasser sees only those; codes are drawn and printed in the browser at any size; pins come from the phone, a Places search, or a drag, never from a visitor.
- Every delete of a resource with dependents goes through `DeleteDialog` and its impact preview; the live and the current event cannot be deleted.
- On a phone the events list renders `ResponsiveTable`'s outlined cards; the same component keeps the desktop table byte-for-byte the same markup as before adoption, so the existing specs keep working.
- The compact vocabulary is one breakpoint: below `md` (900 px) the shell is compact. `useCompact` reads the theme's `down("md")` media query and every page uses that same signal, so a page reads the same on a tablet in portrait as it does on a phone. Every list adopts `ResponsiveTable`, which stays a `Table` on desktop and becomes outlined `Card`s on compact.
- Every dialog opens through `AppDialog`, which sets `fullScreen` below `sm` (600 px) unless the caller passes `fullScreen` in itself. A unit test keeps only `AppDialog.tsx` importing `Dialog` from `@mui/material`.
- The mobile gate is `09-mobile.spec.ts`, one test, the `mobile` Playwright project only. It sweeps every route in § 1 for `scrollWidth <= viewportWidth`, attaches a JPEG per route, and after the overflow sweep runs one interaction per family (drawer navigation, row menu, create dialog cancel, audit dialog open and close, audit row expand) so a regression in the phone controls surfaces here and not in a screenshot review. `e2e.yml` runs both projects.

## 12. Needs a decision

Nothing at the moment. Add here as it comes up.
