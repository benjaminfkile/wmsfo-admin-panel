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
| Maps and codes | `@googlemaps/js-api-loader` (maps, markers, Places autocomplete), `qrcode` (TOTP QR, printed codes), `@zxing/browser` (camera fallback on Scan) |
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
| `/events/:id` | Event detail | `GET /admin/events/{id}`, `GET /admin/events`, `PATCH /admin/events/{id}` (fields, `routeId`, `routeImageMediaId`), `POST .../status`, `POST .../notify`, `POST .../current`, `GET .../status-history`, `.../messages` (list, post, patch, delete), `GET .../locations` (JSON and CSV), `GET /admin/routes`, `POST /admin/routes`, `POST /admin/routes/from-event/{id}`, `GET /admin/beacons`, `GET /admin/subscribers/summary`, `GET /admin/media` (poster picker), `GET .../impact`, `DELETE /admin/events/{id}` |
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

**Edit controls.** Every row the panel can edit carries an edit icon button (the MUI pencil, `aria-label="Edit <name>"`) that opens the same dialog or page the row's name link opens: events, beacons (including revoked ones in their accordion), sponsors, sponsor years, cookie types, pages, QR codes, places, and media cards (the pencil opens the detail drawer). Flight recordings and API keys have no pencil (a recording's name is not editable; a key is revoked, never edited). Names stay links as well; the pencil is the discoverable control. State-changing row actions (set current, clone, delete, activate, rotate, revoke, attach, detach, enable, move) sit in a `MoreVert` row menu next to the pencil. Subscribers, people, and contact messages, which have delete as their only action, carry a delete icon button instead of a menu.

**Audit column.** Every table of an audited resource (events, flight recordings, beacons, sponsors, sponsor years, cookie types, API keys, people, subscribers, contact messages, settings, pages, content versions, QR codes, places) ends with a column headed `Audit`, the last `<td>` of every row, holding one icon button (`HistoryIcon`, `aria-label="Audit <name>"`) rendered by `AuditCell`. Its tooltip shows the row's newest stamp from `audit` on the DTO: "<Action> by <actor> · <time in Mountain>" (the actor without its `person:` prefix, API keys as "key <name>"), or "No changes recorded since the audit log began" when `audit` is null. Sponsor year rows pass a null stamp. Clicking opens `AuditHistoryDialog` for that entity and id: `GET /admin/audit?entity=&entityId=` newest first, paged with Load more, each entry a row with the time, the actor, the action, and the changed top-level fields as "field: before → after" computed from the two JSON objects (arrays and objects summarised as "changed"), expandable to the raw before and after. Media cards, event messages, sections, and items have no audit cell.

---

## 2. Repository layout and configuration

### 2.1 Source tree

```
wmsfo-admin-panel/
  index.html  vite.config.ts  vercel.json  tsconfig*.json  eslint.config.js  playwright.config.ts  .env.example
  contracts/                    vendored copy of the API repository's contracts/ (openapi.json, schema/, fixtures/, icons/, kinds.json, starter-content.json, admin-thresholds.json, CONTRACTS_VERSION)
  CONTRACTS_SHA                 API commit the copy came from
  scripts/check-contracts.mjs   diffs contracts/ against that commit
  e2e/                          Playwright specs (01 to 08 plus 05a) and helpers.ts
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
    hooks/      useNotify.tsx  useNow.ts  useDebouncedSave.ts
    components/ layout/MainLayout.tsx  EnvBadge.tsx  NetworkBanner.tsx  ErrorAlert.tsx  ConfirmDialog.tsx  DeleteDialog.tsx
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
                          NotifyDialog.tsx  MessagesSection.tsx  RoutePosterSection.tsx  RouteSection.tsx
                          RouteUploadDialog.tsx  LocationsSection.tsx
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
| `check:contracts` | `node scripts/check-contracts.mjs` |
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

Eight variables, all prefixed `VITE_`, read through `import.meta.env`:

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

`.env.example` lists the eight names with empty values, plus the six `E2E_*` names section 9.3 uses, and is committed; `.env.local` is ignored. Trailing slashes are stripped from every URL.

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
};

export type ConfigResult = { config: Config } | { missing: string[] };
export function loadConfig(env: ImportMetaEnv = import.meta.env): ConfigResult;
```

`main.tsx` calls `loadConfig()` first. A missing or empty variable, or a `VITE_ENV` outside the three values, renders `ConfigError` with the list of names and nothing else; no auth, no fetch. The `Config` reaches components through `ConfigProvider` and `useConfig()`.

### 2.6 TypeScript configuration

`tsconfig.json` is a solution file referencing three projects:

- `tsconfig.app.json`: `src`, target ES2022, `moduleResolution: bundler`, `jsx: react-jsx`, `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `isolatedModules`, `resolveJsonModule`, `noEmit`, types `vite/client`, `vitest/globals`, `@testing-library/jest-dom`, `google.maps`.
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
export type StatusId = 1 | 2 | 3 | 4 | 5;
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
export type PatchEventBody = Partial<{ name: string; year: number; scheduledAt: string | null; wentLiveAt: string | null; endedAt: string | null; fundsPercent: number; routeId: number | null; routeImageMediaId: string }>;
export type CloneEventBody = { year: number; name: string; copy: { sponsors: boolean; route: boolean; poster: boolean } };
export type StatusBody = { statusId: StatusId; notify: boolean; message: string | null };
export type NotifyBody = { message: string | null };
export type MessageBody = { body: string; eventTime: string | null; notify: boolean };
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
export const routes = { list, get, create, fromEvent: (eventId, b: { name: string }) => post<Route>(`/admin/routes/from-event/${eventId}`, b), remove };

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
export type PageBody = { slug: string; title: string; navLabel: string | null; navPosition?: number; isHidden?: boolean };
export const pages = { list, get, create, patch, remove: (id, roleTo?: number | null) => del(roleTo == null ? `/admin/pages/${id}` : `/admin/pages/${id}?roleTo=${roleTo}`), order: (ids) => put("/admin/pages/order", { ids }) };
export type SectionBody = { kind: string; position?: number; data?: object; presentation?: Presentation };
export const sections = { create, patch: (id, b: Partial<{ data: object; presentation: Presentation; isHidden: boolean }>), remove, duplicate, move: (id, b: { pageId; position }), order, createItem, patchItem, removeItem, orderItems };

// siteSettings.ts, content.ts
export const siteSettings = { get, put: (data: object) => put("/admin/site-settings", { data }) };
export const content = { kinds, status, draft, publish: (label: string | null), versions, version: (id) => get<ContentVersionInfo & { document: object }>(...), restore, previewToken };

// media.ts, upload.ts
export type MediaQuery = { cursor?: string; limit?: number; kind?: "raster" | "svg" | "gif"; state?: "pending" | "ready" | "orphaned"; q?: string };
export const media = { list, get, usage, uploadUrl: (b: { filename; contentType; sizeBytes; alt; title }) => post<UploadTicket>(...), confirm, patch: (id, b: Partial<{ alt; title }>), remove };
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

`src/api/impact.ts` is the delete-impact reader used by `DeleteDialog`: `impact.get(resource, id)` calls `GET /admin/<resource>/{id}/impact` for `events`, `routes`, `sponsors`, `cookie-types`, `pages`, `media`, `places`, `qr-codes`, `beacons`, `api-keys`, `subscribers`, `people`, `contact-messages` and returns `{ blocked: string | null; deletes: ImpactGroup[]; unlinks: ImpactGroup[]; warnings: string[] }` where a group is `{ entity, count, names }`.

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
  routes, beacons, beaconLogs(id),
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
| Page editor | `keys.page(id)`, `keys.pages`, `keys.kinds` | none | invalidate `keys.page(id)` (and `keys.pages` after a page or move write) |
| Every other view | its list key | none | invalidate the list; settings and sponsor detail also `setQueryData` with the returned row |

`keys.icons` is fetched with `staleTime: Infinity` by the cookie types page and its icon picker. Nothing else overrides the defaults. Paged lists (`Page<T>`: subscribers, people, contact messages, media, audit) use `useInfiniteQuery` with `getNextPageParam: (last) => last.nextCursor ?? undefined` and a "Load more" button; `limit` is 50.

---

## 5. Observing the live state

### 5.1 Published-state comparison

```ts
// src/lib/publishedState.ts
export type Mismatch = { field: "eventStatusId" | "snapshotUrl" | "seq"; cdn: unknown; api: unknown };

export function compare(cdn: LiveObject, current: Event | null, snap: SnapshotInfo, state: LiveState): Mismatch[] {
  const out: Mismatch[] = [];
  const apiStatus = current?.statusId ?? null;
  if (cdn.eventStatusId !== apiStatus) out.push({ field: "eventStatusId", cdn: cdn.eventStatusId, api: apiStatus });
  if (cdn.snapshotUrl !== snap.url) out.push({ field: "snapshotUrl", cdn: cdn.snapshotUrl, api: snap.url });
  if (cdn.seq !== state.lastWriteSeq) out.push({ field: "seq", cdn: cdn.seq, api: state.lastWriteSeq });
  return out;
}

export type PublishedState =
  | { kind: "loading" }
  | { kind: "cdn_unreachable"; status: number | null; error?: string | null }
  | { kind: "ok" }
  | { kind: "behind"; mismatches: Mismatch[] }
  | { kind: "write_error"; error: string };

export function resolvePublishedState(input: ResolveInput): { state: PublishedState; mismatchedNow: boolean };
```

The card keeps `previousMismatched: boolean` across polls in a ref. `resolvePublishedState` renders `behind` only when the current poll and the previous poll both produced a non-empty `compare()` result; a single mismatched poll renders `ok` (the CDN copy lags an ingest write by up to a second). A poll with no mismatch resets the flag. `state.lastWriteError !== null` renders `write_error` regardless of the comparison. A `CdnError` (with its HTTP status) or a network failure (with its message) on the CDN fetch renders `cdn_unreachable` and does not touch the flag; a CDN query that has never settled renders `loading`. `current` is the event with `isCurrent === true` from the events list.

Rendering: `ok` green "CDN current, written <age> ago by <lastWriteNode>"; `behind` red "CDN behind" with the mismatch list; `write_error` red with the error text; `cdn_unreachable` amber with the status or the message. The card's Republish button (always present, confirmed by `ConfirmDialog`) calls `POST /admin/live/republish` and invalidates the dashboard keys.

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
  if (hub === false || (hub === null && (h?.socketState ?? null) !== "connected")) f.push("socket_down");
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

`MainLayout`: a fixed `AppBar` (the title, `EnvBadge`, the signed-in email hidden below `md`, a theme toggle, a sign-out button), a permanent `Drawer` at 220 px on `md` and up and a temporary drawer below (opened from a menu button in the bar, paper `width: min(280px, 85vw)` with a header row of the title, the `EnvBadge`, and a `Close navigation` icon button, and a scrolling `List` under the divider), and the page content in a `flexGrow: 1, minWidth: 0, overflowX: hidden` column under a `Toolbar` spacer with `p: 2`. The `AppBar` keeps `zIndex.drawer + 1` only at `md` and above, so on compact the temporary drawer renders over the bar. The drawer is one flat `List` of `ListItemButton`s, no groups and no icons, in the order `navFor(role)` returns; the entry whose path equals the current pathname is selected. The theme is `createTheme({ palette: { mode } })` with darker `background` values in dark mode, stored under `localStorage` key `appThemeMode`, light by default.

The compact vocabulary is the MUI `md` cut-off (below 900 px), read through the `useCompact` hook in `src/hooks/useCompact.ts`. `PageHeader` (`src/components/layout/PageHeader.tsx`) shows the title (`h4` on desktop, `h5` on compact) with any chips beside it and the actions on the right on desktop; on compact the actions wrap to their own row full width so a phone can still reach every button (the events page's "New event" is the driving example). Every page header row in `src/pages` uses `PageHeader`. `AppDialog` (`src/components/AppDialog.tsx`) is the wrapper the whole panel opens dialogs through: it forwards every prop to MUI `Dialog` and sets `fullScreen` when the viewport is below `sm` (600 px) unless the caller passes `fullScreen` in itself; the actions bar stays at the bottom and the content scrolls. `KeyRevealDialog` keeps its no-escape and no-backdrop rules through the same wrapper.

**On a phone, lists are cards.** `ResponsiveTable` (`src/components/list/ResponsiveTable.tsx`) is the one component every list page adopts: on desktop (not compact) it renders the same `TableContainer component={Paper}` with `Table size="small"` the pages render today (a head row with every column's header, honouring `align`; the `leading` cell first when given, then the columns, then the Actions cell holding `actions(row)` when given, then the `AuditCell` when `audit` is given; every row carries `data-testid={rowTestId(row)}` and `hover`; the empty state is one row spanning every column with `emptyText`), so its output on desktop is byte-for-byte the same markup the page rendered before adoption. On compact it renders a `Stack spacing={1}` of outlined `Card`s instead, one per row, each carrying the same `data-testid` on the card root: the `title` column's value as `subtitle1` with the `leading` node before it, the `subtitle` column as `body2` secondary text under it, the `chip` columns in a wrapped row of chips, then every `line` column as "label: value" lines (`label` falls back to the header text) in the column order, `desktop-only` columns omitted (a column may carry `renderCompact` for the card, used where the table cell shows a placeholder such as "none" that has no place on a card; a chip column that renders null on compact is skipped), and a footer row with `actions(row)` on the left and the audit icon button on the right; the empty state is the `emptyText` in secondary text. `AuditCell` carries an `asCell?: boolean` prop (default true): when false it renders a plain `IconButton` for the card footer. The same `aria-label`s (`Edit <name>`, `Actions for <name>`, `Audit <name>`) appear in both layouts, so the existing specs keep working. `useInfiniteQuery` pages keep their "Load more" button outside the component. A column is `{ key: string; header: ReactNode; render: (row: T) => ReactNode; align?: "left" | "right"; role?: "title" | "subtitle" | "chip" | "line" | "desktop-only"; label?: string; renderCompact?: (row: T) => ReactNode }` and the props are `{ rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; rowTestId?: (row: T) => string; rowSx?: (row: T) => SxProps; actions?: (row: T) => ReactNode; audit?: (row: T) => { entity: string; entityId: string | number; name: string; audit: AuditStamp | null | undefined }; emptyText: string; leading?: (row: T) => ReactNode; size?: "small" | "medium" }`. The events page adopts it (6.3).

Drawer entries for `admin`: Dashboard, Events, Flight recordings, Beacons, QR codes, Places, Scan, Pages, Media, Site settings, Publish, Sponsors, Sponsor order, Cookie types, Subscribers, People, Contact messages, Settings, API keys, Agents, Audit. For `editor`: Pages, Media, Site settings, Publish, Sponsors, Sponsor order, QR codes, Places, Scan, Audit. For `canvasser`: QR codes, Places, Scan. There is no cookie view: the tally on the dashboard's live object is all the panel shows about cookies.

`EnvBadge`: an MUI `Chip` with `config.env.toUpperCase()`; colour `error` for `prod`, `success` for `dev`, `info` for `local`; tooltip shows `config.apiBaseUrl`. On `dev` and `local` the document title is prefixed `[DEV]` or `[LOCAL]`. The badge also appears on `SignIn`, `NoRole`, and `MfaSetup`.

`NetworkBanner` renders "API unreachable" under the bar when `MainLayout` receives `networkDown`; no page passes it, so the banner never shows. `NetworkError` surfaces through `ErrorAlert` on the page that made the call.

### 6.2 Dashboard

Five cards in a `Grid` (two halves, one full width, two halves):

1. **Current event.** From `keys.events`: the event with `isCurrent`. Shows name and year, `StatusChip` (1 Planned, 2 Scheduled, 3 Live, 4 Ended, 5 Cancelled), `scheduledAt`, `wentLiveAt`, `endedAt` (Mountain time, section 7.5), `fundsPercent`, the route as `#<routeId>` or "no route", a "Change status" menu with one entry per other status that opens the same `StatusDialog` as the event page (6.3), and an "Open event" link. "No current event" with a link to Events when none is flagged.
2. **Active beacon.** From `keys.beacons`: the beacon with `isActive`. Name, a Healthy or Unhealthy chip from `healthy`, `keyPrefix`, heartbeat age, last location age, `staleSince`, `staleAfterS`, and an "Open beacon" link. "No active beacon" in red when an event is live, grey otherwise.
3. **Published state.** Section 5.1, plus `lastWriteAt`, `lastWriteSeq`, `lastWriteVersion`, `lastWriteNode`, and the answering node's `instance`, `isLeader`, `leaderEvaluatedAt`, `cacheRefreshedAt` from `GET /admin/live`, and the Republish button behind a confirmation.
4. **Snapshot.** `version`, `builtAt`, `s3Key`, `url` as a link, and a "Rebuild snapshot" button (`POST /admin/snapshot/rebuild`, no confirmation).
5. **Live object.** The CDN object as a field grid: `eventId`, `eventStatusId`, `seq`, `lat`, `lng`, `speedMps`, `altitudeM`, `headingDeg`, `accuracyM`, `recordedAt`, `receivedAt`, `publishedAt` with its age, `pollIntervalMs`, `snapshotUrl` as a link, and `cookieTally` joined with `keys.cookieTypes` names when that query is loaded (fetched on entry, not polled). Below it the raw JSON in `ThemedJsonView`, and a second `ThemedJsonView` with `node.live` from `GET /admin/live` for a side-by-side check. "CDN object unavailable." when the CDN fetch has no data.

### 6.3 Events

**List** (`/events`): a `ResponsiveTable` (section 1) over the events ordered as returned. Desktop: year, name (link), `StatusChip`, "Current" chip, `scheduledAt`, route (name from `keys.routes` by `routeId`, `#<id>` when the recording is unknown, or "none"), `fundsPercent`, then the edit pencil (opens the detail page), a row menu, and the Audit cell. Compact: one card per event with the name (link) as the title and the year as the subtitle, the `StatusChip` and the Current chip in the chip row, the scheduled time, the route, and the funds percent as "label: value" lines, and a footer with the edit pencil and the row menu on the left and the audit icon button on the right. The row menu holds "Set current" (hidden on the current event), Clone, and Delete (disabled with the tooltip "This event is live. End it first." or "This is the current event. Make another event current first."). "New event" opens `EventCreateDialog`. Clone opens `EventCloneDialog`: `year` (default the source year plus one), `name` (default the source name with the year replaced), and three checkboxes, all on by default: "Sponsors for the year", "Flight history", "Route poster"; "Clone" sends `POST /admin/events/{id}/clone { year, name, copy }` and navigates to the new event; `409 year_taken` marks the year field.

**Create dialog**: fields `year` (number, default the current year), `name`, `scheduledAt` (datetime-local, optional), `fundsPercent` (number, default 0), and a route radio group with three explicit choices:

| Choice | Body |
|---|---|
| Inherit the most recent route | `inheritRoute: true, routeId: null` |
| Choose a route (select from `keys.routes`) | `inheritRoute: false, routeId: <selected>` |
| No route | `inheritRoute: false, routeId: null` |

Under the inherit choice the dialog shows what the rule selects, computed from the two lists it holds: the event with the greatest `year` whose `routeId` is not null, as "Will inherit <route name> from <event name>", or "No earlier event has a route" (the API applies the same rule; this is a preview of it). Success navigates to the new event.

**Detail** (`/events/:id`): the shared `PageHeader` carries the name as the title with the `StatusChip` and, when `isCurrent`, a "Current event" chip beside it; then a `Grid` of cards: Details and Status side by side on desktop and full width on compact, then Messages, Route poster, Flight history, and Locations full width.

- **Details**: `name`, `year`, `scheduledAt`, `wentLiveAt`, `endedAt`, `fundsPercent`; Save is enabled only while a field differs from the event and sends only the changed fields as `PATCH`. The Clear button on `scheduledAt` is disabled with the tooltip "Required while the event is scheduled" when `statusId === 2`. Save, "Set current" (hidden on the current event), and Delete (disabled with the same tooltips as the list) live here with their confirmations (8.3) in a wrapping button row (`flexWrap`) with Delete last so the row folds to two lines on a narrow card without hiding anything.
- **Status**: the current `StatusChip`, then whether subscribers know: `statusNotifiedAt` set renders "Subscribers were notified <age> ago"; null renders "Nobody was notified of <status>" in the warning colour with a "Notify subscribers" button that opens `NotifyDialog` (the verified count line, an optional message field of up to 1000 characters with the stock paragraph for this status as its placeholder, and "Send now", which calls `POST /admin/events/{id}/notify { message }` and refreshes the event and the history). Then a wrapping row of one button per other status, disabled with a tooltip: Scheduled when `scheduledAt` is empty ("Set a scheduled time first"); Live when `!isCurrent` ("Set this event current first"), when another event has `statusId === 3` ("<name> is live"), or when no beacon in `keys.beacons` is both `isActive` and `healthy` ("No healthy active beacon: <reason>", the reason being "none is active", "<name> is revoked", "<name> is stale since <Mountain time>", "<name> has never been heard from", or "<name> is not healthy"). Clicking opens `StatusDialog` (below). The API repeats the check (`409 no_healthy_beacon`, 8.2), so a beacon that goes stale between the render and the click is caught too. Under the buttons, the status history is a `ResponsiveTable` newest first with the change (from → to, or "announced again" when equal) as the title, and who, when, and Notified as label lines; Notified is "No" when `notify` is false, otherwise "Yes · <sentCount> sent" with the custom message's first 60 characters after it when one was given. The history has no row actions and no Audit cell (audit lives on the event, § 6.22).
- **Messages**: post form with `body` (multiline), then a wrapping row of `eventTime` (datetime-local, optional, with a Clear button once set), a `notify` checkbox (off by default), and Post; on a narrow card the row folds so every control keeps its full width. The list newest first as outlined cards showing body, `eventTime`, `createdBy`, `createdAt`, each with an edit pencil (inline form for `body` and `eventTime`; `PATCH`, no notify) and a delete icon (`ConfirmDialog`, "Delete message? This cannot be undone.") on one line beside the body.
- **Route poster**: the current `routeImage` asset (480 px variant, filename, dimensions) or "No poster.", a "Choose poster" button opening `MediaPicker` (6.15, raster only, titled "Choose route poster"; it can upload on the spot), and "Remove poster" when one is set. On compact the title and the button row stack under each other and the preview image scales to the card (`maxWidth: 100%`). Both send `PATCH { routeImageMediaId }` (the asset id, or an empty string to remove); `409 media_not_ready` reopens the picker with a warning toast. Helper text: "Shown on the route page and as the route preview. Use the highest resolution you have; the site serves smaller copies where it can."
- **Flight history**: helper text "Visitors can turn this on in the tracker menu to see the projected route. Change it any time; the site picks it up on the next snapshot." Current recording (`name`, `pointCount`, `createdAt`, `uploadedBy`, `url` as "CDN link") or "No recording linked." "Shared with" lists the other events whose `routeId` equals this one, from `keys.events`. Actions in the header on desktop, and in a wrapping row under the title on compact: Upload (opens `RouteUploadDialog`, 7.3), "Record from this event" (`POST /admin/routes/from-event/{id}` with the name "<event name> recording", then `PATCH { routeId }`), and Unlink (`PATCH { routeId: null }`) when a recording is linked. Below, "Choose existing": a select over every recording in `keys.routes`, each option "<name> · <pointCount> points · <createdAt> · used by <event years, or 'no event'>", newest first, the current recording preselected, with a "Use this recording" button that sends `PATCH { routeId }` (disabled while the selection equals the linked recording); the select and the button stack on compact so each takes the card's full width. An upload on this page is one action: `POST /admin/routes` then `PATCH /admin/events/{id} { routeId }`.
- **Locations**: filters `beaconId` (select from `keys.beacons`, "Any beacon") and `publishedOnly` (switch); on compact the two filters stack under each other and the title and Download row also stacks. One page of `LocationRow` (`limit` 100) in a scrolling box that keeps a table on every viewport (a preview of raw rows, not a phone card list), scrolling horizontally when the columns exceed the card width; columns `seq`, `beaconId`, `published`, `recordedAt`, `lat`, `lng`. "Download CSV" calls `events.locationsCsv` with the same filters and saves `locations-<year>.csv` through `downloadBlob`. The download goes through `fetch` because the request needs the `Authorization` header.

**StatusDialog** (shared with the dashboard): title "Change status of <name>: <from> to <to>"; a message field (multiline, optional, up to 1000 characters, a counter) whose placeholder is the stock paragraph of the target status' template (`lib/statusCopy.ts`, kept in step with the API's email template by hand), so the admin sees what goes out and can replace it; the consequence line "<verified count> verified subscribers will be emailed" (count from `keys.subscribersSummary`, fetched when the dialog opens). Two confirm buttons instead of a checkbox: "Change and notify" (primary; sends `notify: true` and the message when typed) and "Change without notifying" (text button), the latter asking once more in a nested dialog ("Change the status without telling subscribers? You can notify them later from the event page.") before it sends `notify: false`. On compact the actions row stacks the buttons (`flexDirection: column`) full width so each one is easy to reach. For target 3 the dialog adds the active beacon line from `keys.beacons`: "Active beacon: <name>, healthy or unhealthy, heartbeat <age>, hub connected, polling, or unknown" (or "Active beacon: none"), the gate reason in red with both confirm buttons disabled when the gate fails, and "Another event is already live." when one is. Confirm sends `{ statusId, notify, message }`; a `409 no_healthy_beacon` answer renders `details.beacon` (name, last seen, stale since) or "No beacon is active" in the dialog and the caller refetches beacons. `StatusDialog`, `NotifyDialog`, `EventCreateDialog`, `EventCloneDialog`, and `RouteUploadDialog` all go full screen through `AppDialog` below `sm`; the Expected shape `pre` in `RouteUploadDialog` scrolls horizontally inside its box on a narrow viewport rather than pushing the dialog wider.

### 6.4 Flight recordings

`/routes`, titled "Flight recordings", with the lead text "Recordings of past flights. The one linked to an event is its flight history on the tracker, and what Red-Nose replay and exports use. The route page shows the poster on each event." Table newest first: `name`, `pointCount`, `createdAt`, `uploadedBy`, a "CDN" link, "Used by" (events with this `routeId`, from `keys.events`), a row menu with Delete, and the Audit cell. Delete opens `DeleteDialog` (8.3). Toolbar: "Build from event" (a dialog listing the ended events, a route name defaulting to "<event name> route", `POST /admin/routes/from-event/{eventId}`) and "Upload recording" (`RouteUploadDialog` without linking to an event).

### 6.5 Beacons

**List** (`/beacons`, polled): a `ResponsiveTable` by name: title is the name (link), subtitle is the `keyPrefix` in `<code>`, chips are the "Active" chip, the Healthy or Unhealthy chip (`healthy`), the hub state chip (connected, polling, unknown from `hubConnected`), and the flag chips (5.2); the lines are last seen, last heartbeat, and last location as ages with the absolute time as the title; actions are the edit pencil (opens the beacon page) and a row menu; then the Audit cell. The row menu holds Activate (when not active), Deactivate (when active), Rotate, Revoke, and Open. On compact each row becomes a card carrying the same title, subtitle, chips, lines, actions, and audit button (M34). Revoked beacons are not in this list: they sit in a `Revoked (n)` accordion under it, collapsed by default, as a second `ResponsiveTable` with the same title, subtitle, and lines, a "Revoked" chip, no flags, the pencil only, the Audit cell, and rows greyed through `rowSx`; an empty accordion is not rendered. "New beacon" opens `BeaconCreateDialog`: `name` and `notes` only, with the text "A beacon is a key. Anything that holds it can post locations, heartbeats, and logs; what runs behind it is up to you."

**KeyRevealDialog** (after create and after rotate): the `key` in a monospace read-only field with a Copy button; the `enrollment.qrPngDataUrl` as `<img>` fixed at 220 px and centred (same on the full-screen phone dialog); `enrollment.url` as text with Copy; a live countdown to `enrollment.expiresAt` ("QR valid for 14:32"; at zero, "QR expired. The key still works when typed by hand; rotate to mint a new QR"); the warning "This key is shown once. Store it before closing." The dialog has no backdrop close and no escape close; the only button is "I have stored the key".

**Detail** (`/beacons/:id`): selects the row from `keys.beacons` (same poll as the list, `staleAfterS` included). Header through `PageHeader`: title is the name, the chips are the `keyPrefix` in `<code>`, an Active or Revoked chip, and the Healthy chip (not for revoked); below it a revoked banner with `revokedAt`, and the flag chips. Cards: Details (an Edit button unlocks `name` and `notes`, Save sends the changed fields, "Created by <createdBy> on <createdAt>"), Actions (Activate or Deactivate, Rotate key, Revoke; none for a revoked beacon; the same confirmations as the list; buttons wrap), Ages (`lastSeenAt`, `lastHeartbeatAt`, `lastLocationAt`, `staleSince`, each as an age plus the absolute Mountain time, with the absolute time wrapping under the age on compact; `heartbeat_old` and `stale` colour theirs red), Telemetry (`TelemetryPanel`; its search row and the JSON tree fit and the tree scrolls inside its box, M33), and Logs (`BeaconLogs`).

**TelemetryPanel**: `telemetry === null` renders "No heartbeat received". Otherwise two blocks:

| Block | Content | Coloured by |
|---|---|---|
| Health | `sentAt` with its age; hub: connected, polling, or unknown from `hubConnected`; then each of the three `health` leaves the beacon reported (`batteryPercent` %, `lastFixAgeS` s, `socketState`), "not reported" for a missing leaf, "unknown" for null | `battery_low`, `no_recent_fix`, `socket_down` |
| Debug | the beacon's `debug` object as a themed, collapsible JSON tree (`ThemedJsonView`, expanded two levels, copy button, search box filtering keys); "This beacon sends no debug data" when null or empty | nothing; the panel never reads it |

The panel has no idea what a beacon is, so it names nothing inside `debug`; Red-Nose's power, radio, GPS, transport, process, and identity groups appear there exactly as the phone sends them, and the simulator's or the legacy beacon's own objects the same way.

**BeaconLogs**: a `ResponsiveTable` from `GET /admin/beacons/{id}/logs` newest first (title `receivedAt`, lines `appVersion` and `sizeBytes`, action View); View fetches the text and shows it in a `<pre>` under the list with Download (`download.ts`, `beacon-<id>-log-<logId>.txt`) and Close; the `<pre>` scrolls horizontally inside its box. Shown for every beacon; "No logs uploaded." when empty.

### 6.6 Sponsors

**List**: table as returned: logo (the resolved `logo` asset's 480 px variant or `url`, 40 px, or "none"), name (link), latest year and years count derived from `years[]`, `websiteUrl` as a link, the edit pencil (opens the detail page), and the Audit cell; there is no row menu (delete lives on the detail page). "New sponsor" opens a dialog with `name` plus the seven optional fields (contact person, email, phone, address, website, Facebook, Instagram); success navigates to the detail page. "Import from year" opens `SponsorImportDialog`: a from-year select (every year present in any sponsor's `years[]`, newest first), a to-year select (default the current event's year, the events' years as options), then a checkbox list of the sponsors that have the from year and not the to year (logo, name, that year's amount), all ticked by default, and "Import <n>", which sends `POST /admin/sponsors/import { fromYear, toYear, sponsorIds }` and reports "Imported n, skipped m".

**Detail**: a header with the name and "Delete sponsor" (`DeleteDialog`, 8.3); a Details card (`name`, `contactPerson`, `email`, `phone`, `address`, `websiteUrl`, `fbUrl`, `igUrl`; Save sends changed fields; empty strings become `null`; "No changes" when nothing differs); `LogoSection`; the Years card.

**Years**: table of `years[]` (`eventYear`, `amountDonated` shown as received, `active`, `canAdvertise`, `anonymous`, "Tracker time" as `lingerMs` in seconds with "(override)" when `lingerMsOverride` is set, "#n" when `pinnedPosition` is set, `registeredAt`, the edit pencil, a row menu with Delete, and an Audit cell with no stamp), "Add year", and "Add year from…": a menu of the sponsor's existing years, then a small "Copy year" prompt for the target year (default the current event's year, 2000 to 2100) that sends `POST /admin/sponsors/{id}/years/{targetYear}/copy-from/{sourceYear}` and opens the new row in `SponsorYearDialog` for editing; `409 year_exists` renders "The sponsor already has this year." on the prompt. `SponsorYearDialog` fields: `eventYear` (number; fixed when editing), `amountDonated` (text, optional, "Empty means no amount recorded"), three switches defaulting to `true`, `true`, `false` on add, `lingerMsOverride` as "Tracker time override (seconds)" (number, optional, 0 to 600; the helper text shows the computed value from `amountDonated` and the two settings, fetched from `keys.settings` while the dialog is open), and `pinnedPosition` (number, optional, 1 to 1000; the helper text points to the Sponsor order page). Save is `PUT .../years/{eventYear}` (an upsert, so add and edit are the same call); `409 pinned_position_taken` is a field error on `pinnedPosition`: "Position is taken for this year; use Sponsor order to rearrange". Deleting a year is a `ConfirmDialog` ("Delete the <year> row? This cannot be undone.").

**Sponsor order** (`/sponsors/order`, its own drawer entry, editor and admin): a year select (defaulting to the current event's year, options from `keys.events`), a `CommentBox` ("Largest gift first unless pinned. Tracker time is the gift times the per-dollar rate (Settings), floored at the minimum, unless overridden here."), then one list in the exact order the site will show, from `GET /admin/sponsors/order/{eventYear}`. Rows show a drag handle, logo, name, amount, tracker time, and either "pinned #n" or "by amount". The pinned rows sit at the top and are drag-reorderable (`@dnd-kit`); a row's pin icon moves it to the bottom of the pinned block, unpin drops it back into the by-amount block. Every reorder, pin, or unpin sends the whole pinned list as `PUT /admin/sponsors/order/{eventYear} { pinnedSponsorIds }` and replaces the list with the response. An inline "Time (s)" field per row saves `lingerMsOverride` on blur with `PUT .../years/{eventYear}` (the other year fields resent unchanged from the sponsors list). A sponsor whose year row fails the snapshot filter (inactive, anonymous, or may not advertise) is greyed with "Not on the site" and cannot be pinned or timed.

**LogoSection**: the current `logo` asset (image, filename, dimensions) or "No logo", a "Choose logo" button opening `MediaPicker` (6.15, which can upload on the spot), and "Remove". Both send `PATCH { logoMediaId }`; the response `Sponsor` replaces the cached row. `409 media_not_ready` (an upload that never confirmed) reopens the picker with a warning toast.

### 6.7 Cookie types

Table ordered as returned: icon (the library icon's image at 32 px, "media" for an uploaded SVG, or "none"), `name`, `sort`, `active`, `cookieCount`, then the edit pencil (a dialog with `name`, `sort`, `active`, and an icon row with Choose and Clear that opens `components/content/IconPicker`), a row menu with Delete, and the Audit cell. Delete opens `DeleteDialog` (8.3): the impact preview carries the cookie count that would go with the type. "New type" opens the same dialog with `active` default on. `active` off removes the type from the snapshot without deleting it. The icon picker offers the library, uploaded SVG assets (`kind=svg`, `state=ready`), and an Upload SVG tab.

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

Each row shows the key, the description, a number input with the range as helper text, `updatedBy` and `updatedAt` ("default" when null), its own Save button (`PUT /admin/settings/{key}` with `{ value }`), and the Audit cell. Validation per 7.2; the response `Setting` replaces the row. A `CommentBox` states that every save rebuilds the snapshot and rewrites the live object, so a new poll interval reaches the site within its next poll. The specs live in `validation/settings.ts`.

### 6.10 Subscribers

Header counts from `GET /admin/subscribers/summary` as chips: verified, pending, unsubscribed. Filter: All, Verified, Pending, Unsubscribed (maps to the `status` query, absent for All). Paged table: `personEmail`, `address`, `channel`, `verifiedAt`, `unsubscribedAt`, `createdAt`, a delete icon (`DeleteDialog`, 8.3), and the Audit cell.

**Export CSV** walks the list for the selected filter with `limit: 500`, following `nextCursor` until it is `null`, showing "Exporting: <n> rows" on the button meanwhile, then builds the CSV with header `id,personId,personEmail,channel,address,verifiedAt,unsubscribedAt,createdAt` (RFC 4180 quoting, CRLF, `null` as empty) and saves `subscribers-<filter>-<yyyyMMdd>.csv`.

### 6.11 People and contact messages

`/people`: paged table `email`, `cookieCount`, `createdAt`, `lastSeenAt`, a delete icon, and the Audit cell. `/contact-messages`: paged table `createdAt`, `name`, `email` (as a `mailto:` link), `body`, `clientIp`, a delete icon, and the Audit cell. Both deletes open `DeleteDialog` (8.3); the impact preview states what goes with the row.

### 6.13 Pages

`/pages`: a `CommentBox` ("Changes here are drafts until you publish.") and two tables. **Status pages**: the six role pages in status order (No event, Planned, Scheduled, Live, Ended, Cancelled), each with its role, title (link), section count, problem count (a red chip when non-zero), an edit pencil that opens the editor, and the Audit cell; they have no settings icon and no row menu. **Pages**: the `none` pages in nav order, each with up and down arrow buttons (each press swaps two rows and sends the whole order as `PUT /admin/pages/order`), slug, title (link), nav label (or "not in nav"), hidden state, section count, problem count, the edit pencil, a settings icon (`PageSettingsDialog`: `slug`, `title`, `navLabel` behind a "Show in navigation" checkbox that defaults the label to the title, `isHidden`; `PATCH`), a row menu with Delete (`DeleteDialog`, 8.3), and the Audit cell. "New page" opens `PageCreateDialog` (`title`, `slug` auto-derived from the title until edited, "Show in navigation" with an optional nav label); success opens the editor.

### 6.14 Page editor

`/pages/:id`, the panel's main surface. Layout: a header with the page title and `/slug` on the left and, on the right, a chip ("No problems" green, or "<n> problems" red, from `problemCount` on the page), a "Page settings" button (`PageSettingsDialog`, available on every page), and a "Publish" button that navigates to `/publish`; below it the section stack; under the stack an "Add section" button. There is no preview on this page (6.17).

**Section stack**: one `SectionCard` per section in order, each preceded by up and down arrow buttons (a press swaps two sections and sends the whole order as `PUT .../sections/order`). A card whose kind is not in `keys.kinds` renders an error alert "Unknown kind: <kind>" instead. "Add section" opens `SectionPalette`: every kind from `keys.kinds` in the order returned as a full-width button with title and description, kinds whose `allowedRoles` exclude this page's role disabled with the tooltip "Not allowed on the "<role>" page"; choosing one calls `POST .../sections { kind, data: defaults }` and the new card appears at the end.

**Section card**: a header with the kind's title, a "Live" chip for live kinds, the save state ("Saving…", "Saved", "Not saved"), a problems badge, a Hidden switch (`PATCH { isHidden }` at once), and a menu: Duplicate, Move to page (`MoveSectionDialog`: a list of the other pages, targets whose role forbids the kind disabled with "not allowed on this page"; the section lands at the end of the target), Delete (`ConfirmDialog`, "Delete the <kind> section? This cannot be undone."). Two tabs, Content and Presentation. Content renders `SchemaForm` over the kind's `schema` and, for kinds with items, `ItemsEditor`. Presentation renders `PresentationPanel`. Under the tabs, `ProblemList` with the section's problems from the page response, and a "Save now" button. Content edits are saved on blur and on a 1 s debounce with `PATCH { data }` (`useDebouncedSave`); presentation edits on the same debounce with `PATCH { presentation }`; an unmount flushes both. A `400 validation_failed` lands on the named field through RJSF's `extraErrors` (`lib/fieldErrors.ts` turns `details.fields` JSON pointers into an `ErrorSchema`).

**`ItemsEditor`**: a sortable list (`@dnd-kit`, plus up and down buttons per row) of `SchemaForm`s over the kind's `itemSchema`, each row labelled "Item #<id>" with a remove icon; "Add item" posts the kind's `itemDefaults`. Every change to an item's form sends `PATCH /admin/items/{id} { data }` at once; there is no debounce, no duplicate, and no hide on items.

**`PresentationPanel`**: selects for width (`full`, `wide`, `narrow`), align (`start`, `center`), spacing (`tight`, `normal`, `loose`), background (none, token with a token select over `surface`, `muted`, `accent`, `night`, or media, which writes an empty media reference), and a text field for the anchor. Icon before and after and the media overlay are not editable here.

**`SchemaForm`** is `@rjsf/mui` with `validator-ajv8`, `liveValidate`, no error list, and no submit button. The schema is first bundled (`schemas/bundle.ts` rewrites the primitives `$ref` URLs to local `#/$defs/...`, merges the primitives' `$defs`, and drops `$schema` and `$id`), then reduced to the draft level (`schemas/draft.ts` removes `required`, `minLength`, `minItems`, and `minimum` at every level and keeps everything else), so an editor sees type errors immediately and incompleteness only as a publish problem. A custom `SchemaField` routes by the schema's `$ref`:

| `$ref` | Field | Behaviour |
|---|---|---|
| `#/$defs/Inline`, `#/$defs/InlineNullable` | `InlineField` | A multiline text field with a character counter (the schema's `maxLength`, default 5000); an empty value on a nullable schema is sent as null |
| `#/$defs/Icon`, `#/$defs/IconNullable` | `IconField` | The current icon as a chip ("Library: <id>" or "Media: <id prefix>") or "None", a Choose button opening `pickers/IconPicker` (a Library tab with a search box over name and tags, picking on click; an Uploaded SVG tab over `MediaGrid` filtered to ready SVG assets), Clear on nullable schemas |
| `#/$defs/MediaRef` | `MediaField` | "Media: <id prefix>" or "No media", Choose opening `MediaPicker`, an "Alt override" text field (empty means null) |
| `#/$defs/Link` | `LinkField` | Label and Href text fields, an icon line with Choose (the same icon picker) and Clear, an "Open in new tab" checkbox |
| an array whose `items` is `#/$defs/Block` | `BlocksField` | A list of blocks, each a box with the kind name, Duplicate, Delete, and, for `heading`, `paragraph`, and `quote`, a Text field; an "Add block" select over heading, paragraph, list, quote, media, links, icon, divider that appends the block's default shape |
| `#/$defs/Presentation` | `PresentationPanelField` | `PresentationPanel` as above |

`ThemeField` is registered by name for `uiSchema` use (6.16). Everything else (strings, numbers, booleans, enums, nested objects, arrays of scalars) is the generator's default MUI widget, so a new field in a kind schema appears in the panel with no panel change.

### 6.15 Media library

`/media`: an `Uploader` drop zone at the top and a `MediaGrid` below with filters (search, kind, state) backed by `keys.media(q)` as an infinite query.

**Upload** (`useMediaUpload`): for each dropped or chosen file, the client pre-check (7.4: type by magic bytes, size against 20 MB or 1 MB) runs first; then `POST /admin/media/upload-url`, `uploadToS3` with a progress bar, `POST .../confirm`; the row under the drop zone shows "Checking file", "Queued", "Requesting upload URL", "Uploading <n>%", "Confirming", "Ready", or the failure reason with a Retry that repeats confirm (when only that step failed) or the whole sequence (a pre-check refusal has no Retry). Several files upload in parallel, at most three at a time. Alt and title can be typed before the upload starts and are sent on the ticket. "Clear completed" removes the ready rows. Filenames are sanitised to letters, digits, dots, dashes, and underscores, at most 100 characters.

**Card**: the 480 px variant (or the original for svg and gif), filename, dimensions, size, kind chip, a "Deep zoom" chip when `dziUrl` is set, state chip (pending grey, ready none, orphaned amber with "Expires in N d"), and an edit pencil. The pencil and a click on the card open `MediaDetailDrawer` (right-anchored, 480 px): the original, kind, state, and dimensions, `alt` and `title` editable (`PATCH`), the original, every variant, and the deep-zoom descriptor as links with a copy-URL button each, a `UsageList` from `GET .../usage` (draft pages as links to their editors, version count, sponsors, cookie types, site settings, and the events whose route poster it is, derived from `keys.events`), and Delete. Delete opens `DeleteDialog` (8.3); a `409 media_in_use` renders "In use by:" with the usage list from `details.usage`.

**`MediaPicker`** (used by `MediaField`, the sponsor logo, the route poster): a dialog with a Library tab (the same grid fixed to `state=ready` plus the kind the caller passes, with the search box) and an Upload tab that runs the uploader inline and picks the asset the moment it is ready; Choose confirms a grid selection.

### 6.16 Site settings

`/site-settings`: one `SchemaForm` over the vendored `site-settings.schema.json` at the draft level, with the same custom fields plus `ThemeField` for the theme object through `uiSchema` (two switches, "Snow on by default" and "Lights on by default", with the caption "Colours and fonts are part of the site design; visitors pick light or dark themselves."); `footerText` gets three rows. Save (enabled once the form is dirty) sends the whole document with `PUT`; problems from `GET /admin/site-settings` render in a paper above the form. A Preview button (6.17) opens the home page. A `CommentBox`: "Settings are drafts until you publish."

### 6.17 Preview

`PreviewFrame` is a large dialog holding an `<iframe>`. Opening it calls `POST /admin/content/preview-token` once and sets `src` to the token's URL plus `&page=<slug>` (the home page when no slug is chosen); a page select over `keys.pages` switches pages without a new token. A Reload button remounts the frame (or mints a new token once the current one has expired); "New token" always mints. A caption shows "Token expires in <n> min" or "Token expired". A device select sets the frame width to 375, 768, or 1200 px. The frame is the real public site, so it also shows the current live data. Site settings is the only page that mounts it.

### 6.18 Publish

`/publish`: the `ContentStatus` card at the top: "Published version <id> (<label>) by <email> <age>" (or "Nothing published yet."), "Draft changed <age>", and either "No unpublished changes", "Ready to publish" (green), or "<n> problems block publishing" (red), with a Publish button enabled only when ready. Under it, when there are problems, a Problems paper where every row links to the section (page editor, `#section-<id>`), the page, or site settings. The Publish button opens a `ConfirmDialog` with an optional label (up to 100 characters) and the consequence line "The public site updates within its next poll."; success shows the new version and refreshes the list. `409 content_unchanged` shows "Nothing to publish"; `422 content_invalid` refreshes the status and shows "The draft has publish problems; the list above was refreshed."

**Versions**: the newest 50: id, label with a "Published" chip on the one whose id matches the status card, publisher, time, page and section counts, row actions, and the Audit cell. Row actions: View (a dialog with an Overview tab, site settings as JSON and pages with their section kinds, and a Raw JSON tab in `ThemedJsonView`), Restore (`ConfirmDialog`: "Replace the current draft with version <id>? Unpublished changes are lost. Nothing is published until you publish."), and Restore and publish (the two calls in sequence with the label "Restored from version <id>", confirmed the same way with the added line "The public site updates within its next poll.").

### 6.19 Auth pages

`SignIn`, `Callback`, `NoRole`, `MfaSetup`, `ConfigError` per section 3. Each renders the title, the environment badge, and one action; none fetches from the API.

### 6.20 API keys

`/api-keys`, `admin` only. Lead text: "Keys let a script or an agent, such as Claude Code, configure the site without signing in. A key is shown once."

**List**: table newest first: name, `keyPrefix` in monospace, capabilities ("All" or the list as chips with plain-word labels), `expiresAt` (Mountain time, or "Never"; red when past), `lastUsedAt` as an age, `createdBy`, `createdAt`, a status chip (Active, Expired, or Revoked; revoked rows greyed), a row menu with Revoke (absent on revoked rows), and the Audit cell. Revoke confirms with "Revoke <name>? Anything using it stops working immediately." "New key" opens `ApiKeyCreateDialog`.

**ApiKeyCreateDialog**: `name` (text, 1 to 100); an "All capabilities" switch (on by default) that, when on, disables the individual list and sends `allCapabilities: true` with an empty `capabilities`, and otherwise a checkbox per capability from the contracts list, labelled in plain words (Events, Flight recordings, Beacons, Sponsors, Cookie types, Pages, Sections, Site settings, Publish and versions, Media, Icons, Settings, Contact messages, Subscribers, People, Diagnostics, Audit), at least one required; and a "Never expires" switch (on by default) with an `expiresAt` datetime-local validated at least one hour ahead. `409 name_taken` is a field error on `name`. Success opens `KeyRevealDialog` (the same component the beacons page uses, without the QR block).

### 6.21 Agents

`/agents`, `admin` only. The page for running an agent (Claude Code or any script) against the admin API for one session. Lead text: mint a key with only the capabilities the job needs, give the agent the key and the prompt, let it work, then revoke the key. An info block spells out the four steps (mint, hand over, work, revoke) and why revocation is the only lasting control: keys are hashed at rest, cannot mint or revoke keys, and skip the TOTP gate.

Below it the page mounts `ApiKeysList` unchanged (the same component as `/api-keys`, so minting and revoking happen in place), then the **Agent prompt**: `pages/agents/agentPrompt.ts` exports `buildAgentPrompt(baseUrl)`, a plain-text guide to the API for an agent (base URL and bearer auth, the error shape and codes, paging, the working set and publish model, every endpoint group keyed by the capability that reaches it, the Cognito-only key endpoints, five workflows, and the rules: never change a status, publish, restore, delete, touch beacons, or change a setting unless asked; read `GET /admin/content/kinds` before writing data; media through the ticket flow; no em or en dashes in copy). The page renders it with `config.apiBaseUrl` filled in, in a monospace read-only block with a Copy button (a clipboard failure leaves the text on the page). The prompt is kept in step with contracts 4.5 by hand; a test asserts it names every capability group and carries no dashes.

### 6.22 Audit

`/audit`, its own drawer entry (admin and editor): filters `entity` (from `GET /admin/audit/entities`), `action` (the known verbs, `AUDIT_ACTIONS`), `actor` (text), and a quick chip "Deletes" that toggles `action=delete`; a table newest first paged with a cursor (Load more): an expand toggle, time, actor, action, entity and id (a link to the row's page for events, beacons, sponsors, pages, and QR codes when the entry is not a delete, plain text otherwise), and the same changed-fields summary the history dialog uses, expandable to the raw before and after JSON. Deleted rows are readable here and nowhere else.

### 6.23 QR codes

`/qr-codes` (admin, editor, canvasser): the table of `QrCode` rows by tag: tag (link to the detail), attached to (the place path joined by " › ", or an "Unattached" chip: warning when it has scans, muted otherwise), opens (the resolved target with "(from place)", "(own)", or "(default)"), people (unflagged scans), last scan (date, the full time as a tooltip), printed ("Batch n · <date>"), then the pencil, the row menu (Attach…, Detach when attached, Disable or Enable, Delete for admins), and the Audit cell; inactive rows are greyed. Toolbar: a "Generate" number field (default 10, 1 to 100) with a "Generate n more" button (`POST /admin/qr-codes { count }`) and "Print sheet", which opens `PrintSheetDialog`: a batch select (default the newest), a size select (50 mm, six per row; 100 mm, three per row; 200 mm, one per row; 300 mm, one per page) with the note "A phone reads a code from about ten times its width.", and a Print button that renders the codes at the chosen size with the tag under each into a print-only stylesheet (`@page` margins, `break-inside: avoid`) and calls `window.print()`. Codes are drawn in the browser with the `qrcode` package the panel already uses for TOTP enrolment (`qrRender.ts`), encoding `<VITE_SITE_BASE_URL>/q/<tag>`, error correction M, quiet zone four modules. Attach opens `AttachDialog`, a typeahead over the flattened place paths. Delete opens `DeleteDialog` (8.3).

**Detail** (`/qr-codes/:id`): the code drawn large (320 px SVG) with the tag and address under it and SVG and PNG downloads at a chosen size in millimetres (default 50; the PNG at 300 dpi for that size); a settings paper: attached to (the place path chip with Detach and "Move to another place", or "Unattached" with "Attach…", both through `AttachDialog`), opens (a radio: same as the place, a site page autocomplete over the non-hidden `none` pages, a forward URL field), note (up to 500 characters), an Active switch, printed (read only), and Save (`PATCH`); the history card ("Where it has been": each stay with its place path or "a place since deleted", from and to, people, and "includes n scans from the hour before it was attached" when `earlyScans` is above zero); three stat papers (people over all attachments, flagged hits, people per day over the last 14 days) and the daily bar chart of the last 14 days (`DailyChart`, an inline SVG, no chart library).

### 6.24 Places

`/places` (admin, editor, canvasser): the tree as an indented table (`placeHelpers.toTree`; a caret per row with children, expanded by default): name (link), description, codes (the tags attached now), people (the subtree), location ("Pinned" chip when the row has its own pin, "Uses <ancestor>" when it resolves to one, "Not pinned yet" warning when nothing resolves and the subtree has scans, "No pin" muted otherwise), then the pencil, the row menu (New place inside, Move…, Delete for admins), and the Audit cell. Delete opens `DeleteDialog` (8.3) and removes the place with everything under it; codes hanging anywhere in that subtree become unattached and keep their history (a stay under a deleted place shows "a place since deleted"). Toolbar: "New place" and "Map". `PlaceDialog` (New place, New place inside, Move): parent picker (an autocomplete over the paths, "(top level)" first; a move excludes the place's own subtree), name (1 to 120), description (up to 500), and opens (inherit, a site page, or a forward URL).

**Detail** (`/places/:id`): a Details paper (name, description, parent picker, opens, Save as `PATCH`) beside `LocationCard`; under them "Codes attached here" (each attached tag as a chip whose delete icon detaches it, and an "Unattached code" autocomplete with "Attach here"). `LocationCard`: the chip "Own pin", "Uses the parent's pin", or "No pin", with the pin's source and who pinned it when set; "Use my location" (the Geolocation API; the accuracy shown; refused fixes worse than 500 m with a hint to search or drag); "Use the parent's pin" (deletes the own location; enabled only with an own pin and a parent); a Places Autocomplete search box (the Places API on the same key); and the pin on a Google map (`@googlemaps/js-api-loader`, the site's key), draggable when the place has its own pin. Every pin write is `PUT /admin/places/{id}/location` with its `source` (`phone`, `search`, or `drag`).

**Map** (`/places/map`): an event select (default the current event, "All events" otherwise) and a window select (this event, last 14 days, all time); a Google map centred on the pins' bounds with one circle marker per pinned place sized by its people count (`circleSizeFor`, 24 to 72 px on a square-root scale) with the count inside and a tooltip listing the codes under it with their counts; beside it a card listing every place with scans in the window (path, people, codes) and the counts of unpinned places and unattached codes with scans. Pins are read from `GET /admin/places/map`.

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
| Status | `statusId` | 1 to 5, not the current status | (buttons for the current status are not shown) |
| | `message` | at most 1000 characters, empty becomes null | (counter) |
| Message | `body` | 1 to 1000 | "Message is required" / "1000 characters or fewer" |
| | `eventTime` | null or a valid datetime | |
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
| Page | `slug` | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1 to 60, not `auth`, `preview`, `api`, `admin`, `assets` | "Lowercase letters, digits, and single hyphens" / "This name is reserved" |
| | `title` | 1 to 200 | "Title is required" / "Title must be 200 characters or fewer" |
| | `navLabel` | null or at most 40 | "Nav label must be 40 characters or fewer" |
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

Inputs are MUI `TextField type="datetime-local"` in the browser's local time zone. Conversion:

```ts
// src/lib/time.ts
export function formatMt(iso: string | null | undefined): string;       // "yyyy-MM-dd HH:mm:ss MT" in America/Denver, "" for null or invalid
export function formatMtDate(iso: string | null | undefined): string;   // "Dec 22, 2025 MT"
export function formatMtTime(iso: string | null | undefined): string;   // "18:31:07 MT"
export function toLocalInputValue(iso: string | null | undefined): string;      // yyyy-MM-ddTHH:mm in the browser zone, "" for null
export function fromLocalInputValue(value: string | null | undefined): string | null;   // RFC 3339, UTC, milliseconds, Z; null for empty or invalid
export function ageS(iso: string | null | undefined, nowMs: number): number | null;
export function formatAgeS(seconds: number | null): string;   // "12s", "3m", "1h 5m", "2d"; "" for null; negative ages render as "0s"
```

Every datetime input shows `formatMt(fromLocalInputValue(value))` as helper text so the admin sees the Mountain time that will be stored. Every displayed timestamp uses `formatMt`; every "last X" uses `formatAgeS` (rendered as "<age> ago" or bare) with the absolute value in a title or tooltip where the table has room.

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
| `no_healthy_beacon` | "No healthy active beacon" | the status dialog renders `details.beacon` (name, last seen, stale since) or "No beacon is active"; the caller refetches beacons |
| `cookie_type_in_use` | "<n> cookies use this type; deactivate it instead" (n from `details.cookieCount`) | |
| `event_has_locations` | "This event has recorded locations and cannot be deleted" | |
| `route_in_use` | "Used by an event; unlink it there first" | |
| `pinned_position_taken` | "Position is taken for this year; use Sponsor order to rearrange" | the year dialog marks `pinnedPosition` |
| `name_taken` | "A key with this name exists; revoke it or pick another name" | the key dialog marks `name` |
| `beacon_revoked` | "This beacon is revoked" | |
| `slug_taken`, `slug_reserved` | "That slug is already in use", "That slug is reserved" | |
| `page_has_role` | "Status pages cannot be deleted" | |
| `unknown_kind`, `kind_not_allowed` | "Unknown section kind", "That section kind is not allowed on this page" | |
| `content_unchanged` | "Nothing to publish" | the publish page shows it as an info alert |
| `content_invalid` | "The draft has publish problems" | the publish page refetches the status |
| `media_not_ready`, `media_not_pending`, `upload_not_found` | "The selected media asset is not ready", "The upload has already been confirmed", "The uploaded file did not arrive" | the poster and logo sections reopen the picker on `media_not_ready`; the upload row offers Retry |
| `media_in_use` | "This asset is in use" | the drawer renders the usage list from `details.usage` |
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
| Status change (any target) | `StatusDialog` (6.3) | "Change and notify" / "Change without notifying" |
| Set current | "Make <name> the current event? The public site switches to it on its next poll." | "Set current" |
| Delete event, flight recording, sponsor, cookie type, page, media asset, place, QR code, subscriber, person, contact message | `DeleteDialog`: "Delete <name>?" with the impact preview (above) | "Delete" |
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
| `lib/time.test.ts`, `lib/csv.test.ts` | `formatMt` with MST and MDT dates, the datetime-local round trip, ages, RFC 4180 quoting and CRLF |
| `lib/roles.test.ts`, `lib/statusCopy.test.ts`, `lib/thresholds.test.ts` | the drawer order per role and the canvasser landing; a stock paragraph per status; the thresholds match the vendored JSON |
| `lib/noDashes.test.ts` | no em or en dash anywhere under `src/` |
| `api/errors.test.ts` | body parse, `fields`, `retryAfterSeconds`, 405 without body |
| `api/types.test.ts` | `contracts/fixtures/live-object.json`, `snapshot.json`, `heartbeat.json` satisfy `LiveObject`, the snapshot version, `Heartbeat` (compile-time `satisfies` plus a runtime key check, the `socketState` leaf, the debug object verbatim) |
| `auth/claims.test.ts` | admin, editor, canvasser, admin wins over editor, editor over canvasser, absent, not an array, unknown group; `emailOf` |
| `config.test.ts` | the stripped config, the three env values, every missing name reported, a bogus `VITE_ENV` |
| `schemas/draft.test.ts` | derivation removes `required`, `minLength`, `minItems`, `minimum` at every level and nothing else, does not mutate, handles a nested Presentation |
| `components/audit/auditFormat.test.ts` | actor prefixes, action capitalisation, the stamp text and its fallback, the top-level diff with arrays and objects as "changed", the entry summary for deletes and creates |

### 9.2 Component (Vitest, Testing Library, MSW)

MSW handlers in `src/test/msw/handlers.ts` serve every endpoint in 4.4 from `src/test/msw/fixtures.ts`; unhandled requests fail the test. `renderWithProviders` supplies a retry-free `QueryClient`, the fake `UserManager`, and a `MemoryRouter`. The Maps loader, the barcode reader, and the QR renderer are stubbed where a page needs them.

| Suite | Asserts |
|---|---|
| `boot.test.tsx`, `auth/AuthGuard.test.tsx` | `ConfigError` with no request when a variable is missing; spinner while loading; `SignIn` when no user; `NoRole` for a user without a group; the full drawer for an admin and the editor's entries; a `userLoaded` event without a group switches to `NoRole`; `mfa_required` from the client switches to `MfaSetup`; `userUnloaded` signs out; a route the role cannot open renders Not available, also on direct load; the sign-in button calls `signinRedirect` |
| `pages/Dashboard.test.tsx` | the five cards from fixtures; `write_error` in red; Republish triggers the mutation; the red "No active beacon" while an event is live; the current event fields |
| `pages/events/*.test.tsx` | rows with name and status; the Current chip hides Set current; the route name from the routes list; Delete opens the impact dialog, and is disabled with the tooltip on the live or current event; the create dialog's inherit preview and the No route body; the clone dialog defaults, its POST and navigation, `409 year_taken` on the year field; "Nobody was notified" and `NotifyDialog`'s POST; `StatusDialog`'s two confirms, the nested confirmation, the stock placeholder per status, the verified count line, and the compact actions row stacks the confirms (matchMedia stub); the history table's Notified column and "announced again", and on compact the history renders as cards and the Details actions row wraps (matchMedia stub); Remove poster, Record from this event, Unlink, the flight history select and Use button, "used by no event"; the poster picker reopens on `409 media_not_ready`; the upload dialog's expected shape equals the fixture minus `schemaVersion`, Copy, and the rule lines; a card per event on compact with the pencil and the menu (matchMedia stub) |
| `pages/beacons/*.test.tsx` | rows with name and prefix and no role column; the Active and Healthy chips; the create dialog's text, no role field, `{ name, notes }` only; `KeyRevealDialog` with the key and the QR data URL; rotate on the active beacon while live shows the fan-out sentence; the edit pencil links to the page; revoked rows split into the accordion with the count, greyed and pencil-only, no accordion when none; the Health block colours only the flagged leaves and shows "not reported"; the debug tree keyed verbatim and its empty text; the Healthy and Unhealthy chips; logs render for any beacon; on compact each active and each revoked beacon is a card with the flags and the pencil (the menu button too on active), and the logs list is cards with View (matchMedia stub) |
| `pages/sponsors/*.test.tsx` | the year upsert sends the six fields and rejects an override outside 0 to 600 s; "Add year from…" posts copy-from with the prompted target year and opens the dialog on the new row, and `year_exists` stays on the prompt; the logo `PATCH { logoMediaId }` and the picker reopening on `409 media_not_ready`; the Audit tooltip names the last editor; the import dialog's candidates, re-filtering on the to year, and the tick list in the POST; sponsor order pin, unpin, reorder each send the whole pinned list, and the time field PUTs the year |
| `pages/cookieTypes/CookieTypesList.test.tsx` | the locked banner and disabled controls while an event is live and on `409 event_live`; the icon picker offers the library and SVG assets only |
| `pages/pages/*.test.tsx` | role pages render no delete; reorder sends `PUT /admin/pages/order` with every `none` id; the delete dialog names the section count; the palette greys an excluded kind; add section posts the kind's defaults; a field edit patches once after the 1 s debounce and stays quiet after the refetch; a `400` lands on the field; the problems badge; duplicate, move, hide, delete call their endpoints; items reorder sends the new order |
| `components/content/SchemaForm.test.tsx` | every vendored kind schema renders from its defaults; each primitive `$ref` mounts its custom field; an unknown scalar renders the default widget |
| `components/content/PreviewFrame.test.tsx` | opening mints a token and sets the frame `src` with the page; Reload keeps a valid token and mints after expiry; New token always mints; switching pages keeps the token; the countdown ticks |
| `pages/media/MediaLibrary.test.tsx` | a 21 MB PNG and a 2 MB SVG are refused before any request; the ticket, PUT (mocked XHR with progress), confirm sequence; Retry after a failed PUT repeats the whole sequence; `409 media_in_use` renders the usage list in the drawer; the Deep zoom chip |
| `pages/siteSettings/SiteSettings.test.tsx` | the form renders from the vendored schema with the two theme switches; Save sends the whole document; problems from the draft response; Preview mints a token |
| `pages/publish/Publish.test.tsx` | the three status states with problem links to sections and site settings; publish with a label refreshes the list; `content_unchanged` and `content_invalid`; restore asks and calls the endpoint; restore and publish issues both calls with the generated label; the Published chip |
| `pages/settings/Settings.test.tsx` | every setting from the fixture; `PUT { value }`; out-of-range values never reach the API; a spec for every documented key |
| `pages/subscribers/Subscribers.test.tsx` | the summary counts and rows; the export follows `nextCursor` and writes the documented header |
| `pages/apiKeys/*.test.tsx`, `pages/agents/AgentsPage.test.tsx` | rows with name, prefix, and status; mint reveals once through `KeyRevealDialog`; `409 name_taken` on the name field; revoke after confirmation; the create dialog's rules and bodies; the agents page renders the steps, the keys table, and the prompt with this environment's base URL; the prompt names every capability group and the key endpoints |
| `pages/audit/AuditPage.test.tsx`, `components/audit/AuditHistoryDialog.test.tsx`, `pages/auditColumn.test.tsx` | entries newest first with the summary; the Deletes chip filters; a link on a live row and plain text on a deleted one; the entity filter mounts the entities endpoint; the history dialog fetches by entity and id, expands to raw JSON, and pages with the cursor; every audited table ends with the Audit column |
| `pages/editPencils.test.tsx` | every editable row on every list page carries an edit pencil; flight recordings and API keys do not |
| `components/DeleteDialog.test.tsx` | confirm disabled until the impact loads; the Also deleted and Unlinked groups; names capped at ten with "+n more"; warnings as an alert; "Nothing else is affected"; the blocked sentence with Close only; the role takeover select gates Delete and is sent as `roleTo` |
| `components/AppDialog.test.tsx`, `components/layout/MainLayout.test.tsx`, `components/layout/PageHeader.test.tsx` | `AppDialog` is full screen below `sm` and not above, and honours an explicit `fullScreen` when it disagrees with the viewport; `MainLayout` on compact hides the email, renders the `Open navigation` button, and opens the temporary drawer with a `Close navigation` button and a scrolling list (matchMedia stub); `PageHeader` puts the actions row under the title on compact and inline with the title on desktop |
| `components/list/ResponsiveTable.test.tsx` | on desktop the table renders every column with the actions and the audit cell, and the empty state spans every column; on compact (matchMedia stub) one card per row carries the title, the chips, the "label: value" lines, the actions, and the audit button, and the empty state is the `emptyText` alone |
| `pages/qr/*.test.tsx`, `pages/places/*.test.tsx` | the attachment and Unattached cells; Generate posts the count; the print sheet lists the four sizes; the detail's history card, three stats, and daily chart; the places tree with location cells; New place posts the trimmed name; a refused delete shows the API's message and keeps the row; Use my location writes the pin with source `phone` and refuses a fix worse than 500 m; Use the parent's pin deletes the own location; `circleSizeFor` grows with the count; the map's side list and counts; the scan flow with a fake reader: an unattached tag opens the sheet and New place plus a phone pin runs three calls, an attached tag lands on Move and Done, manual entry opens the same flow |

### 9.3 End to end (Playwright, dev stack)

Runs against `vite preview` on `http://localhost:5174` with the dev variables, so the origin is registered on the dev Cognito client, in the dev CORS list. `playwright.config.ts` builds and previews the app itself, one worker, two projects: `chromium` (`Desktop Chrome`, every spec except the mobile one) and `mobile` (`Pixel 7`, viewport 390 x 844, `isMobile`, `hasTouch`, only `09-mobile.spec.ts`), traces and video on failure. Secrets on the `dev` GitHub environment: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ADMIN_TOTP_SECRET`, `E2E_EDITOR_EMAIL`, `E2E_EDITOR_PASSWORD`, `E2E_EDITOR_TOTP_SECRET` (dedicated dev users; the specs generate codes with `otpauth` and wait for a fresh TOTP window when a code would repeat), plus `E2E_BEACON_KEY` for the walk beacon. `e2e/helpers.ts` signs in through the managed login pages, reads the ID token out of `sessionStorage`, and drives the API directly for setup and teardown (events, current, status, beacons, heartbeat, the published version id) through the exported `adminApi`. Specs:

1. Sign in through the hosted UI with password and TOTP; the layout renders with the `DEV` badge; sign out returns to `SignIn`.
2. Create a beacon; the key dialog shows a `wbk_` key and a PNG data URL; rotate it; revoke it.
3. Create an event with inherit; set it current; walk planned to scheduled (after setting `scheduledAt`) to live to ended through the confirmations (the silent path of `StatusDialog`); after each change `GET <dev cdn>/live/location.json` reports the new `eventStatusId` within 10 s. `afterAll` restores the event that was current when the spec started and deletes this run's event through the API.
4. Change `poll_interval_ms`; the CDN object's `pollIntervalMs` follows within 10 s; restore it.
5. With the dev walk event (year 2100) live, cookie type controls are disabled; after ended, a type can be edited, a fresh type can be created and deleted, and Delete is disabled on a type with cookies. The walk is driven through the API before and after; the current event is restored in `afterAll`.
5a. Going live is refused while the e2e beacon is stale: the Live button carries the reason until the harness posts a heartbeat for the beacon, then the walk proceeds. The spec swings the current event and the active beacon to the walk event and the e2e beacon for the run and restores both in `afterAll`.
6. Upload the vendored route fixture (with `schemaVersion` stripped by the test) to an event; the flight history section shows its point count.
7. As an editor: the drawer has no Events entry; open the about page, add a `rich_text` section with a paragraph, upload a small PNG through the media library, add a `media` section using it, publish with a label; `GET <dev cdn>/live/location.json` reports a new `snapshotUrl` within 10 s and the snapshot's `content` contains the paragraph and the media map contains the asset with its `url` and no variants (the PNG is 400 px wide); restore the version that was published when the spec started and publish again; delete the section and the asset (`409 media_in_use` first, then `204` after removing the reference). The editor never opens the preview frame.
8. As the editor, `GET /admin/events` answers `403 forbidden` and the Events route renders "Not available for your role".
9. Mobile project only (`09-mobile.spec.ts`): signs in as the admin against a 390 x 844 Pixel 7 viewport (the sign-in wait is the `Open navigation` button, not the permanent drawer), then visits every route in § 1 (the list routes, one detail per family discovered through `adminApi`, `/places/map`, `/scan`, `/agents`, `/audit`). For each, the spec waits for network idle plus 500 ms, attaches a full-page JPEG screenshot to the test through `testInfo.attach`, and asserts `document.documentElement.scrollWidth <= page.viewportSize().width` (comparing against the emulator's viewport rather than `window.innerWidth`, which mobile emulation enlarges to the content); every failing route is reported in one assertion message rather than stopping at the first.

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
- All displayed times are `America/Denver` labelled `MT`; inputs are `datetime-local` in the browser zone with the resulting Mountain time as helper text; no timezone variables.
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
- Sponsors copy forward per sponsor ("Add year from…") and in bulk ("Import from year"); events clone with their sponsors, recording, and poster.
- QR codes, places, and scan are three pages; a canvasser sees only those; codes are drawn and printed in the browser at any size; pins come from the phone, a Places search, or a drag, never from a visitor.
- Every delete of a resource with dependents goes through `DeleteDialog` and its impact preview; the live and the current event cannot be deleted.
- On a phone the events list renders `ResponsiveTable`'s outlined cards; the same component keeps the desktop table byte-for-byte the same markup as before adoption, so the existing specs keep working.

## 12. Needs a decision

Nothing at the moment. Add here as it comes up.
