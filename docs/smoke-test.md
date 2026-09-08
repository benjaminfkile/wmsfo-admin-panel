# Runner smoke test

Date: 2026-09-08
Repository: `wmsfo-admin-panel` (still on Create React App; the Vite migration in
`docs/admin.md` section 2 is intentionally not applied here).

## Tool versions found on the runner

| Tool   | Version   | Notes                                                                 |
|--------|-----------|-----------------------------------------------------------------------|
| node   | v22.23.2  | Meets the "22 or newer" requirement.                                  |
| npm    | 10.9.8    | Ships with the Node 22 image.                                         |
| dotnet | 10.0.400  | Present at `/usr/local/dotnet/dotnet`. Not used by this repo.         |
| gradle | not found | `gradle: command not found`. Not used by this repo.                   |

## Commands

### 1. `node -v`

- Exit code: `0`
- Output:
  ```
  v22.23.2
  ```

### 2. `npm ci`

- Exit code: `1`
- Relevant stderr tail:
  ```
  npm error code EUSAGE
  npm error
  npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
  npm error
  npm error Missing: yaml@2.9.0 from lock file
  npm error
  npm error Clean install a project
  ```
- stdout: (empty)

The install refuses to run because `package-lock.json` is out of sync with
`package.json`. The specific missing entry npm surfaces is `yaml@2.9.0`, an
optional peer dependency of `postcss-load-config` (which is pulled in through
`react-scripts` → `postcss-loader`). The lockfile that was committed does not
resolve it, so `npm ci` (strict mode) aborts before writing anything to
`node_modules/`. Per the task's "do not work around it" guidance, no
`npm install`, lockfile regeneration, or `--legacy-peer-deps` retry was
attempted; the failure is recorded as-is.

Because `npm ci` did not populate `node_modules/`, the two commands that
follow have nothing to run against. Their failures below are downstream
symptoms of this one — the underlying legacy dependency issue is the
`package.json` / `package-lock.json` mismatch introduced by whichever recent
edit bumped versions without regenerating the lockfile.

### 3. `CI=true npm test -- --watchAll=false`

- Exit code: `127`
- stdout:
  ```
  > wmsfo-admin-panel@0.1.0 test
  > react-scripts test --watchAll=false
  ```
- stderr:
  ```
  sh: 1: react-scripts: not found
  ```

Exit 127 is "command not found" — `react-scripts` is not on `PATH` because
`node_modules/.bin/` was never created (see command 2).

### 4. `npm run build`

- Exit code: `127`
- stdout:
  ```
  > wmsfo-admin-panel@0.1.0 build
  > react-scripts build
  ```
- stderr:
  ```
  sh: 1: react-scripts: not found
  ```

`CI=false` was not tried; the failure is not a lint-warning-as-error problem,
it is the same missing-binary symptom as command 3.

## Summary

- The runner itself is healthy: Node 22, npm 10, and dotnet 10 are all present
  and the Node version satisfies the "22 or newer" criterion.
- The legacy CRA build in this repository cannot install on this runner
  because `package-lock.json` is out of sync with `package.json`
  (`Missing: yaml@2.9.0 from lock file`). Fixing that mismatch — either by
  regenerating the lockfile or by advancing to the Vite setup described in
  `docs/admin.md` §2 — is out of scope for this smoke test and was not done.
