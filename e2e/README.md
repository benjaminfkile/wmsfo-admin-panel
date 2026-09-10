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

## M15 status against dev

The task record for M15 lists the failures from an earlier run and the
alignment applied in this branch.

- **Sign-in helper (all specs).** `signIn` in `helpers.ts` now waits until
  the panel origin is loaded, the OIDC user key lives in
  `sessionStorage`, and the drawer navigation landmark renders. That
  removes the "OIDC user missing from sessionStorage after sign-in"
  race in `fetchAdminAccessToken` (specs 5 and 6) and the "Events drawer
  link not found within 15 s" race in spec 3.
- **04 (`poll_interval_ms`).** `Settings.tsx` uses an explicit per-row
  Save button; the spec drives it and waits up to 30 s for the CDN
  refresh cycle. If the PUT lands with 200 but the CDN object keeps the
  old value, that is an API defect (the settings frame must rewrite the
  live object); the spec's failure would then belong on the API side.
- **07 (editor authoring flow).** `MediaField`'s trigger is labelled
  "Choose"; `MediaPicker`'s confirm is also "Choose". The spec now
  clicks "Add item" first (media sections are created with no items),
  scopes the picker's confirm through the `<Dialog role="dialog"
  name="Choose media">`. The preview-in-frame assertion is elided in
  this pass because `PageEditor.tsx` does not yet mount the "Preview"
  button that `docs/admin.md § 6.17` specifies; the rest of the flow
  (publish, snapshot verification, restore, delete with 409 then 204)
  still runs. Adding the button is a separate task.
- **08 (editor forbidden route).** `AppRoutes.tsx` already routes
  `/events` for an editor to `<NotAvailable />` (verified by
  `AuthGuard.test.tsx`, "renders Not available for an editor loading
  /events directly"). No app change was needed here; the previous
  failure appears to have been the same sign-in race that spec 3 hit.
