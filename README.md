# wmsfo-admin-panel

The WMSFO admin panel: the only surface for admin and editor actions. Events, beacons, routes, sponsors, cookie types and moderation, settings, subscribers, people, contact messages, and the content system (pages, sections, media, site settings, publish and versions, preview).

This repository is being migrated in place from Create React App to Vite and rewired to the v2 API and Cognito. The current code is the legacy panel; the target is in `docs/`:

- `docs/admin.md`: this repository's technical design, including the file-by-file migration plan (section 2).
- `docs/DESIGN.md`: the design overview for all of v2 (a copy; the original is in `wmsfo-api/docs`).
- `docs/contracts.md`: the shared contracts every component codes against (a copy; wins on any conflict). Section 4.5 is the admin API.

## Run (target, after the migration)

```
npm install
npm run dev
```

Vite on port 5174, React 19, MUI v7. Configuration is the six `VITE_` variables in `docs/admin.md` section 2.5.
