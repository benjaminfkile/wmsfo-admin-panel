# WMSFO v2 admin panel

Technical design for the admin panel: the React + MUI single-page app in the `wmsfo-admin-panel` repository, built with Vite, deployed on Vercel from `main`, served at `https://<admin-domain>`. It is the only surface for admin actions. It reads and writes the API's `/admin/*` routes with a Cognito ID token, reads one CDN object on the dashboard, and never joins the hub. Every name and shape below is the one in the shared contracts.

---

## 1. Shape

| Piece | Choice |
|---|---|
| Build | Vite 6, `@vitejs/plugin-react`, TypeScript 5, `strict` |
| UI | React 19, MUI v7 (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`), `@uiw/react-json-view` for raw JSON |
| Content forms | `@rjsf/core`, `@rjsf/mui`, `@rjsf/validator-ajv8`: forms generated from the vendored section schemas, with custom fields for the shared primitives (section 6.14) |
| Reordering | `@dnd-kit/core` and `@dnd-kit/sortable` for section, item, and page order |
| Routing | `react-router-dom` v7, `createBrowserRouter` |
| Auth | `oidc-client-ts` against the Cognito hosted UI, authorization code with PKCE |
| Data | `@tanstack/react-query` v5 over `fetch` |
| Types | `openapi-typescript` over the vendored `contracts/openapi.json` |
| Tests | Vitest, `@testing-library/react`, `@testing-library/user-event`, `msw`; Playwright against the dev stack |
| Hosting | Vercel, framework preset Vite, output `dist`, SPA rewrite to `index.html` |

Routes and what each one calls:

| Route | Page | API calls |
|---|---|---|
| `/` | Dashboard | `GET /admin/events`, `GET /admin/live`, `GET <cdn>/live/location.json`, `GET /admin/snapshot`, `GET /admin/beacons`, `POST /admin/live/republish`, `POST /admin/snapshot/rebuild`, `POST /admin/events/{id}/status` |
| `/events` | Events list | `GET /admin/events`, `GET /admin/routes`, `POST /admin/events`, `POST /admin/events/{id}/current`, `DELETE /admin/events/{id}` |
| `/events/:id` | Event detail | `GET /admin/events/{id}`, `PATCH`, `.../status`, `.../status-history`, `.../messages` (list, post, patch, delete), `.../locations`, `GET /admin/routes`, `POST /admin/routes` |
| `/routes` | Routes | `GET /admin/routes`, `DELETE /admin/routes/{id}` |
| `/beacons` | Beacons list | `GET /admin/beacons`, `POST /admin/beacons`, `.../activate`, `.../deactivate`, `.../rotate`, `.../revoke` |
| `/beacons/:id` | Beacon telemetry | `GET /admin/beacons` (shared poll), `PATCH /admin/beacons/{id}`, `GET .../logs`, `GET .../logs/{logId}` |
| `/sponsors` | Sponsors list | `GET /admin/sponsors`, `POST /admin/sponsors` |
| `/sponsors/:id` | Sponsor detail | `GET /admin/sponsors/{id}`, `PATCH` (fields and `logoMediaId`), `DELETE`, `PUT`/`DELETE .../years/{eventYear}` |
| `/cookie-types` | Cookie types | `GET /admin/cookie-types`, `POST`, `PATCH .../{id}` (fields and `icon`), `GET /admin/events`, `GET /admin/icons` |
| `/pages` | Pages | `GET /admin/pages`, `POST /admin/pages`, `PATCH /admin/pages/{id}`, `DELETE /admin/pages/{id}`, `PUT /admin/pages/order`, `GET /admin/content/status` |
| `/pages/:id` | Page editor | `GET /admin/pages/{id}`, `PATCH /admin/pages/{id}`, `GET /admin/content/kinds`, `GET /admin/icons`, `POST .../sections`, `PATCH /admin/sections/{id}`, `DELETE`, `.../duplicate`, `.../move`, `PUT .../sections/order`, `POST .../items`, `PATCH /admin/items/{id}`, `DELETE`, `PUT .../items/order`, `POST /admin/content/preview-token` |
| `/media` | Media library | `GET /admin/media`, `POST /admin/media/upload-url`, the presigned `PUT` to S3, `POST /admin/media/{id}/confirm`, `GET /admin/media/{id}`, `GET .../usage`, `PATCH`, `DELETE` |
| `/site-settings` | Site settings | `GET /admin/site-settings`, `PUT /admin/site-settings`, `GET /admin/icons`, `POST /admin/content/preview-token` |
| `/publish` | Publish | `GET /admin/content/status`, `POST /admin/content/publish`, `GET /admin/content/versions`, `GET .../{id}`, `POST .../{id}/restore`, `POST /admin/content/preview-token` |
| `/cookies` | Cookie moderation | `GET /admin/events`, `GET /admin/cookie-types`, `GET /admin/events/{id}/cookies`, `POST /admin/cookies/{id}/hide`, `.../unhide`, `DELETE /admin/cookies/{id}` |
| `/settings` | Settings | `GET /admin/settings`, `PUT /admin/settings/{key}` |
| `/subscribers` | Subscribers | `GET /admin/subscribers/summary`, `GET /admin/subscribers`, `DELETE /admin/subscribers/{id}` |
| `/people` | People | `GET /admin/people`, `DELETE /admin/people/{id}` |
| `/contact-messages` | Contact messages | `GET /admin/contact-messages`, `DELETE /admin/contact-messages/{id}` |
| `/auth/callback` | OIDC callback | none |
| `/mfa-setup` | MFA setup | Cognito IdP calls (section 3.5) |

Roles: a signed-in member of `editor` sees Pages, Media, Site settings, Publish, and Sponsors; a member of `admin` sees everything. The panel hides what a role cannot use and the API enforces it (`403 forbidden`).

---

## 2. Migration from Create React App to Vite

### 2.1 File moves and deletions

| Action | Path |
|---|---|
| Move and edit | `public/index.html` becomes `index.html` at the repository root (section 2.3) |
| Rename | `src/index.tsx` becomes `src/main.tsx`; the theme setup moves into `App.tsx` |
| Add | `vite.config.ts`, `vercel.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `.env.example`, `src/vite-env.d.ts`, `src/config.ts`, `contracts/` (vendored), `CONTRACTS_SHA`, `scripts/check-contracts.mjs` |
| Delete | `src/react-app-env.d.ts`, `src/reportWebVitals.ts`, `src/App.css`, `src/App.test.tsx`, `src/logo.svg`, `public/manifest.json`, `public/logo192.png`, `public/logo512.png` |
| Delete (retired features) | `src/pages/EventMode.tsx`, `src/pages/EventModeOverride.tsx`, `src/pages/TrackingMode.tsx`, `src/api/eventMode.ts`, `src/api/eventModeOverride.ts`, `src/api/trackingMode.ts`, `src/api/trackiDevice.ts`, `src/api/liftoff.ts`, `src/api/dashboardConfig.ts`, `src/api/location.ts`, `src/api/funds.ts`, `src/api/eventUpdates.ts`, `src/api/sponsors.ts`, `src/api/axiosClient.ts`, `src/api/http.ts`, `src/api/index.ts`, `src/auth/apiKey.ts`, `src/auth/runtimeConfig.ts`, `src/components/ApiKeyPrompt.tsx`, `src/components/common/EventModeOverrideWarning.tsx`, `src/components/common/LiveTrackerView.tsx`, `src/constants/trackingModes.ts`, `src/interfaces.ts`, `src/types.ts` |
| Keep and rewire | `src/components/MainLayout.tsx` (new navigation, environment badge, sign-out), `src/theme/theme.ts`, `src/theme/themeStorage.ts`, `src/components/common/CommentBox.tsx`, `src/components/common/ThemedJSONView.tsx` |
| Fold | `src/pages/Dashboard.tsx` is rewritten (section 6.2); `src/pages/EventMessage.tsx` and `src/pages/FundsStatus.tsx` become the messages section and the `fundsPercent` field of the event detail page |

### 2.2 package.json

```json
{
  "name": "wmsfo-admin-panel",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5174 --strictPort",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 5174 --strictPort",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b",
    "lint": "eslint .",
    "gen:api-types": "openapi-typescript contracts/openapi.json -o src/api/schema.d.ts",
    "check:contracts": "node scripts/check-contracts.mjs",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@emotion/react": "^11",
    "@emotion/styled": "^11",
    "@mui/icons-material": "^7",
    "@mui/material": "^7",
    "@tanstack/react-query": "^5",
    "@uiw/react-json-view": "^2",
    "oidc-client-ts": "^3",
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7"
  },
  "devDependencies": {
    "@playwright/test": "^1",
    "@testing-library/jest-dom": "^6",
    "@testing-library/react": "^16",
    "@testing-library/user-event": "^14",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "eslint": "^9",
    "eslint-plugin-react-hooks": "^5",
    "eslint-plugin-react-refresh": "^0.4",
    "jsdom": "^25",
    "msw": "^2",
    "openapi-typescript": "^7",
    "otpauth": "^9",
    "typescript": "^5",
    "typescript-eslint": "^8",
    "vite": "^6",
    "vitest": "^3"
  }
}
```

Removed from the legacy manifest: `react-scripts`, `axios`, `web-vitals`, `@types/jest`, `@types/node@16`, `@testing-library/dom` (a transitive dependency now), the `eslintConfig` and `browserslist` blocks. `qrcode` is added for the TOTP setup page.

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

No `%PUBLIC_URL%`; files in `public/` are referenced by absolute path.

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

Port 5174 is the origin registered on the `wmsfo-admin` Cognito client, in the API's dev `WMSFO_CORS_ORIGINS`.

### 2.5 Environment variables

The prefix changes from `REACT_APP_` to `VITE_` and access changes from `process.env.X` to `import.meta.env.X`. Only these six variables exist:

| Variable | Prod (Vercel project from `main`) | Dev (`.env.local`, and the dev Vercel project) |
|---|---|---|
| `VITE_ENV` | `prod` | `dev` (`local` when the API runs on this machine) |
| `VITE_API_BASE_URL` | `https://<api-domain>` | dev `https://<api-domain>` |
| `VITE_CDN_BASE_URL` | `https://<cdn-domain>` | dev `https://<cdn-domain>` |
| `VITE_COGNITO_AUTHORITY` | `https://cognito-idp.<region>.amazonaws.com/<pool-id>` (prod pool) | same shape, dev pool |
| `VITE_COGNITO_DOMAIN` | `https://<cognito-domain>` | dev hosted UI domain |
| `VITE_COGNITO_CLIENT_ID` | `<admin-client-id>` | dev `<admin-client-id>` |

`.env.example` lists the six names with empty values and is committed; `.env.local` is ignored. The legacy variables `REACT_APP_API_URL`, `REACT_APP_ENVIRONMENT`, `REACT_APP_IFRAME_SOURCE`, `REACT_APP_FORCED_TIMEZONE`, `REACT_APP_FORCED_TIME_ABBR` are removed.

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_CDN_BASE_URL: string;
  readonly VITE_COGNITO_AUTHORITY: string;
  readonly VITE_COGNITO_DOMAIN: string;
  readonly VITE_COGNITO_CLIENT_ID: string;
}
```

```ts
// src/config.ts
export type AppEnv = "prod" | "dev" | "local";
export type Config = {
  env: AppEnv;
  apiBaseUrl: string;      // no trailing slash
  cdnBaseUrl: string;      // no trailing slash
  cognitoAuthority: string;
  cognitoDomain: string;   // no trailing slash
  cognitoClientId: string;
};

const NAMES = [
  "VITE_ENV", "VITE_API_BASE_URL", "VITE_CDN_BASE_URL",
  "VITE_COGNITO_AUTHORITY", "VITE_COGNITO_DOMAIN", "VITE_COGNITO_CLIENT_ID",
] as const;

export function loadConfig(env: ImportMetaEnv = import.meta.env): { config: Config } | { missing: string[] } {
  const missing = NAMES.filter((n) => !env[n] || env[n].trim() === "");
  if (!["prod", "dev", "local"].includes(env.VITE_ENV)) missing.push("VITE_ENV (must be prod, dev, or local)");
  if (missing.length > 0) return { missing };
  const strip = (s: string) => s.replace(/\/+$/, "");
  return {
    config: {
      env: env.VITE_ENV as AppEnv,
      apiBaseUrl: strip(env.VITE_API_BASE_URL),
      cdnBaseUrl: strip(env.VITE_CDN_BASE_URL),
      cognitoAuthority: strip(env.VITE_COGNITO_AUTHORITY),
      cognitoDomain: strip(env.VITE_COGNITO_DOMAIN),
      cognitoClientId: env.VITE_COGNITO_CLIENT_ID,
    },
  };
}
```

`main.tsx` calls `loadConfig()` first. A missing variable renders a full-page list of the missing names and nothing else; no auth, no fetch.

### 2.6 TypeScript configuration

```json
// tsconfig.json
{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }
```

```json
// tsconfig.app.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

`tsconfig.node.json` covers `vite.config.ts`, `scripts/`, and `playwright.config.ts` with `module: ESNext`, `moduleResolution: bundler`, `types: ["node"]`. The legacy `target: es5` and `allowJs` are gone.

### 2.7 Jest to Vitest

| Jest (CRA) | Vitest |
|---|---|
| `react-scripts test` | `vitest run` (config in `vite.config.ts`, `test` block) |
| `@types/jest` globals | `globals: true` plus `"vitest/globals"` in `types` |
| `jest.fn`, `jest.mock`, `jest.useFakeTimers` | `vi.fn`, `vi.mock`, `vi.useFakeTimers` |
| `src/setupTests.ts` importing `@testing-library/jest-dom` | `src/setupTests.ts` importing `@testing-library/jest-dom/vitest` and starting the MSW server |
| `jsdom` bundled by CRA | `jsdom` as a dev dependency, `environment: "jsdom"` |

```ts
// src/setupTests.ts
import "@testing-library/jest-dom/vitest";
import { server } from "./test/msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 2.8 ESLint

`eslint.config.js` (flat config): `typescript-eslint` recommended, `eslint-plugin-react-hooks` recommended, `eslint-plugin-react-refresh` for component exports; ignores `dist`, `src/api/schema.d.ts`.

### 2.9 Vercel

Framework preset Vite, install `npm ci`, build `npm run build`, output `dist`. Client-side routes (`/auth/callback` included) need the rewrite:

```json
// vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Static files under `dist` are served before the rewrite applies. The six variables in 2.5 are set on the project as Production environment variables. Production deploys from `main` only.

### 2.10 Source tree after the move

```
wmsfo-admin-panel/
  index.html  vite.config.ts  vercel.json  tsconfig*.json  eslint.config.js  .env.example
  contracts/                    vendored copy of the API repository's contracts/ (openapi.json, schema/, fixtures/, admin-thresholds.json, CONTRACTS_VERSION)
  CONTRACTS_SHA                 API commit the copy came from
  scripts/check-contracts.mjs
  e2e/                          Playwright specs
  src/
    main.tsx  App.tsx  config.ts  vite-env.d.ts  setupTests.ts
    auth/       userManager.ts  AuthProvider.tsx  RequireAdmin.tsx  claims.ts  signOut.ts  mfa.ts
    api/        client.ts  errors.ts  schema.d.ts (generated)  types.ts  cdn.ts
                events.ts  routes.ts  beacons.ts  sponsors.ts  cookieTypes.ts  cookies.ts  settings.ts
                subscribers.ts  people.ts  contactMessages.ts  snapshot.ts  live.ts
                pages.ts  sections.ts  siteSettings.ts  content.ts  media.ts  icons.ts  upload.ts (the presigned PUT)
    queries/    keys.ts  polling.ts  useEvents.ts  useBeacons.ts  ... (one hook file per resource)
    validation/ rules.ts  event.ts  message.ts  beacon.ts  sponsor.ts  sponsorYear.ts  cookieType.ts  setting.ts  routeFile.ts  image.ts  page.ts
    schemas/    draft.ts (derive the draft-level schema from a publish schema)  inline.ts (the inline grammar parser, mirrors the API)
    lib/        time.ts  csv.ts  download.ts  publishedState.ts  beaconFlags.ts  thresholds.ts  statusNames.ts  roles.ts  mediaUrl.ts
    components/ layout/MainLayout.tsx  EnvBadge.tsx  ErrorAlert.tsx  ConfirmDialog.tsx  KeyRevealDialog.tsx
                ThemedJsonView.tsx  CommentBox.tsx  Age.tsx  StatusChip.tsx  FlagChip.tsx  PagedTable.tsx  Notify.tsx
                content/  SchemaForm.tsx  PresentationPanel.tsx  SectionCard.tsx  SectionPalette.tsx  ItemsEditor.tsx  ProblemList.tsx
                          fields/IconField.tsx  MediaField.tsx  LinkField.tsx  InlineField.tsx  BlocksField.tsx  ThemeField.tsx
                          pickers/IconPicker.tsx  MediaPicker.tsx  InlinePreview.tsx
                          PreviewFrame.tsx  PublishBar.tsx
                media/    Uploader.tsx  MediaGrid.tsx  MediaCard.tsx  MediaDetailDrawer.tsx  UsageList.tsx
    pages/      Dashboard.tsx
                events/   EventsList.tsx  EventDetail.tsx  EventCreateDialog.tsx  StatusDialog.tsx  MessagesSection.tsx
                          RouteSection.tsx  RouteUploadDialog.tsx  LocationsSection.tsx
                routes/   RoutesList.tsx
                beacons/  BeaconsList.tsx  BeaconDetail.tsx  BeaconCreateDialog.tsx  TelemetryPanel.tsx  BeaconLogs.tsx
                sponsors/ SponsorsList.tsx  SponsorDetail.tsx  SponsorYearDialog.tsx  LogoSection.tsx
                cookieTypes/CookieTypesList.tsx  cookies/CookiesModeration.tsx  settings/Settings.tsx
                pages/    PagesList.tsx  PageCreateDialog.tsx  PageEditor.tsx  PageSettingsDialog.tsx
                media/    MediaLibrary.tsx
                siteSettings/SiteSettings.tsx
                publish/  Publish.tsx  VersionsList.tsx  VersionDialog.tsx
                subscribers/Subscribers.tsx  people/People.tsx  contact/ContactMessages.tsx
                auth/     SignIn.tsx  Callback.tsx  NoRole.tsx  MfaSetup.tsx  ConfigError.tsx
    theme/      theme.ts  themeStorage.ts
    test/       msw/server.ts  msw/handlers.ts  fixtures.ts  renderWithProviders.tsx
```

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
import type { User } from "oidc-client-ts";

export const ADMIN_GROUP = "admin";
export const EDITOR_GROUP = "editor";
export type Role = "admin" | "editor";

export function roleOf(user: User): Role | null {
  const groups = user.profile["cognito:groups"];
  if (!Array.isArray(groups)) return null;
  if (groups.includes(ADMIN_GROUP)) return "admin";
  if (groups.includes(EDITOR_GROUP)) return "editor";
  return null;
}

export function emailOf(user: User): string {
  return typeof user.profile.email === "string" ? user.profile.email : "";
}
```

`user.profile` is the ID token's claim set. `cognito:groups` is the only authorization input; the panel never asks the API what the caller may do. `lib/roles.ts` maps a role to the views it may open (`editor`: pages, media, site settings, publish, sponsors; `admin`: all) and the layout and the router both read it.

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
2. Create the `QueryClient` and the `UserManager`; render the router inside `AuthProvider`.
3. `AuthProvider` on mount: `const user = await userManager.getUser()`.
   - `user === null`: state `signed_out` with `returnTo = location.pathname + location.search`.
   - `user.expired && user.refresh_token`: `await userManager.signinSilent()`; failure sets `signed_out`.
   - Otherwise `evaluate(user)`: `roleOf(user)` gives `member` with that role, else `no_role`.
4. Subscriptions for the life of the app: `events.addUserLoaded(u => setState(evaluate(u)))` (every renewal re-checks the group), `events.addUserUnloaded(() => signed_out)`, `events.addSilentRenewError(() => signed_out)`, `events.addAccessTokenExpired(() => signed_out)`.
5. Rendering by state: `loading` shows a centred spinner; `signed_out` shows `SignIn` (title, environment badge, one "Sign in" button calling `userManager.signinRedirect({ state: { returnTo } })`); `no_role` shows `NoRole`; `mfa_required` shows `MfaSetup`; `member` renders the layout with the views the role allows, and a route the role cannot open renders "Not available for your role".

`RequireAdmin` is the root layout route element; every page is a child route, so no page component mounts, and no API call is made, before the group check has passed. It also mounts per-route guards from `lib/roles.ts`.

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

`401 unauthenticated` from the API: the client calls `signinSilent()` once and retries the request once; a second `401` or a renew failure sets `signed_out`. `AuthRequired` thrown before the request does the same.

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

The pool's MFA setting is optional with TOTP; every member of `admin` or `editor` has TOTP enabled on their user, and the API enforces it by answering `403 mfa_required` after `AdminGetUser`). The panel's part:

- Any response with `code: "mfa_required"` sets state `mfa_required`; the layout is replaced by `MfaSetup` until the next sign-in.
- `MfaSetup` shows who is signed in, why the panel is blocked (TOTP is not enabled on this account), and a sign-out button.
- `MfaSetup` enrols the authenticator in place through the Cognito IdP service endpoint (`new URL(config.cognitoAuthority).origin`), using the access token:

```ts
// src/auth/mfa.ts
async function idp<T>(target: string, body: unknown): Promise<T> {
  const res = await fetch(`${new URL(config.cognitoAuthority).origin}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(((await res.json()) as { message?: string }).message ?? `IdP ${res.status}`);
  return res.json() as Promise<T>;
}

export const associate = (accessToken: string) =>
  idp<{ SecretCode: string }>("AssociateSoftwareToken", { AccessToken: accessToken });
export const verify = (accessToken: string, code: string) =>
  idp<{ Status: "SUCCESS" | "ERROR" }>("VerifySoftwareToken", { AccessToken: accessToken, UserCode: code, FriendlyDeviceName: "WMSFO admin" });
export const prefer = (accessToken: string) =>
  idp<Record<string, never>>("SetUserMFAPreference", { AccessToken: accessToken, SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true } });
```

  Flow: `associate` returns `SecretCode`; the page renders `otpauth://totp/WMSFO%20Admin:<email>?secret=<SecretCode>&issuer=WMSFO%20Admin` as a QR (`qrcode.toDataURL`) and as text; the admin enters the six-digit code; `verify` must answer `SUCCESS`; `prefer` turns TOTP on; the page then says "Sign out and sign in again; the API re-checks MFA status every five minutes" and offers sign-out. These three calls need the access token to carry scope `aws.cognito.signin.user.admin` (item 1).

### 3.6 No-role page

State `no_role` renders "This account has no role" with the signed-in email and a sign-out button. Nothing else is reachable. A `403 forbidden` from any `/admin/*` call re-reads the groups on the next renewal; a call a role should never make is a panel bug and is reported as an alert with the request id.

---

## 4. API client

### 4.1 Generated types

`npm run gen:api-types` runs `openapi-typescript` over the vendored `contracts/openapi.json` into `src/api/schema.d.ts` (committed; CI fails on drift, section 10). `src/api/types.ts` names the shapes the pages use, each an alias of a generated component so a contract change is a type error:

```ts
import type { components } from "./schema";
type S = components["schemas"];

export type Event = S["Event"];
export type EventMessage = S["EventMessage"];
export type StatusHistory = S["StatusHistory"];
export type Route = S["Route"];
export type Beacon = S["Beacon"];
export type Enrollment = S["Enrollment"];
export type BeaconLog = S["BeaconLog"];
export type Sponsor = S["Sponsor"];
export type SponsorYear = S["SponsorYear"];
export type CookieType = S["CookieType"];
export type CookieAdmin = S["CookieAdmin"];
export type SubscriberAdmin = S["SubscriberAdmin"];
export type Person = S["Person"];
export type ContactMessage = S["ContactMessage"];
export type Setting = S["Setting"];
export type SnapshotInfo = S["SnapshotInfo"];
export type LocationRow = S["LocationRow"];
export type PageAdmin = S["PageAdmin"];
export type PageDetail = S["PageDetail"];
export type SectionAdmin = S["SectionAdmin"];
export type SectionItemAdmin = S["SectionItemAdmin"];
export type SiteSettingsDraft = S["SiteSettingsDraft"];
export type KindInfo = S["KindInfo"];
export type IconInfo = S["IconInfo"];
export type MediaAsset = S["MediaAsset"];
export type UploadTicket = S["UploadTicket"];
export type MediaUsage = S["MediaUsage"];
export type ContentVersionInfo = S["ContentVersionInfo"];
export type ContentStatus = S["ContentStatus"];
export type ContentBundle = S["ContentBundle"];
export type PreviewToken = S["PreviewToken"];
export type Problem = S["Problem"];
export type Icon = S["Icon"];
export type MediaRef = S["MediaRef"];
export type Presentation = S["Presentation"];
export type Page<T> = { items: T[]; nextCursor: string | null };
export type StatusId = 1 | 2 | 3 | 4 | 5;
```

Two shapes are declared by hand from the contracts because they are CDN objects and heartbeat bodies rather than endpoint schemas, and a test checks each against the vendored fixture:

```ts
export type LiveObject = {
  schemaVersion: number; eventId: number | null; eventStatusId: number | null; pollIntervalMs: number;
  snapshotUrl: string; cookieTally: Record<string, number>; seq: number | null;
  lat: number | null; lng: number | null; speedMps: number | null; altitudeM: number | null;
  headingDeg: number | null; accuracyM: number | null; recordedAt: string | null; receivedAt: string | null;
  publishedAt: string;
};

export type Heartbeat = {
  sentAt: string;
  power: { batteryPercent: number | null; charging: boolean | null; batteryTempC: number | null;
           thermalStatus: "none" | "light" | "moderate" | "severe" | "critical" | "emergency" | "shutdown" | "unknown" | null;
           [k: string]: unknown } | null;
  radio: { networkType: string | null; signalDbm: number | null; signalLevel: number | null;
           airplaneMode: boolean | null; connected: boolean | null; [k: string]: unknown } | null;
  gps: { provider: string | null; satellitesUsed: number | null; satellitesInView: number | null;
         lastFixAccuracyM: number | null; lastFixAgeS: number | null; fixesLastMinute: number | null;
         permission: { foreground: boolean | null; background: boolean | null; precise: boolean | null } | null;
         [k: string]: unknown } | null;
  transport: { socketState: "connected" | "connecting" | "reconnecting" | "disconnected" | null; reconnectCount: number | null;
               httpFallbackSeconds: number | null; lastReceiptLatencyMs: number | null; sendsFailedSinceBoot: number | null;
               [k: string]: unknown } | null;
  process: { deviceUptimeS: number | null; serviceUptimeS: number | null; serviceRestartCount: number | null;
             memoryPressure: "normal" | "moderate" | "low" | "critical" | "unknown" | null;
             batteryOptimizationExempt: boolean | null; notificationPermission: boolean | null; systemApp: boolean | null; rootAvailable: boolean | null;
             [k: string]: unknown } | null;
  identity: { deviceModel: string | null; androidVersion: string | null; appVersion: string | null; clockSkewMs: number | null;
              [k: string]: unknown } | null;
};

export type LiveState = {
  lastWriteAt: string | null; lastWriteSeq: number | null; lastWriteVersion: number | null;
  lastWriteError: string | null; lastWriteNode: string | null;
  node: { instance: string | null; isLeader: boolean; leaderEvaluatedAt: string | null; cacheRefreshedAt: string; live: LiveObject };
};
```

The index signatures carry unknown nested telemetry keys through to the telemetry page, which renders them raw.

### 4.2 Errors

```ts
// src/api/errors.ts
export type ErrorBody = { code: string; message: string; details: Record<string, unknown> | null; requestId: string };

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: ErrorBody | null) {
    super(body?.message ?? `HTTP ${status}`);
  }
  get code(): string { return this.body?.code ?? (this.status === 405 ? "method_not_allowed" : "unknown"); }
  get requestId(): string | null { return this.body?.requestId ?? null; }
  get fields(): Record<string, string> {
    const f = this.body?.details?.["fields"];
    return f && typeof f === "object" ? Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === "string")) as Record<string, string> : {};
  }
  get retryAfterSeconds(): number | null {
    const v = this.body?.details?.["retryAfterSeconds"];
    return typeof v === "number" ? v : null;
  }
}
export class NetworkError extends Error {}   // fetch itself threw
export class AuthRequired extends Error {}   // no usable ID token
export class CdnError extends Error { constructor(public readonly status: number) { super(`CDN ${status}`); } }
```

### 4.3 Request wrapper

```ts
// src/api/client.ts
type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type Query = Record<string, string | number | boolean | undefined>;
type Req = { method: Method; path: string; query?: Query; json?: unknown; form?: FormData; accept?: string; parse?: "json" | "text" | "blob" | "none" };

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
    if (err.code === "mfa_required") auth.set({ kind: "mfa_required" });
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

`FormData` bodies carry no explicit `Content-Type`; the browser sets the multipart boundary. `AuthRequired` propagating out of a query or mutation sets state `signed_out` in the `QueryClient`'s global error handlers.

### 4.4 Resource modules

Every path is bare and appended to `VITE_API_BASE_URL`. Bodies are typed objects built by the forms; unknown fields cannot be sent.

```ts
// events.ts
export type CreateEventBody = { year: number; name: string; scheduledAt: string | null; fundsPercent: number; routeId: number | null; inheritRoute: boolean };
export type PatchEventBody = Partial<{ name: string; year: number; scheduledAt: string | null; wentLiveAt: string | null; endedAt: string | null; fundsPercent: number; routeId: number | null }>;
export type StatusBody = { statusId: StatusId; notify: boolean };
export type MessageBody = { body: string; eventTime: string | null; notify: boolean };
export type LocationsQuery = { cursor?: string; limit?: number; beaconId?: number; publishedOnly?: boolean };

export const events = {
  list: () => get<{ items: Event[] }>("/admin/events"),
  get: (id: number) => get<Event>(`/admin/events/${id}`),
  create: (b: CreateEventBody) => post<Event>("/admin/events", b),
  patch: (id: number, b: PatchEventBody) => patch<Event>(`/admin/events/${id}`, b),
  remove: (id: number) => del(`/admin/events/${id}`),
  setCurrent: (id: number) => post<Event>(`/admin/events/${id}/current`),
  setStatus: (id: number, b: StatusBody) => post<Event>(`/admin/events/${id}/status`, b),
  statusHistory: (id: number) => get<{ items: StatusHistory[] }>(`/admin/events/${id}/status-history`),
  messages: (id: number) => get<{ items: EventMessage[] }>(`/admin/events/${id}/messages`),
  postMessage: (id: number, b: MessageBody) => post<EventMessage>(`/admin/events/${id}/messages`, b),
  patchMessage: (id: number, mid: number, b: Partial<Pick<MessageBody, "body" | "eventTime">>) => patch<EventMessage>(`/admin/events/${id}/messages/${mid}`, b),
  deleteMessage: (id: number, mid: number) => del(`/admin/events/${id}/messages/${mid}`),
  locations: (id: number, q: LocationsQuery) => get<Page<LocationRow>>(`/admin/events/${id}/locations`, q),
  locationsCsv: (id: number, q: Omit<LocationsQuery, "cursor" | "limit">) =>
    request<Blob>({ method: "GET", path: `/admin/events/${id}/locations`, query: q, accept: "text/csv", parse: "blob" }),
  cookies: (id: number, q: { cursor?: string; limit?: number; includeHidden?: boolean }) => get<Page<CookieAdmin>>(`/admin/events/${id}/cookies`, q),
};

// routes.ts
export type RoutePoint = { lat: number; lng: number; recordedAt: string | null };
export type RouteUploadBody = { name: string; points: RoutePoint[] };
export const routes = {
  list: () => get<{ items: Route[] }>("/admin/routes"),
  get: (id: number) => get<Route>(`/admin/routes/${id}`),
  create: (b: RouteUploadBody) => post<Route>("/admin/routes", b),      // 201 new, 200 existing identical route
  remove: (id: number) => del(`/admin/routes/${id}`),
};

// beacons.ts
export type BeaconsResponse = { items: Beacon[]; staleAfterS: number };
export type KeyMint = { beacon: Beacon; key: string; enrollment: Enrollment };
export const beacons = {
  list: () => get<BeaconsResponse>("/admin/beacons"),
  get: (id: number) => get<Beacon>(`/admin/beacons/${id}`),
  create: (b: { name: string; notes: string; role: "beacon" | "admin" }) => post<KeyMint>("/admin/beacons", b),
  patch: (id: number, b: Partial<{ name: string; notes: string }>) => patch<Beacon>(`/admin/beacons/${id}`, b),
  activate: (id: number) => post<Beacon>(`/admin/beacons/${id}/activate`),
  deactivate: (id: number) => post<Beacon>(`/admin/beacons/${id}/deactivate`),
  rotate: (id: number) => post<KeyMint>(`/admin/beacons/${id}/rotate`),
  revoke: (id: number) => post<Beacon>(`/admin/beacons/${id}/revoke`),
  logs: (id: number) => get<{ items: BeaconLog[] }>(`/admin/beacons/${id}/logs`),
  logText: (id: number, logId: number) => request<string>({ method: "GET", path: `/admin/beacons/${id}/logs/${logId}`, parse: "text" }),
};

// sponsors.ts
export type SponsorBody = { name: string } & Partial<Record<"contactPerson" | "email" | "phone" | "address" | "websiteUrl" | "fbUrl" | "igUrl" | "logoMediaId", string | null>>;
export type SponsorYearBody = { amountDonated: number | null; active: boolean; canAdvertise: boolean; anonymous: boolean };
export const sponsors = {
  list: () => get<{ items: Sponsor[] }>("/admin/sponsors"),
  get: (id: number) => get<Sponsor>(`/admin/sponsors/${id}`),
  create: (b: SponsorBody) => post<Sponsor>("/admin/sponsors", b),
  patch: (id: number, b: Partial<SponsorBody>) => patch<Sponsor>(`/admin/sponsors/${id}`, b),
  remove: (id: number) => del(`/admin/sponsors/${id}`),
  putYear: (id: number, eventYear: number, b: SponsorYearBody) => put<Sponsor>(`/admin/sponsors/${id}/years/${eventYear}`, b),
  deleteYear: (id: number, eventYear: number) => del(`/admin/sponsors/${id}/years/${eventYear}`),
};

// cookieTypes.ts
export type CookieTypeBody = { name: string; sort: number; active: boolean; icon: Icon | null };
export const cookieTypes = {
  list: () => get<{ items: CookieType[] }>("/admin/cookie-types"),
  create: (b: CookieTypeBody) => post<CookieType>("/admin/cookie-types", b),
  patch: (id: number, b: Partial<CookieTypeBody>) => patch<CookieType>(`/admin/cookie-types/${id}`, b),
};

// cookies.ts
export const cookies = {
  hide: (id: number) => post<CookieAdmin>(`/admin/cookies/${id}/hide`),
  unhide: (id: number) => post<CookieAdmin>(`/admin/cookies/${id}/unhide`),
  remove: (id: number) => del(`/admin/cookies/${id}`),
};

// settings.ts
export const settings = {
  list: () => get<{ items: Setting[] }>("/admin/settings"),
  put: (key: string, value: number) => put<Setting>(`/admin/settings/${key}`, { value }),
};

// subscribers.ts, people.ts, contactMessages.ts
export type SubscriberStatus = "verified" | "pending" | "unsubscribed";
export const subscribers = {
  summary: () => get<{ verified: number; pending: number; unsubscribed: number }>("/admin/subscribers/summary"),
  list: (q: { cursor?: string; limit?: number; status?: SubscriberStatus }) => get<Page<SubscriberAdmin>>("/admin/subscribers", q),
  remove: (id: number) => del(`/admin/subscribers/${id}`),
};
export const people = {
  list: (q: { cursor?: string; limit?: number }) => get<Page<Person & { cookieCount: number }>>("/admin/people", q),
  remove: (id: number) => del(`/admin/people/${id}`),
};
export const contactMessages = {
  list: (q: { cursor?: string; limit?: number }) => get<Page<ContactMessage>>("/admin/contact-messages", q),
  remove: (id: number) => del(`/admin/contact-messages/${id}`),
};

// snapshot.ts, live.ts
export const snapshot = {
  get: () => get<SnapshotInfo>("/admin/snapshot"),
  rebuild: () => post<SnapshotInfo>("/admin/snapshot/rebuild"),
};
export const live = {
  get: () => get<LiveState>("/admin/live"),
  republish: () => post<LiveObject>("/admin/live/republish"),
};

// pages.ts, sections.ts
export type PageBody = { slug: string; title: string; navLabel: string | null; navPosition?: number; isHidden?: boolean };
export const pages = {
  list: () => get<{ items: PageAdmin[] }>("/admin/pages"),
  get: (id: number) => get<PageDetail>(`/admin/pages/${id}`),
  create: (b: PageBody) => post<PageAdmin>("/admin/pages", b),
  patch: (id: number, b: Partial<PageBody>) => patch<PageAdmin>(`/admin/pages/${id}`, b),
  remove: (id: number) => del(`/admin/pages/${id}`),
  order: (ids: number[]) => put<{ items: PageAdmin[] }>("/admin/pages/order", { ids }),
};
export type SectionBody = { kind: string; position?: number; data?: object; presentation?: Presentation };
export const sections = {
  create: (pageId: number, b: SectionBody) => post<SectionAdmin>(`/admin/pages/${pageId}/sections`, b),
  patch: (id: number, b: Partial<{ data: object; presentation: Presentation; isHidden: boolean }>) => patch<SectionAdmin>(`/admin/sections/${id}`, b),
  remove: (id: number) => del(`/admin/sections/${id}`),
  duplicate: (id: number) => post<SectionAdmin>(`/admin/sections/${id}/duplicate`),
  move: (id: number, b: { pageId: number; position: number }) => post<SectionAdmin>(`/admin/sections/${id}/move`, b),
  order: (pageId: number, ids: number[]) => put<PageDetail>(`/admin/pages/${pageId}/sections/order`, { ids }),
  createItem: (sectionId: number, b: { data: object; position?: number }) => post<SectionItemAdmin>(`/admin/sections/${sectionId}/items`, b),
  patchItem: (id: number, b: Partial<{ data: object; isHidden: boolean }>) => patch<SectionItemAdmin>(`/admin/items/${id}`, b),
  removeItem: (id: number) => del(`/admin/items/${id}`),
  orderItems: (sectionId: number, ids: number[]) => put<SectionAdmin>(`/admin/sections/${sectionId}/items/order`, { ids }),
};

// siteSettings.ts, content.ts, icons.ts
export const siteSettings = {
  get: () => get<SiteSettingsDraft>("/admin/site-settings"),
  put: (data: object) => put<SiteSettingsDraft>("/admin/site-settings", { data }),
};
export const content = {
  kinds: () => get<{ items: KindInfo[] }>("/admin/content/kinds"),
  status: () => get<ContentStatus>("/admin/content/status"),
  draft: () => get<ContentBundle>("/admin/content/draft"),
  publish: (label: string | null) => post<ContentVersionInfo>("/admin/content/publish", { label }),
  versions: () => get<{ items: ContentVersionInfo[] }>("/admin/content/versions"),
  version: (id: number) => get<ContentVersionInfo & { document: object }>(`/admin/content/versions/${id}`),
  restore: (id: number) => post<ContentStatus>(`/admin/content/versions/${id}/restore`),
  previewToken: () => post<PreviewToken>("/admin/content/preview-token"),
};
export const icons = { list: () => get<{ items: IconInfo[] }>("/admin/icons") };

// media.ts, upload.ts
export type MediaQuery = { cursor?: string; limit?: number; kind?: "raster" | "svg" | "gif"; state?: "pending" | "ready" | "orphaned"; q?: string };
export const media = {
  list: (q: MediaQuery) => get<Page<MediaAsset>>("/admin/media", q),
  get: (id: string) => get<MediaAsset>(`/admin/media/${id}`),
  usage: (id: string) => get<MediaUsage>(`/admin/media/${id}/usage`),
  uploadUrl: (b: { filename: string; contentType: string; sizeBytes: number; alt: string; title: string }) => post<UploadTicket>("/admin/media/upload-url", b),
  confirm: (id: string) => post<MediaAsset>(`/admin/media/${id}/confirm`),
  patch: (id: string, b: Partial<{ alt: string; title: string }>) => patch<MediaAsset>(`/admin/media/${id}`, b),
  remove: (id: string) => del(`/admin/media/${id}`),
};
// upload.ts: the one request that does not go to the API
export function uploadToS3(ticket: UploadTicket, file: File, onProgress: (fraction: number) => void): Promise<void>;
// XMLHttpRequest PUT to ticket.uploadUrl with exactly ticket.headers and the file as the body (progress events need XHR);
// no Authorization header, no credentials; any non-2xx rejects with UploadFailed(status). The bucket's CORS rule admits the panel origin.
```

### 4.5 CDN read

```ts
// src/api/cdn.ts
export async function fetchLiveObject(): Promise<LiveObject> {
  const res = await fetch(`${config.cdnBaseUrl}/live/location.json`, { credentials: "omit", cache: "no-store" });
  if (!res.ok) throw new CdnError(res.status);
  return (await res.json()) as LiveObject;
}
```

No custom headers, so the request needs no preflight; the CDN answers CORS for every origin. Unknown fields are tolerated. A `schemaVersion` other than `1` renders the raw object with a banner "unknown schemaVersion" instead of the field grid.

### 4.6 Queries, polling, and writes

```ts
// src/queries/keys.ts
export const keys = {
  events: ["events"] as const,
  event: (id: number) => ["events", id] as const,
  eventHistory: (id: number) => ["events", id, "history"] as const,
  eventMessages: (id: number) => ["events", id, "messages"] as const,
  eventCookies: (id: number, includeHidden: boolean) => ["events", id, "cookies", includeHidden] as const,
  eventLocations: (id: number, q: LocationsQuery) => ["events", id, "locations", q] as const,
  routes: ["routes"] as const,
  beacons: ["beacons"] as const,
  beaconLogs: (id: number) => ["beacons", id, "logs"] as const,
  sponsors: ["sponsors"] as const,
  sponsor: (id: number) => ["sponsors", id] as const,
  cookieTypes: ["cookie-types"] as const,
  settings: ["settings"] as const,
  subscribersSummary: ["subscribers", "summary"] as const,
  subscribers: (status: SubscriberStatus | undefined) => ["subscribers", "list", status ?? "all"] as const,
  people: ["people"] as const,
  contactMessages: ["contact-messages"] as const,
  snapshot: ["snapshot"] as const,
  live: ["live"] as const,
  cdnLive: ["cdn-live"] as const,
  pages: ["pages"] as const,
  page: (id: number) => ["pages", id] as const,
  kinds: ["content", "kinds"] as const,
  icons: ["icons"] as const,
  contentStatus: ["content", "status"] as const,
  versions: ["content", "versions"] as const,
  siteSettings: ["site-settings"] as const,
  media: (q: MediaQuery) => ["media", q] as const,
  mediaOne: (id: string) => ["media", "one", id] as const,
  mediaUsage: (id: string) => ["media", "usage", id] as const,
};

// src/queries/polling.ts
export const POLL_MS = 5000;
export const polled = { refetchInterval: POLL_MS, refetchIntervalInBackground: false, refetchOnWindowFocus: true } as const;
```

`QueryClient` defaults: `staleTime: 0`, `retry: false` for queries and mutations, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`. With `refetchIntervalInBackground: false` the interval pauses while the document is hidden, and `refetchOnWindowFocus` fires an immediate fetch on `visibilitychange` to visible. That is the contracts' data loop: poll while visible, stop while hidden, fetch immediately on return.

| View | On entry | Polled at `POLL_MS` | After a write |
|---|---|---|---|
| Dashboard | `keys.events`, `keys.live`, `keys.cdnLive`, `keys.snapshot`, `keys.beacons` | `keys.live`, `keys.cdnLive`, `keys.beacons` | invalidate all five |
| Beacons list and beacon detail | `keys.beacons` | `keys.beacons` | invalidate `keys.beacons` |
| Page editor | `keys.page(id)`, `keys.kinds`, `keys.icons` (the last two with `staleTime: Infinity`) | none | `setQueryData` on `keys.page(id)` with the returned section or page, then invalidate `keys.contentStatus` |
| Publish | `keys.contentStatus`, `keys.versions` | `keys.contentStatus` every 15 s | invalidate both |
| Every other view | its list key | none | `setQueryData` with the response row where the response is a row, then invalidate the list |

Paged lists (`Page<T>`) use `useInfiniteQuery` with `getNextPageParam: (last) => last.nextCursor ?? undefined` and a "Load more" button; `limit` is 50 unless a page says otherwise.

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
  | { kind: "cdn_unreachable"; status: number | null }
  | { kind: "ok" }
  | { kind: "behind"; mismatches: Mismatch[] }
  | { kind: "write_error"; error: string };
```

The card keeps `previousMismatched: boolean` across polls. It renders `behind` only when the current poll and the previous poll both produced a non-empty `compare()` result; a single mismatched poll renders `ok` (the CDN copy lags an ingest write by up to a second). A poll with no mismatch resets the flag. `state.lastWriteError !== null` renders `write_error` regardless of the comparison. A `CdnError` or network failure on the CDN fetch renders `cdn_unreachable` and does not count as a mismatch. `current` is the event with `isCurrent === true` from the events list fetched on entry.

Rendering: `ok` green "CDN current, written <age> ago by <lastWriteNode>"; `behind` red "CDN behind" with the mismatch list and a Republish button; `write_error` red with the error text and the same button; `cdn_unreachable` amber. Republish calls `POST /admin/live/republish` and invalidates the dashboard keys.

### 5.2 Beacon flags

```json
// contracts/admin-thresholds.json (vendored from the API repository)
{ "batteryLowPercent": 20, "noFixAgeS": 30, "noLocationAgeS": 30 }
```

```ts
// src/lib/beaconFlags.ts
export type BeaconFlag = "battery_low" | "no_recent_fix" | "permission_missing" | "socket_down" | "stale" | "heartbeat_old";

export function beaconFlags(b: Beacon, staleAfterS: number, anyEventLive: boolean, nowMs: number, t = thresholds): BeaconFlag[] {
  if (b.revokedAt !== null) return [];
  const f: BeaconFlag[] = [];
  const tel = b.telemetry as Heartbeat | null;
  const battery = tel?.power?.batteryPercent ?? null;
  if (battery !== null && battery < t.batteryLowPercent) f.push("battery_low");
  const fixAge = tel?.gps?.lastFixAgeS ?? null;
  const locAge = ageS(b.lastLocationAt, nowMs);
  if ((fixAge !== null && fixAge > t.noFixAgeS) || (anyEventLive && locAge !== null && locAge > t.noLocationAgeS)) f.push("no_recent_fix");
  const p = tel?.gps?.permission ?? null;
  if (p !== null && (p.foreground === false || p.background === false || p.precise === false)) f.push("permission_missing");
  if (b.hubConnected === false || (b.hubConnected === null && (tel?.transport?.socketState ?? null) !== "connected")) f.push("socket_down");
  if (b.staleSince !== null) f.push("stale");
  const hbAge = ageS(b.lastHeartbeatAt, nowMs);
  if (hbAge !== null && hbAge > staleAfterS) f.push("heartbeat_old");
  return f;
}
```

`anyEventLive` is `events.some(e => e.statusId === 3)` from the events list the dashboard already holds (the beacons list page fetches `keys.events` once on entry for the same purpose). `staleAfterS` comes from the beacons response. Each flag renders as a red `FlagChip` on the row and colours the underlying value red on the telemetry page. Nothing else is coloured. A shared `useNow()` hook ticks once a second so ages and flags move without a fetch.

---

## 6. Pages

### 6.1 Layout, navigation, environment badge

`MainLayout` keeps the legacy structure: fixed `AppBar`, permanent `Drawer` at 220 px on `md` and up, temporary drawer below, theme toggle stored under `localStorage` key `appThemeMode` (dark default). New in the bar: `EnvBadge`, the signed-in email, and a sign-out button.

Drawer entries for `admin`: Dashboard, Events, Routes, Beacons, then a Content group (Pages, Media, Site settings, Publish), then Sponsors, Cookie types, Cookies, Subscribers, People, Contact messages, Settings. For `editor`: Pages, Media, Site settings, Publish, Sponsors, and the editor lands on Pages. A small "Unpublished changes" dot on the Publish entry reflects `keys.contentStatus.hasUnpublishedChanges` (fetched on layout mount and after every working-set write).

`EnvBadge`: an MUI `Chip` with `config.env.toUpperCase()`; colour `error` for `prod`, `success` for `dev`, `info` for `local`; tooltip shows `config.apiBaseUrl`. On `dev` and `local` the document title is prefixed `[DEV]` or `[LOCAL]`. The badge also appears on `SignIn`, `NotAdmin`, and `MfaSetup`.

A global `NetworkBanner` under the bar shows "API unreachable" while the most recent dashboard or beacons poll failed with `NetworkError`, and clears on the next success.

### 6.2 Dashboard

Cards, top to bottom:

1. **Current event.** From `keys.events`: the event with `isCurrent`. Shows name, year, `StatusChip` (1 Planned, 2 Scheduled, 3 Live, 4 Ended, 5 Cancelled), `scheduledAt`, `wentLiveAt`, `endedAt` (Mountain time, section 7.5), `fundsPercent`, route name or "no route", and a "Change status" button that opens the same `StatusDialog` as the event page (6.3). "No current event" with a link to Events when none is flagged.
2. **Active beacon.** From `keys.beacons`: the beacon with `isActive`. Name, role, `keyPrefix`, heartbeat age, last location age, `staleSince`, battery, socket state, fix age, permissions, with flags from 5.2. "No active beacon" in red when an event is live, grey otherwise. Link to the beacon page.
3. **Published state.** Section 5.1. Also shows `lastWriteAt`, `lastWriteSeq`, `lastWriteVersion`, `lastWriteNode`, and the answering node's `instance`, `isLeader`, `leaderEvaluatedAt`, `cacheRefreshedAt` from `GET /admin/live`.
4. **Snapshot.** `version`, `builtAt`, `s3Key`, `url` as a link, and a "Rebuild snapshot" button (`POST /admin/snapshot/rebuild`, no confirmation).
5. **Live object.** The CDN object as a field grid: `eventId`, `eventStatusId`, `seq`, `lat`, `lng`, `speedMps`, `altitudeM`, `headingDeg`, `accuracyM`, `recordedAt`, `receivedAt`, `publishedAt` with its age, `pollIntervalMs`, `snapshotUrl` as a link, and `cookieTally` joined with `keys.cookieTypes` names when that query is loaded (fetched on entry, not polled). Below it the raw JSON in `ThemedJsonView`, and a second collapsed `ThemedJsonView` with `node.live` from `GET /admin/live` for a side-by-side check.

The legacy dashboard's iframe of the public site is not carried over.

### 6.3 Events

**List** (`/events`): table ordered as returned (`year` desc): year, name, `StatusChip`, "Current" chip, `scheduledAt`, route (name from `keys.routes` by `routeId`, or "none"), `fundsPercent`. Row actions: open, "Set current" (hidden on the current event), delete. "New event" opens `EventCreateDialog`.

**Create dialog**: fields `year` (number), `name`, `scheduledAt` (datetime-local, optional), `fundsPercent` (number, default 0), and a route radio group with three explicit choices:

| Choice | Body |
|---|---|
| Inherit the most recent route | `inheritRoute: true, routeId: null` |
| Choose a route (select from `keys.routes`) | `inheritRoute: false, routeId: <selected>` |
| No route | `inheritRoute: false, routeId: null` |

Under the inherit choice the dialog shows what the rule selects, computed from the two lists it holds: the event with the greatest `year` whose `routeId` is not null, as "Will inherit <route name> from <event name>", or "No earlier event has a route" (the API applies the same rule; this is a preview of it). Success navigates to the new event.

**Detail** (`/events/:id`), sections on one page:

- **Details form**: `name`, `year`, `scheduledAt`, `wentLiveAt`, `endedAt`, `fundsPercent`; Save sends only changed fields as `PATCH`. The clear button on `scheduledAt` is disabled with the helper text "Required while the event is scheduled" when `statusId === 2`. Set current and Delete buttons live here with confirmations (8.3).
- **Status**: current `StatusChip` plus one button per other status. Disabled with a tooltip: Scheduled when `scheduledAt === null` ("Set a scheduled time first"); Live when `!isCurrent` ("Set this event current first") or another event has `statusId === 3` ("<name> is live"). Clicking opens `StatusDialog` (below). Under the buttons, the status history newest first: `toStatusId`, `fromStatusId`, `changedBy`, `changedAt`.
- **Messages**: post form with `body` (multiline), `eventTime` (datetime-local, optional, with a Clear button), `notify` checkbox; list newest first showing body, `eventTime`, `createdBy`, `createdAt`, with edit (inline form for `body` and `eventTime`; `PATCH`, no notify) and delete. The legacy "prefix with date/time" option is not carried over; `eventTime` is the field for that.
- **Route**: current route (`name`, `pointCount`, `createdAt`, `uploadedBy`, `url` as a CDN link) or "No route". "Shared with" lists the other events whose `routeId` equals this one, from `keys.events`. Actions: Upload (opens `RouteUploadDialog`, 7.3), Choose existing (select from `keys.routes`, then `PATCH { routeId }`), Unlink (`PATCH { routeId: null }`). A route upload on this page is one action: `POST /admin/routes` then `PATCH /admin/events/{id} { routeId }`; a `200` from the POST is reported as "Identical route already exists as <name>; linked that one."
- **Locations**: filters `beaconId` (select from `keys.beacons`, any) and `publishedOnly` (switch); a paged preview table of `LocationRow` (`limit` 100); "Download CSV" calls `events.locationsCsv` with the same filters and saves `locations-<year>.csv` through `downloadBlob`. The download goes through `fetch` because the request needs the `Authorization` header.
- **Cookies**: a link "Moderate cookies" to `/cookies?eventId=<id>`.

**StatusDialog** (shared with the dashboard): title "Change status of <name>: <from> to <to>"; a `notify` checkbox (default off) with a consequence line under it: for target 2 or 3 with `notify` on, "<verified count> verified subscribers will be emailed" (count from `keys.subscribersSummary`, fetched when the dialog opens); for target 2 or 3 with `notify` off, "No email will be sent"; for other targets, "Emails go out only when entering scheduled or live". For target 3 the dialog adds the active beacon line from `keys.beacons`: "Active beacon: <name>, heartbeat <age>, stale: yes/no" or "Active beacon: none". Confirm sends `{ statusId, notify }`.

### 6.4 Routes

Table newest first: `name`, `pointCount`, `createdAt`, `uploadedBy`, `url` link, "Used by" (events with this `routeId`, from `keys.events`). Delete with confirmation; `409 route_in_use` shows "Used by <event names>; unlink it there first". A "Upload route" button opens `RouteUploadDialog` without linking to an event.

### 6.5 Beacons

**List** (`/beacons`, polled): table by name: name, role, `keyPrefix`, "Active" chip, flags (5.2), last seen, last heartbeat, last location as ages, revoked marker (row greyed, no flags, no actions but open). Row actions: Activate (hidden when active or revoked), Deactivate (when active), Rotate, Revoke (hidden when revoked), open. "New beacon" opens `BeaconCreateDialog`: `name`, `notes`, `role` radio (beacon, admin) with the text "Role cannot be changed later; admin unlocks Red-Nose's debug mode and log upload."

**KeyRevealDialog** (after create and after rotate): the `key` in a monospace read-only field with a Copy button; the `enrollment.qrPngDataUrl` as `<img>`; `enrollment.url` as text with Copy; a live countdown to `enrollment.expiresAt` ("QR valid for 14:32"; at zero, "QR expired. The key still works when typed by hand; rotate to mint a new QR"); the warning "This key is shown once. Store it before closing." The dialog has no backdrop close and no escape close; the only button is "I have stored the key".

**Detail** (`/beacons/:id`): selects the row from `keys.beacons` (same poll as the list, `staleAfterS` included). Header: name, role, `keyPrefix`, Active chip, revoked banner with `revokedAt`, `createdBy`, `createdAt`. An edit form for `name` and `notes`. The same activate, deactivate, rotate, revoke actions. Ages block: `lastSeenAt`, `lastHeartbeatAt`, `lastLocationAt`, `staleSince`, each as an age plus the absolute Mountain time; `heartbeat_old` and `stale` flags colour these red.

**TelemetryPanel**: `telemetry === null` renders "No heartbeat received". Otherwise `sentAt` with its age, then six groups, every documented leaf shown with its unit, `null` rendered as "unknown":

| Group | Leaves | Coloured by |
|---|---|---|
| Power | `batteryPercent` %, `charging`, `batteryTempC` C, `thermalStatus` | `battery_low` on `batteryPercent` |
| Radio | `networkType`, `signalDbm` dBm, `signalLevel`, `airplaneMode`, `connected` | none |
| GPS | `provider`, `satellitesUsed`, `satellitesInView`, `lastFixAccuracyM` m, `lastFixAgeS` s, `fixesLastMinute`, `permission.foreground`, `.background`, `.precise` | `no_recent_fix` on `lastFixAgeS`; `permission_missing` on each false permission |
| Transport | `socketState`, `reconnectCount`, `httpFallbackSeconds` s, `lastReceiptLatencyMs` ms, `sendsFailedSinceBoot` | `socket_down` on `hubConnected` (gateway truth), falling back to `socketState` when the gateway did not answer |
| Process | `deviceUptimeS`, `serviceUptimeS` (rendered as d h m), `serviceRestartCount`, `memoryPressure`, `batteryOptimizationExempt`, `notificationPermission`, `systemApp`, `rootAvailable` | none |
| Identity | `deviceModel`, `androidVersion`, `appVersion`, `clockSkewMs` ms | none |

Keys inside a group that are not in the table render below the group as "Other" in a `ThemedJsonView`. A collapsed "Raw heartbeat" `ThemedJsonView` shows the whole object.

**BeaconLogs** (role `admin` only): list from `GET /admin/beacons/{id}/logs` newest first (`receivedAt`, `appVersion`, `sizeBytes`); clicking a row fetches the text and shows it in a `<pre>` with a Download button (`download.ts`, `beacon-<id>-log-<logId>.txt`).

### 6.6 Sponsors

**List**: table by name: logo (the resolved `logo` asset's 480 px variant or `url`, 40 px, through `lib/mediaUrl.ts`), name, `latestYear` and years count derived from `years[]`, `websiteUrl`. "New sponsor" opens a dialog with `name` plus the seven optional fields; success navigates to the detail page.

**Detail**: edit form (`name`, `contactPerson`, `email`, `phone`, `address`, `websiteUrl`, `fbUrl`, `igUrl`; Save sends changed fields; empty strings become `null`). Delete sponsor with confirmation.

**Years**: table of `years[]` (`eventYear`, `amountDonated` shown as received, `active`, `canAdvertise`, `anonymous`, `registeredAt`) with edit and delete per row, and "Add year". `SponsorYearDialog` fields: `eventYear` (number; fixed when editing), `amountDonated` (text, optional), three switches defaulting to `true`, `true`, `false` on add. Save is `PUT .../years/{eventYear}` (an upsert, so add and edit are the same call).

**LogoSection**: the current `logo` asset (image, filename, dimensions) or "No logo", a "Choose logo" button opening `MediaPicker` (6.15, which can upload on the spot), and "Remove logo". Both send `PATCH { logoMediaId }`; the response `Sponsor` replaces the cached row. `409 media_not_ready` (an upload that never confirmed) reopens the picker on that asset with its Retry.

### 6.7 Cookie types

Table ordered as returned (`sort`, `id`): icon (resolved through the icon list or the media asset, 32 px, or "none"), `name`, `sort`, `active`. Actions: edit (dialog with `name`, `sort`, `active`, and an `IconField`), and "New type" (the same dialog, `active` default on). There is no delete; `active` off removes the type from the snapshot. The icon picker offers the library and uploaded SVG assets only (`kind=svg`).

**Locked while live**: the page fetches `keys.events` on entry. When any event has `statusId === 3`, a `CommentBox` (warning) at the top reads "Locked: <event name> is live. Cookie types can be created, edited, and deactivated again after the event ends." and every write control is disabled. A `409 event_live` from any write (the list was stale) shows the same text and refetches `keys.events`.

### 6.8 Cookies moderation

`/cookies` with an event selector (`keys.events`, preselected to the event flagged `isCurrent`, or to `?eventId=` when present) and an "Include hidden" switch (default on). Paged table from `GET /admin/events/{id}/cookies`: `leftAt`, type name (from `keys.cookieTypes` by `cookieTypeId`, falling back to the id), `personEmail`, `note` (full text; notes are never public), status ("hidden by <hiddenBy> at <hiddenAt>" or "visible"). Actions per row: Hide or Unhide (no confirmation; the response row replaces the cached row), Delete (confirmation). A `CommentBox` states: hidden cookies leave the public tally and still count toward the person's limit; deleted cookies do neither; moderation is allowed in any event status.

### 6.9 Settings

One row per key from `GET /admin/settings`, in this order, with the description shown next to the input:

| Key | Description shown | Range | Unit |
|---|---|---|---|
| `poll_interval_ms` | How often the public site polls the CDN | 1000 to 60000 | ms |
| `cookie_limit_per_person` | Cookies one person may leave per event (hidden ones count) | 0 to 1000 | |
| `sponsor_linger_ms_per_dollar` | Sponsor carousel time per dollar donated | 0 to 100000 | ms |
| `sponsor_linger_min_ms` | Minimum sponsor carousel time | 0 to 600000 | ms |
| `beacon_stale_after_s` | Seconds without a heartbeat or location before a beacon is flagged stale | 15 to 3600 | s |

Each row shows `value`, `updatedBy` and `updatedAt` ("default" when both are null), a number input, and its own Save button (`PUT /admin/settings/{key}` with `{ value }`). Validation per 7.2; the response `Setting` replaces the row. A `CommentBox` states that every save rebuilds the snapshot and rewrites the live object, so a new poll interval reaches the site within its next poll.

### 6.10 Subscribers

Header counts from `GET /admin/subscribers/summary`: verified, pending, unsubscribed. Filter: All, Verified, Pending, Unsubscribed (maps to the `status` query, absent for All). Paged table: `personEmail`, `address`, `channel`, `verifiedAt`, `unsubscribedAt`, `createdAt`; Delete per row with confirmation ("The person may subscribe again").

**Export CSV** walks the list for the selected filter with `limit: 500`, following `nextCursor` until it is `null`, showing "Exporting: <n> rows" meanwhile, then builds the CSV with header `id,personId,personEmail,channel,address,verifiedAt,unsubscribedAt,createdAt` (RFC 4180 quoting, CRLF, `null` as empty) and saves `subscribers-<filter>-<yyyyMMdd>.csv`.

### 6.11 People and contact messages

`/people`: paged table `email`, `cookieCount`, `createdAt`, `lastSeenAt`; Delete with confirmation ("Deletes this person's subscriptions and cookies. The Cognito user is removed separately in the console."). `/contact-messages`: paged table `createdAt`, `name`, `email` (as a `mailto:` link), `body`, `clientIp`; Delete with confirmation.

### 6.13 Pages

`/pages`: two lists. **Status pages**: the six role pages in status order (No event, Planned, Scheduled, Live, Ended, Cancelled), each with its title, section count, and problem count; they cannot be deleted, hidden, or renamed by role, and open the editor. **Pages**: the `none` pages in nav order with drag handles (`PUT /admin/pages/order` on drop), showing slug, title, nav label (or "not in nav"), hidden state, section count, problem count (red when non-zero). Row actions: open, page settings (`PageSettingsDialog`: `slug`, `title`, `navLabel` with an "in navigation" switch, `isHidden`; `PATCH`), delete with confirmation ("Delete <title> and its <n> sections? Links to /<slug> will stop working until you publish a page with that slug."). "New page" opens `PageCreateDialog` (`slug` auto-derived from `title` and editable, `title`, `navLabel`); success opens the editor. A `CommentBox` at the top: "Changes here are drafts until you publish."

### 6.14 Page editor

`/pages/:id`, the panel's main surface. Layout: a header with the page title, slug, a "Page settings" button, a "Preview" button (6.17), and the `PublishBar` (draft state, problem count, a Publish button that goes to `/publish`); below it the section stack.

**Section stack**: one `SectionCard` per section in order, with a drag handle (`PUT .../sections/order` on drop), the kind's title and a live or content chip, a hidden toggle, a problems badge, and a menu: Duplicate, Move to page (dialog choosing a page and position; disabled targets show "not allowed on this page" when the kind's `allowedRoles` excludes the target's role), Delete (confirmation). Between cards an "Add section" button opens `SectionPalette`: every kind from `keys.kinds` in palette order with title and description, kinds whose `allowedRoles` exclude this page's role greyed with the reason; choosing one calls `POST .../sections { kind, position }` with the kind's `defaults` and opens the card.

**Section card body**: two tabs, Content and Presentation. Content renders `SchemaForm` over the kind's `schema` and, for kinds with items, `ItemsEditor` (a sortable list of `SchemaForm`s over `itemSchema`, add, duplicate, hide, delete, drag to reorder; `POST`, `PATCH`, `DELETE`, `PUT .../items/order`). Presentation renders `PresentationPanel`: width, alignment, background (none, token with a swatch row, media with `MediaField` and an overlay slider), spacing, icon before and after (`IconField`), anchor. Edits are saved on blur and on a 1 s debounce with `PATCH` (draft validation on the API side; a `400` lands on the field); a spinner and "Saved" or "Not saved" sit in the card header. Problems from the response render under the offending field and in the card's badge.

**`SchemaForm`** is `@rjsf/mui` with `validator-ajv8` running the draft-level schema (derived client-side by `schemas/draft.ts` exactly as the API derives it) so an editor sees type errors immediately and incompleteness only as a publish problem. Custom fields are registered by the primitive's `$ref` (`#/$defs/Icon`, `MediaRef`, `Link`, `Inline`, `Presentation`, `Block`):

| Primitive | Field | Behaviour |
|---|---|---|
| `Inline` | `InlineField` | A text area with a toolbar (bold, italic, code, link, icon, placeholder) that inserts the grammar's markers, a character counter (5000), and a live rendered preview underneath (`InlinePreview`, using `schemas/inline.ts`); placeholders show sample values |
| `Icon` | `IconField` | The current icon (rendered) and a "Choose" button opening `IconPicker`: a searchable grid of the library (`keys.icons`, by name and tags) and a second tab of uploaded SVG assets (`media?kind=svg`) with an upload button; Clear |
| `MediaRef` | `MediaField` | The current image (variant 480) with filename and dimensions, "Choose" opening `MediaPicker`, an alt override text field ("leave empty to use the asset's alt"), Clear |
| `Link` | `LinkField` | Label (`InlineField`), href with a mode toggle (external URL, email, site page: a select of non-hidden page slugs plus an optional anchor), icon, open in new tab |
| `Block[]` | `BlocksField` | A sortable list of blocks with an "Add block" palette (heading, paragraph, list, quote, media, links, icon, divider); each block renders its own small form from `Block`'s schema variant, with `InlineField` for text, `MediaField`, `IconField`, and `LinkField` inside; duplicate, delete, drag |
| `Presentation` | `PresentationPanel` | As above |

Everything else (strings, numbers, booleans, enums, nested objects, arrays of scalars) is the generator's default MUI widget, so a new field in a kind schema appears in the panel with no panel change. Enum values display their schema `title` when present.

### 6.15 Media library

`/media`: an `Uploader` drop zone at the top and a `MediaGrid` below with filters (kind, state, search) backed by `keys.media(q)` as an infinite query.

**Upload**: for each dropped file, the client pre-check (7.4: type by magic bytes, size against 20 MB or 1 MB) runs first; then `POST /admin/media/upload-url`, `uploadToS3` with a progress bar, `POST .../confirm`; the card shows pending, uploading (percent), confirming, ready, or failed with the reason and a Retry that repeats confirm (or the whole sequence when the PUT failed). Several files upload in parallel, at most three at a time. Alt and title can be typed before the upload starts and are sent on the ticket.

**Card**: the 480 px variant (or the original for svg and gif), filename, dimensions, size, kind chip, state chip (pending grey, ready none, orphaned amber with "expires in N days"). Click opens `MediaDetailDrawer`: the original at full size, every variant as a link, `alt` and `title` editable (`PATCH`), a copy-URL button per variant, a `UsageList` from `GET .../usage` (draft pages as links to their editors, version count, sponsors, cookie types, site settings), and Delete. Delete is confirmed ("Delete <filename>? The file and its variants are removed from the CDN.") and refused by the API with `409 media_in_use`, which the drawer renders as "In use by:" with the usage list.

**`MediaPicker`** (used by `MediaField`, the sponsor logo, and cookie icons through `IconPicker`): a dialog with the same grid filtered to `state=ready` (plus the kind filter the caller passes, `svg` for icons), a search box, and an Upload tab that runs the upload flow inline and selects the asset when it is ready.

### 6.16 Site settings

`/site-settings`: one `SchemaForm` over the vendored `site-settings.schema.json` at the draft level, with the same custom fields (`IconField` for logo and favicon, `LinkField` lists for nav extras and footer links, `InlineField` for texts, `ThemeField` for the theme object: accent swatches, surface swatches, font pairing samples, snow default switch). Save sends the whole document with `PUT`; problems from `GET /admin/site-settings` render under their fields. A Preview button (6.17) opens the home page. A `CommentBox`: "Settings are drafts until you publish."

### 6.17 Preview

`PreviewFrame` is a dialog holding an `<iframe>`. Opening it calls `POST /admin/content/preview-token` and sets `src` to `url + "&page=" + slug` (the page being edited; the home page for site settings; a page selector in the dialog switches without a new token until the token expires). A Reload button reloads the frame after edits; a countdown shows the token's remaining minutes and a new token is minted on demand. Device toggles set the frame width to phone, tablet, or desktop. The frame is the real public site, so it also shows the current live data.

### 6.18 Publish

`/publish`: the `ContentStatus` card at the top: "Published version <id> (<label>) by <email> <age>", "Draft changed <age>" and either "No unpublished changes", "Ready to publish" (green), or "<n> problems block publishing" (red) with a `ProblemList` where every row links to the section (page editor with the card expanded) or to site settings. The Publish button opens a dialog with an optional label and a consequence line ("The public site updates within its next poll"); success shows the new version and refreshes the list. `409 content_unchanged` shows "Nothing to publish"; `422 content_invalid` refreshes the problem list.

**Versions**: the newest 50 newest first: id, label, publisher, time, page and section counts, and for the newest a "Published" chip. Row actions: View (a dialog rendering the document as a read-only tree: pages and their sections by kind and heading, plus the raw JSON in `ThemedJsonView`), Restore (confirmation: "Replace the current draft with version <id>? Unpublished changes are lost. Nothing is published until you publish."), and Restore and publish (the two calls in sequence with the label "Restored from version <id>", confirmed the same way with the added line "The public site updates within its next poll"). A Preview button on a row is not offered; restore to draft and preview instead.

### 6.19 Auth pages

`SignIn`, `Callback`, `NoRole`, `MfaSetup`, `ConfigError` per section 3. Each renders the title, the environment badge, and one action; none fetches from the API.

---

## 7. Forms and validation

### 7.1 Conventions

- Every string input is trimmed before validation and before sending. An empty optional string is sent as `null`. Required strings fail on empty after trim.
- Length limits count `string.length` (UTF-16 code units), the same unit the API uses.
- Numbers are parsed with `Number()`; `Number.isInteger` where the rule says integer; `Number.isFinite` always.
- Validation runs on submit and re-runs on change for fields that already have an error. Field errors render as MUI `error` plus `helperText`. The submit button is disabled while a mutation is in flight, never on validation state.
- Bodies are built from typed objects (section 4.4), so no unknown field can be sent.
- Server `details.fields` (8.1) are merged into the same field-error map after a `400`; unmapped keys are listed in the form's `ErrorAlert`.

### 7.2 Rules

| Form | Field | Rule (mirrors the API) | Message |
|---|---|---|---|
| Event create and edit | `year` | integer, 2000 to 2100 | "Year must be between 2000 and 2100" |
| | `name` | 1 to 200 | "Name is required" / "Name must be 200 characters or fewer" |
| | `scheduledAt` | null or a valid datetime; on edit, cannot be null while `statusId` is 2 | "Required while the event is scheduled" |
| | `wentLiveAt`, `endedAt` | null or a valid datetime | "Enter a valid date and time" |
| | `fundsPercent` | integer, 0 to 100 | "Must be a whole number between 0 and 100" |
| | route choice | inherit implies `routeId` null; choose implies a selected route | "Choose a route" |
| Status | `statusId` | 1 to 5, not the current status | (buttons for the current status are not shown) |
| | `notify` | boolean, always sent | |
| Message | `body` | 1 to 1000 | "Message is required" / "1000 characters or fewer" |
| | `eventTime` | null or a valid datetime | |
| | `notify` | boolean, always sent | |
| Route upload | see 7.3 | | |
| Beacon | `name` | 1 to 100 | |
| | `notes` | 0 to 2000 | |
| | `role` | `beacon` or `admin` | "Choose a role" |
| Sponsor | `name` | 1 to 200 | |
| | `websiteUrl`, `fbUrl`, `igUrl` | null, or parses with `new URL()` with protocol `http:` or `https:`, length at most 2048 | "Enter an absolute http or https URL" |
| | `contactPerson`, `email`, `phone`, `address` | trimmed; empty becomes null | |
| Sponsor year | `eventYear` | integer, 2000 to 2100 | |
| | `amountDonated` | empty becomes null; otherwise matches `^\d{1,10}(\.\d{1,2})?$` and is at most 1,000,000,000; sent as `Number(text)` | "Amount with at most two decimals, up to 1,000,000,000" |
| | `active`, `canAdvertise`, `anonymous` | booleans, always sent | |
| Media upload | file | raster and gif at most 20,971,520 bytes, svg at most 1,048,576; sniffed type png, jpeg, webp, gif, or svg (7.4); filename 1 to 100 after sanitizing | "File is larger than 20 MB" / "SVG is larger than 1 MB" / "Unsupported image type" |
| | `alt` | 0 to 500 | |
| | `title` | 0 to 200 | |
| Page | `slug` | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1 to 60, not `auth`, `preview`, `api`, `admin`, `assets` | "Lowercase letters, digits, and single hyphens" / "This name is reserved" |
| | `title` | 1 to 200 | |
| | `navLabel` | null or 1 to 40 | |
| Section, item, site settings | `data` | the draft-level schema through `validator-ajv8`; the API's `400` lands on the field | the schema's message |
| Publish | `label` | null or 1 to 100 | |
| Cookie type | `name` | 1 to 100 | |
| | `sort` | integer, -1000 to 1000 | |
| | `active` | boolean, always sent on create | |
| | `icon` | null, a library id from `keys.icons`, or a ready svg media asset | "Choose an icon" |
| Setting | `value` | integer within the key's range (6.9) | "Must be a whole number between <min> and <max>" |

### 7.3 Route file validation

`RouteUploadDialog`: a file input (`.json`), a `name` field prefilled from the file's `name` key once parsed (editable), and a validation report. Validation runs client-side on file selection and mirrors the route object rules exactly; the API remains the authority and its `400` is shown the same way.

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

The report shows the issues as a list with paths, or the summary (point count, bounding box, first and last `recordedAt`) and an enabled Upload button. Upload sends `{ name, points }` with the edited `name` and the file's `points` unchanged. A downloaded CDN route object fails step 3 on `schemaVersion`; the message tells the admin which key to remove.

### 7.4 Image pre-checks

```ts
// src/validation/image.ts
export type SniffedType = "png" | "jpeg" | "webp" | "gif" | "svg" | null;
export async function sniff(file: File): Promise<SniffedType>;   // reads the first 512 bytes
```

PNG `89 50 4E 47 0D 0A 1A 0A`; JPEG `FF D8 FF`; WebP `RIFF` at 0 and `WEBP` at 8; GIF `GIF87a` or `GIF89a`; SVG when the bytes decode as UTF-8 text and, after optional BOM, whitespace, an XML declaration, comments, and a DOCTYPE, begin with `<svg`. Anything else is `null`. The size limit is checked before the sniff. The sniffed type decides the `contentType` sent on the upload ticket, so a renamed file is declared as what it is. The API's SVG content rules (no `script`, no `on*` attributes, no `foreignObject`, no external `href`) are not duplicated; its `400` at confirm is displayed on the card.

### 7.5 Dates

Inputs are MUI `TextField type="datetime-local"` in the browser's local time zone. Conversion:

```ts
// src/lib/time.ts
export const MT = "America/Denver";
export const fromLocalInput = (v: string): string | null => (v === "" ? null : new Date(v).toISOString());   // RFC 3339, UTC, milliseconds, Z
export const toLocalInput = (iso: string | null): string;   // yyyy-MM-ddTHH:mm in the browser zone, "" for null
export const formatMt = (iso: string | null): string =>
  iso === null ? "" : `${new Intl.DateTimeFormat("en-US", { timeZone: MT, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))} MT`;
export const ageS = (iso: string | null, nowMs: number): number | null => (iso === null ? null : Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000)));
export const formatAge = (s: number | null): string;   // "never", "12 s ago", "3 min ago", "2 h ago", "5 d ago"
```

Every datetime input shows `formatMt(fromLocalInput(value))` as helper text so the admin sees the Mountain time that will be stored. Every displayed timestamp uses `formatMt`; every "last X" uses `formatAge` with the absolute value in a tooltip.

---

## 8. Error display

### 8.1 From `ApiError` to the screen

- `ErrorAlert` (MUI `Alert severity="error"`) at the top of the form or dialog that made the call: the `message`, then `details.fields` entries not mapped to an input as "field: message" lines, then `requestId` in monospace ("Request <id>") for the CloudWatch lookup.
- `validation_failed` field keys are matched to input names; matched entries become field errors (7.1).
- Success: a `Snackbar` ("Saved", "Status changed", "Key rotated") for 4 s through `useNotify()`.
- Read failures on a list page: an `ErrorAlert` in place of the table with a Retry button. On polled views a failed poll keeps the last data and shows a small "last update <age>" caption in amber until a poll succeeds.
- `NetworkError`: "API unreachable" in the alert; the global banner on polled views (6.1).

### 8.2 Codes

| Code | Handling |
|---|---|
| `validation_failed` | field errors plus the alert |
| `unauthenticated` | one silent renew and retry; then state `signed_out` |
| `forbidden` | alert "Not available for your role" with the request id; the layout stays |
| `mfa_required` | state `mfa_required` |
| `not_found` | alert "No longer exists"; close the dialog; refetch the list |
| `year_taken` | field error on `year`: "An event for this year exists" |
| `scheduled_at_required` | field error on `scheduledAt`: "Required while the event is scheduled" |
| `event_status_unchanged` | alert; refetch the event |
| `event_not_current` | alert "Only the current event can go live. Set it current first." |
| `another_event_live` | alert "Another event is live: <name>" (name from `keys.events`) |
| `current_event_live` | alert "The current event is live. End it before changing the current event." |
| `event_live` | cookie types: the locked banner (6.7); event delete: alert "A live event cannot be deleted" |
| `event_has_locations` | alert "This event has recorded locations and cannot be deleted" |
| `route_in_use` | alert "Used by <event names>; unlink it there first" |
| `beacon_revoked` | alert "This beacon is revoked"; refetch beacons |
| `slug_taken`, `slug_reserved` | field error on `slug` |
| `page_has_role` | alert "Status pages cannot be deleted" |
| `unknown_kind`, `kind_not_allowed` | alert with the kind and the reason; refetch `keys.kinds` and the page |
| `content_unchanged` | alert "Nothing to publish" |
| `content_invalid` | the problem list from `details.problems`; nothing else |
| `media_not_ready`, `media_not_pending`, `upload_not_found` | on the media card or picker: the state and a Retry that re-runs confirm or the upload |
| `media_in_use` | the usage list from `details.usage` in the drawer |
| `preview_token_invalid` | (seen inside the frame) the frame's "expired" page; the dialog mints a new token on Reload |
| `payload_too_large` | alert with the limit of that upload |
| `unsupported_media_type` | alert "Unsupported file type. Allowed: <list>" |
| `rate_limited` | alert "Too many requests. Retry in <retryAfterSeconds> s"; the action button is disabled for that long |
| `snapshot_write_failed`, `route_write_failed`, `media_write_failed`, `upstream_failed` | alert "Storage write failed; nothing was saved. Try again." with the request id (for `media_write_failed` the card offers Retry) |
| `internal_error` | alert with the message and request id |
| `unavailable` | alert "The API is starting. Try again in a few seconds." |
| `method_not_allowed`, `unknown` | alert "Unexpected response <status>" with the request id when present |

### 8.3 Confirmation dialogs

`ConfirmDialog` takes a title, body, confirm label, and a `danger` flag (red confirm button). Every entry below opens one; nothing else does.

| Action | Body | Confirm |
|---|---|---|
| Status change (any target) | `StatusDialog` (6.3); for target 3 it includes the active beacon's name or "none", heartbeat age, and stale flag | "Change status" / "Set live" |
| Set current | "Make <name> the current event? The public site switches to it on its next poll." | "Set current" |
| Delete event | "Delete <name>? Its messages, cookies, and status history are deleted with it." | "Delete" |
| Delete message, route, sponsor, sponsor year, cookie, subscriber, person, contact message, page, section, item, media asset | "Delete <thing>? This cannot be undone." plus the specific note in 6.x where one exists | "Delete" |
| Restore a version | "Replace the current draft with version <id>? Unpublished changes are lost. Nothing is published until you publish." | "Restore" |
| Restore and publish | the same plus "The public site updates within its next poll." | "Restore and publish" |
| Publish | the label dialog with "The public site updates within its next poll." | "Publish" |
| Activate beacon | "Activate <name>? Only its updates are published, starting with its next update." | "Activate" |
| Deactivate beacon | "Deactivate <name>?" plus, when `isActive` and an event is live: "Location fan-out stops until another beacon is activated." | "Deactivate" |
| Rotate key | "Rotate the key for <name>? The current key stops working immediately and the phone must be re-enrolled with the new key." plus, when `isActive` and an event is live: "Location fan-out stops until this phone is re-enrolled with the new key or another beacon is activated." | "Rotate" |
| Revoke beacon | "Revoke <name>? This is permanent." plus, when `isActive` and an event is live: "Location fan-out stops until another beacon is activated." | "Revoke" |

"An event is live" means `keys.events` contains a `statusId === 3` row at the moment the dialog opens. Republish, Rebuild snapshot, Hide, Unhide, section and item edits, and every save have no confirmation.

---

## 9. Tests

### 9.1 Unit (Vitest, jsdom)

| File | Covers |
|---|---|
| `validation/*.test.ts` | every rule in 7.2 at its boundaries, trimming, empty to null, integer checks |
| `validation/routeFile.test.ts` | `contracts/fixtures/route.json` with `schemaVersion` removed passes; with it present fails on `schemaVersion`; one point, 50,001 points, `lat` 91, missing `recordedAt` key, bad RFC 3339, 5 MB + 1 byte; issue paths and the `total` count |
| `validation/image.test.ts` | magic bytes for each type, SVG with BOM and comments, a renamed PNG declared as SVG returns `png` |
| `lib/publishedState.test.ts` | identical inputs give `[]`; each of the three mismatches; two-poll persistence; reset on a clean poll; `write_error` precedence; `cdn_unreachable` |
| `lib/beaconFlags.test.ts` | each flag on and off; null telemetry; null permission not flagged; revoked returns `[]`; `anyEventLive` gate on `lastLocationAt` |
| `lib/time.test.ts`, `lib/csv.test.ts` | conversions, `formatMt` with DST dates, RFC 4180 quoting |
| `api/errors.test.ts` | body parse, `fields`, `retryAfterSeconds`, 405 without body |
| `api/types.test.ts` | `contracts/fixtures/live-object.json`, `snapshot.json`, `heartbeat.json` satisfy `LiveObject`, `Snapshot`, `Heartbeat` (compile-time `satisfies` plus a runtime key check) |
| `auth/claims.test.ts` | admin, editor, both (admin wins), absent, not an array, different group |
| `schemas/draft.test.ts` | derivation removes `required`, `minLength`, `minItems`, `minimum` at every level and nothing else; every vendored kind schema derives without error |
| `schemas/inline.test.ts` | each token; unbalanced markers as text; placeholders; the API fixture strings |
| `validation/page.test.ts` | slug rule and the five reserved names |
| `validation/image.test.ts` | adds GIF magic bytes and the two size limits |

### 9.2 Component (Vitest, Testing Library, MSW)

MSW handlers in `src/test/msw/handlers.ts` serve every endpoint in 4.4 from fixture-shaped data; unhandled requests fail the test. `renderWithProviders` supplies a `QueryClient` with retries off, a mocked `UserManager` (`vi.mock("oidc-client-ts")`) whose `getUser()` returns a configurable user, and a `MemoryRouter`.

| Suite | Asserts |
|---|---|
| Auth guard | spinner while loading; `SignIn` when no user; `NoRole` for a user without a group; layout for an admin and the reduced layout for an editor; a `userLoaded` event without a group switches to `NoRole`; `403 mfa_required` switches state; `403 forbidden` shows the alert and keeps the layout |
| Dashboard | cards render from fixtures; with fake timers, two mismatched polls render "CDN behind" and one does not; Republish calls the endpoint and invalidates; `lastWriteError` renders red |
| Events | create dialog inherit preview names the right route; disabled reasons on status buttons; `StatusDialog` for target 3 shows the active beacon line; `409` codes map per 8.2; route upload posts then patches |
| Beacons | create shows `KeyRevealDialog` with the key and the QR `data:` URL, and only "I have stored the key" closes it; rotate on the active beacon while live shows the fan-out sentence; telemetry colouring per flag; unknown nested keys appear under Other |
| Sponsors | year upsert sends the four fields; choosing a logo sends `PATCH { logoMediaId }`; `409 media_not_ready` reopens the picker |
| Cookie types | banner and disabled controls when an event is live; `409 event_live` shows the banner; the icon picker offers the library and svg assets only |
| Pages | role pages have no delete; drag reorder sends `PUT /admin/pages/order` with every `none` id; delete confirmation names the section count |
| Page editor | palette greys a kind the page's role excludes; add section posts the kind's defaults; a debounced edit patches once; a `400` lands on the field; problems badge; duplicate, move, hide, delete; items reorder |
| SchemaForm | every vendored kind schema renders from its defaults; each primitive `$ref` mounts its custom field; an unknown scalar field renders the default widget |
| Media library | a 21 MB PNG and a 2 MB SVG are rejected before any request; ticket, PUT (mocked XHR with progress), confirm sequence; PUT failure offers Retry; `409 media_in_use` renders the usage list |
| Site settings | the form renders from the vendored schema; save sends the whole document |
| Publish | status card states; problem rows link to the editor; `content_unchanged` and `content_invalid` handling; restore confirmations; restore and publish sends two calls with the label |
| Preview | opening mints a token and sets the frame `src` with the page; reload keeps the token; expiry mints a new one |
| Cookies | hide and unhide replace the row; the event selector preselects the current event |
| Settings | each key's range; `PUT` body is `{ value }` |
| Subscribers | export follows `nextCursor` across pages and produces the documented header |
| Errors | `requestId` renders; `details.fields` land on inputs; `rate_limited` disables the button |

### 9.3 End to end (Playwright, dev stack)

Runs against `vite preview` on `http://localhost:5174` with the dev variables, so the origin is registered on the dev Cognito client, in the dev CORS list. Secrets on the `dev` GitHub environment: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ADMIN_TOTP_SECRET` (a dedicated dev admin; the test generates codes with `otpauth`). Specs:

1. Sign in through the hosted UI with password and TOTP; the layout renders with the `DEV` badge; sign out returns to `SignIn`.
2. Create a beacon; the key dialog shows a `wbk_` key and a PNG data URL; rotate it; revoke it.
3. Create an event with inherit; set it current; walk planned to scheduled (after setting `scheduledAt`) to live to ended through the confirmations; after each change `GET <dev cdn>/live/location.json` reports the new `eventStatusId` within 10 s.
4. Change `poll_interval_ms`; the CDN object's `pollIntervalMs` follows within 10 s; restore it.
5. With the event live, cookie type controls are disabled; after ended, a type can be edited.
6. Upload the vendored route fixture (with `schemaVersion` stripped by the test) to an event; the route section shows its point count.
7. As an editor (a second dev user in group `editor` with TOTP, secrets `E2E_EDITOR_*`): the drawer shows five entries; open the about page, add a `rich_text` section with a paragraph, upload a small PNG through the media library, add a `media` section using it, preview the page in the frame and see both, publish with a label; `GET <dev cdn>/live/location.json` reports a new `snapshotUrl` within 10 s and the snapshot's `content` contains the paragraph and the media map contains the asset with three variants absent (the PNG is 400 px wide) and its `url` present; restore the previous version and publish again; delete the section and the asset (`409 media_in_use` first, then after removing the reference, `204`).
8. As the editor, `GET /admin/events` answers `403 forbidden` and the Events route renders "Not available for your role".

The workflow runs on `workflow_dispatch` and nightly, not on every push.

---

## 10. CI and deploy

`.github/workflows/ci.yml` on every push and pull request: `npm ci`; `npm run check:contracts` (checks out the API repository at `CONTRACTS_SHA` and diffs its `contracts/` against the vendored copy); `npm run gen:api-types` followed by `git diff --exit-code src/api/schema.d.ts`; `npm run typecheck`; `npm run lint`; `npm test`; `npm run build`. Updating the contracts is one commit: copy `contracts/`, bump `CONTRACTS_SHA`, regenerate `schema.d.ts`, fix the type errors.

Vercel builds `main` into production with the prod variables. A second Vercel project builds `dev` at `<admin-dev-domain>` with the dev variables (contracts 8.4). Local work runs `npm run dev` with `.env.local` holding the dev set.

---

## 11. Decisions made here

- The `MfaSetup` page enrols the authenticator in place through `AssociateSoftwareToken`, `VerifySoftwareToken`, and `SetUserMFAPreference` with the access token; the `wmsfo-admin` app client carries scope `aws.cognito.signin.user.admin` and the panel adds the `qrcode` dependency.
- `contracts/admin-thresholds.json` is `{ "batteryLowPercent": 20, "noFixAgeS": 30, "noLocationAgeS": 30 }`, published by the API repository and imported by `thresholds.ts`.

- The panel does not join the hub; it polls the API and the CDN as the contracts' data loop describes.
- `@tanstack/react-query` provides polling, pause-when-hidden, refetch-on-visible, and refetch-after-write; queries and mutations do not retry.
- The API client is a `fetch` wrapper with types generated by `openapi-typescript` from the vendored `contracts/openapi.json`; `axios` is dropped; `LiveObject`, `Heartbeat`, and `LiveState` are declared by hand from the contracts and fixture-checked.
- Tokens live in `sessionStorage`; there is no automatic redirect into the hosted UI, a `SignIn` page with one button starts sign-in; sign-out revokes the refresh token before Cognito logout.
- `401` handling is one silent renew and one retry, then `signed_out`; every renewal re-runs the group check.
- `VITE_ENV` takes `prod`, `dev`, or `local`; the badge is red, green, or blue; non-prod prefixes the document title.
- The legacy iframe of the public site is dropped from the dashboard; the live object preview is the parsed CDN object plus raw JSON, with the node's in-memory copy alongside.
- All displayed times are `America/Denver` labelled `MT`; inputs are `datetime-local` in the browser zone with the resulting Mountain time as helper text; no timezone variables.
- The beacon detail page reads the polled beacons list rather than polling `GET /admin/beacons/{id}`.
- Flags are not evaluated for revoked beacons; every flag colours red; the `anyEventLive` input to the fix rule comes from the events list.
- Cookie moderation is one top-level view with an explicit event selector preselected to the event flagged current.
- Subscriber export is built client-side by paging the list at 500 rows; no export endpoint is assumed.
- Location CSV export goes through `fetch` with the bearer token and a Blob download, not a link.
- Route upload validation mirrors the route object rules client-side before the POST; the route name is editable; the file's points are sent unchanged.
- "Build from event" on the routes page lists ended events with their published location counts and calls `POST /admin/routes/from-event/{eventId}` with a name; the resulting route appears in the list and can be linked to an event from the event page like any other.
- `notify` defaults to off in the status and message dialogs; the dialog states the exact consequence (subscriber count or "no email").
- Status buttons for unreachable targets are disabled with the API's reason as a tooltip; the API's `409` codes are handled as well.
- The `KeyRevealDialog` closes only through its single button.
- Hand-rolled validation functions, no form library; MUI `Table`, no data grid.
- Dev server and preview run on port 5174 with `strictPort`.
- Playwright runs against `vite preview` on `localhost:5174` with the dev variables, nightly and on demand.
- Content forms are generated from the vendored schemas with `@rjsf/mui`; the five primitives have hand-written fields keyed by `$ref`, and the draft-level schema is derived client-side by the same rule the API uses, so a new scalar field in a kind needs no panel change.
- Media uploads go from the browser straight to S3 with the ticket's exact headers over `XMLHttpRequest` for progress; the panel never proxies bytes.
- The page editor autosaves with a 1 s debounce and shows per-card save state; there is no explicit Save on sections.
- Preview is the real site in an iframe with a minted token and a page parameter; the panel never renders content itself.
- Roles come from the token's groups; the layout hides views by role and the API enforces the policy.
- Restore replaces the draft only; "Restore and publish" is two calls with a generated label.

## 12. Needs a decision

Nothing at the moment. Add here as it comes up.
