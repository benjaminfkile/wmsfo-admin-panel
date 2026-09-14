import { defineConfig, devices } from "@playwright/test";

// End-to-end tests for the WMSFO admin panel. Runs against `vite preview`
// on http://localhost:5174 with the dev environment variables so the origin
// is registered on the dev Cognito client and appears in the dev CORS list.
// The workflow that drives this is `.github/workflows/e2e.yml` (nightly and
// on-demand); locally, `npm run e2e` builds and previews the app for you.
//
// Two projects: the desktop `chromium` project runs every spec except
// `09-mobile.spec.ts`, and `mobile` runs only that spec against a Pixel 7
// (390 x 844, touch on).

const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;
const MOBILE_SPEC = /09-mobile\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: MOBILE_SPEC,
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testMatch: MOBILE_SPEC,
    },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
