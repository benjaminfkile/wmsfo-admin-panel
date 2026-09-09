# wmsfo-admin-panel

The WMSFO admin panel: the only surface for admin and editor actions. Events, beacons, routes, sponsors, cookie types and moderation, settings, subscribers, people, contact messages, and the content system (pages, sections, media, site settings, publish and versions, preview).

Vite 6 + React 19 + MUI v7 + TanStack Query v5 + `react-router-dom` v7 + `oidc-client-ts`. Tests: Vitest, Testing Library, MSW. Hosted on Vercel from `main`; the six `VITE_` variables live on the project.

Design and contracts under `docs/`:

- `docs/admin.md`: this repository's technical design.
- `docs/DESIGN.md`: the design overview for all of v2.
- `docs/contracts.md`: the shared contracts every component codes against.

## Run

```
npm install
cp .env.example .env.local     # fill in the six VITE_ variables
npm run dev                    # http://localhost:5174
```

## Scripts

- `npm run dev`: Vite dev server on port 5174 (strictPort).
- `npm run build`: `tsc -b` then `vite build` into `dist/`.
- `npm run preview`: serve the built `dist/` on port 5174.
- `npm run typecheck`: `tsc -b`.
- `npm run lint`: flat-config ESLint (`typescript-eslint`, `react-hooks`, `react-refresh`).
- `npm test`: Vitest, jsdom, MSW.
- `npm run test:watch`: Vitest in watch mode.
- `npm run gen:api-types`: `openapi-typescript` over `contracts/openapi.json` into `src/api/schema.d.ts`.
- `npm run check:contracts`: compare vendored `contracts/` against `CONTRACTS_SHA` from the API repository.
- `npm run e2e`: Playwright against `vite preview`.

## Environment

Six variables, all prefixed `VITE_`. `.env.example` lists the names; `.env.local` is gitignored.

| Variable | Meaning |
|---|---|
| `VITE_ENV` | `prod`, `dev`, or `local` |
| `VITE_API_BASE_URL` | base URL of the WMSFO API |
| `VITE_CDN_BASE_URL` | base URL of the public CDN |
| `VITE_COGNITO_AUTHORITY` | Cognito user-pool issuer URL |
| `VITE_COGNITO_DOMAIN` | Cognito hosted-UI domain |
| `VITE_COGNITO_CLIENT_ID` | `wmsfo-admin` app-client id |

A missing variable renders the configuration-error page; no auth or API request is made.

## Deploy

Vercel, framework preset Vite, install `npm ci`, build `npm run build`, output `dist`. `vercel.json` rewrites every path to `/index.html`. Production deploys from `main`.
