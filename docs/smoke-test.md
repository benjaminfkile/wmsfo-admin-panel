# Runner smoke test

Date: 2026-09-08
Repository: `wmsfo-admin-panel` (still on Create React App; the Vite migration
in `docs/admin.md` section 2 is intentionally not applied here).

This is the rerun requested by task #244, after the lockfile resync in commit
`86471d9 Resync package-lock.json so npm ci works under npm 10` landed on the
grunt branch. The previous run (task #243) stopped at `npm ci` because
`package.json` and `package-lock.json` were out of sync; that blocker is now
gone.

## Tool versions found on the runner

| Tool | Version   | Notes                                |
|------|-----------|--------------------------------------|
| node | v22.23.2  | Meets the "22 or newer" requirement. |
| npm  | 10.9.8    | Ships with the Node 22 image.        |

## Commands

### 1. `node -v`

- Exit code: `0`
- Output:
  ```
  v22.23.2
  ```

### 2. `npm ci`

- Exit code: `0`
- Relevant tail of stdout/stderr:
  ```
  added 1373 packages, and audited 1374 packages in 19s

  276 packages are looking for funding
    run `npm fund` for details

  59 vulnerabilities (12 low, 14 moderate, 31 high, 2 critical)
  ```
- Numerous deprecation warnings were emitted for transitive dependencies
  (`eslint@8.57.1`, `rimraf@3`, `glob@7`, `svgo@1`, `q@1.5.1`, several
  `@babel/plugin-proposal-*` packages, `w3c-hr-time`, `abab`, `domexception`,
  `stable`, `source-map@0.8.0-beta.0`, `sourcemap-codec`, `rollup-plugin-terser`,
  `workbox-*`, `@humanwhocodes/*`, `inflight`). These are all pulled in through
  `react-scripts` (CRA 5) and none of them prevented install.
- `npm notice`: a newer npm (12.0.2) is available but was not installed; the
  bundled npm 10.9.8 was used for this run.

Install now completes cleanly on Node 22, so criterion #679 (`npm ci exits 0`)
is met.

### 3. `CI=true npm test -- --watchAll=false`

- Exit code: `1`
- Relevant tail of output:
  ```
  FAIL src/App.test.tsx
    ● Test suite failed to run

      Jest encountered an unexpected token

      Details:

      /workspace/node_modules/axios/index.js:1
      ({"Object.<anonymous>":function(module,exports,require,__dirname,__filename,jest){import axios from './lib/axios.js';
                                                                                        ^^^^^^

      SyntaxError: Cannot use import statement outside a module

       > 1 | import axios, {
           | ^
         2 |   InternalAxiosRequestConfig,
         3 | } from "axios";
         4 | import { getApiKey } from "../auth/apiKey";

        at Runtime.createScriptFromCode (node_modules/jest-runtime/build/index.js:1728:14)
        at Object.<anonymous> (src/api/axiosClient.ts:1:1)
        at Object.<anonymous> (src/api/index.ts:1:1)
        at Object.<anonymous> (src/App.tsx:2:1)
        at Object.<anonymous> (src/App.test.tsx:3:1)

  Test Suites: 1 failed, 1 total
  Tests:       0 total
  Snapshots:   0 total
  ```

**Which legacy dependency fails, and why.** The single test suite,
`src/App.test.tsx`, imports `App`, which imports `src/api/axiosClient.ts`,
which imports from `axios` (declared in `package.json` as `"axios": "^1.13.2"`;
`npm ls axios` resolves to `axios@1.13.2`). Since axios 1.x, the package's
`main` entry (`node_modules/axios/index.js`) is an ES module
(`import axios from './lib/axios.js'`). Create React App 5's Jest preset
ignores `node_modules` for Babel transformation by default and does not ship a
Jest-side `transformIgnorePatterns` override for axios, so Jest tries to
`require()` the raw ESM source and throws
`SyntaxError: Cannot use import statement outside a module`.

This is a legacy-toolchain incompatibility, not a Node 22 regression: the same
failure occurs on any Node version because the mismatch is between CRA 5's
Jest config and axios 1.x's ESM entry point. It would be resolved either by
pinning axios to `^0.27` (the last CJS release), or by moving off CRA to the
Vite/Vitest setup described in `docs/admin.md` §2 — both of which are
explicitly out of scope for this task ("do not start" the migration; "do not
work around it").

### 4. `npm run build`

- Exit code: `0`
- Relevant tail of output:
  ```
  Creating an optimized production build...
  Browserslist: browsers data (caniuse-lite) is 9 months old. Please run:
    npx update-browserslist-db@latest
  Compiled successfully.

  File sizes after gzip:

    187.44 kB  build/static/js/main.071f3581.js
    94 B       build/static/css/main.682999b0.css

  The project was built assuming it is hosted at /.
  ```
- `CI=false` was **not** required. `react-scripts build` compiled cleanly with
  the default environment (i.e. as if `CI=true`), so lint warnings were not
  treated as errors. The only diagnostic emitted was the informational
  Browserslist "caniuse-lite is 9 months old" notice, which does not fail the
  build.

## Summary

- Runner health: Node v22.23.2 and npm 10.9.8 are present; the Node version
  satisfies the "22 or newer" criterion (#681).
- `npm ci` now exits 0 on this repo — criterion #679 is met, confirming the
  lockfile resync (`86471d9`) unblocked install.
- `npm run build` exits 0 with the default environment; no `CI=false` fallback
  was needed.
- `npm test` still exits 1. The failure is precisely identified: `axios@1.13.2`
  ships an ESM entry point that CRA 5's Jest preset cannot transform, so the
  only test suite (`src/App.test.tsx`) cannot even parse its imports. Per the
  task's guidance ("do not work around it"), no changes were made to axios,
  Jest config, or `transformIgnorePatterns`; the incompatibility is recorded
  here and the Vite migration in `docs/admin.md` §2 was not started.
