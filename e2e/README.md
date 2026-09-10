# End-to-end tests

Eight Playwright specs that run against `vite preview` on
`http://localhost:5174` with the dev environment variables. Section 9.3 of
`docs/admin.md` is the source of truth for what each spec covers; section 10
describes the CI wiring.

## Local run

Copy `.env.example` to `.env.local`, fill in the dev variables, and set the
dev admin's TOTP secret and password:

```
E2E_ADMIN_EMAIL=<dev admin email>
E2E_ADMIN_PASSWORD=<dev admin password>
E2E_ADMIN_TOTP_SECRET=<base32 secret>
E2E_EDITOR_EMAIL=<dev editor email>
E2E_EDITOR_PASSWORD=<dev editor password>
E2E_EDITOR_TOTP_SECRET=<base32 secret>
```

Then:

```
npm run e2e
```

`playwright.config.ts` runs `npm run build && npm run preview` for you and
tears the server down when the run ends. Codes are generated in the specs
with `otpauth`.

## In CI

`.github/workflows/e2e.yml` runs on `workflow_dispatch` and nightly at
07:00 UTC. It uses the `dev` GitHub environment, whose secrets are:
`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ADMIN_TOTP_SECRET`,
`E2E_EDITOR_EMAIL`, `E2E_EDITOR_PASSWORD`, `E2E_EDITOR_TOTP_SECRET`,
plus the six `VITE_*` variables from `.env.example` pointing at the dev
Cognito pool, API and CDN.

## Against the dev stack

All eight specs pass against dev. Things the specs rely on:

- `signIn` in `helpers.ts` waits for the panel origin, the OIDC user in
  `sessionStorage`, and the drawer before returning; `fetchAdminAccessToken`
  hands back the ID token, which is what the panel sends as the bearer.
- Spec 3 creates its event in an unused year (one event per year, 2000 to
  2100), drives "Set current" and the status walk from the event's detail
  page, and hands "current" back to the standing walk event before deleting
  its own. Spec 5 ends the current event from its detail page the same way.
- Spec 7 restores the "Starter content" version first, exercises the usage
  guard with an asset only the draft references (a published asset stays
  referenced by the version history and cannot be deleted), publishes with
  a second asset, and finishes with "Restore and publish" of the starter
  version. The preview-in-frame assertion is not present: `PageEditor` does
  not mount the Preview button that `docs/admin.md` 6.17 describes.
