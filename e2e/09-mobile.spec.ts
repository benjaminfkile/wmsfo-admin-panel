import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { fetchAdminAccessToken, readAdmin, signIn, adminApi } from "./helpers";

// Spec 9 (docs/admin.md § 9.3, mobile project): sign in as admin against
// a 390 x 844 phone viewport (playwright.config.ts, `mobile`), visit every
// route in admin.md § 1, and assert the document never exceeds the viewport
// on any of them. Every route also uploads a full-page JPEG screenshot to
// the test report; failing routes are collected and reported in a single
// assertion at the end rather than stopping at the first.

const STATIC_ROUTES = [
  "/",
  "/events",
  "/routes",
  "/beacons",
  "/qr-codes",
  "/places",
  "/places/map",
  "/scan",
  "/pages",
  "/media",
  "/site-settings",
  "/publish",
  "/sponsors",
  "/sponsors/order",
  "/cookie-types",
  "/subscribers",
  "/people",
  "/contact-messages",
  "/settings",
  "/api-keys",
  "/agents",
  "/audit",
] as const;

type DetailProbe = {
  label: string;
  listPath: string;
  detailFrom: (item: unknown) => string | null;
};

const DETAIL_PROBES: DetailProbe[] = [
  {
    label: "event detail",
    listPath: "/admin/events",
    detailFrom: (item) => {
      const it = item as { id?: number | string };
      return it.id !== undefined && it.id !== null
        ? `/events/${String(it.id)}`
        : null;
    },
  },
  {
    label: "beacon detail",
    listPath: "/admin/beacons",
    detailFrom: (item) => {
      const it = item as { id?: number | string };
      return it.id !== undefined && it.id !== null
        ? `/beacons/${String(it.id)}`
        : null;
    },
  },
  {
    label: "sponsor detail",
    listPath: "/admin/sponsors",
    detailFrom: (item) => {
      const it = item as { id?: number | string };
      return it.id !== undefined && it.id !== null
        ? `/sponsors/${String(it.id)}`
        : null;
    },
  },
  {
    label: "page detail",
    listPath: "/admin/pages",
    detailFrom: (item) => {
      const it = item as { id?: number | string };
      return it.id !== undefined && it.id !== null
        ? `/pages/${String(it.id)}`
        : null;
    },
  },
  {
    label: "qr detail",
    listPath: "/admin/qr-codes",
    detailFrom: (item) => {
      const it = item as { id?: number | string };
      return it.id !== undefined && it.id !== null
        ? `/qr-codes/${String(it.id)}`
        : null;
    },
  },
  {
    label: "place detail",
    listPath: "/admin/places",
    detailFrom: (item) => {
      const it = item as { id?: number | string };
      return it.id !== undefined && it.id !== null
        ? `/places/${String(it.id)}`
        : null;
    },
  },
];

async function measureOverflow(page: Page): Promise<number> {
  // Mobile emulation stretches `window.innerWidth` to the content, so the
  // check has to compare against the emulator's viewport width instead of
  // reading it from the page.
  return await page.evaluate(() => document.documentElement.scrollWidth);
}

function routeSlug(pathname: string): string {
  const trimmed = pathname.replace(/^\//, "").replace(/\//g, "_");
  return trimmed === "" ? "root" : trimmed;
}

async function checkRoute(
  page: Page,
  info: TestInfo,
  pathname: string,
  viewportWidth: number,
): Promise<string | null> {
  await page.goto(pathname);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const scrollWidth = await measureOverflow(page);
  const screenshot = await page.screenshot({ fullPage: true, type: "jpeg", quality: 60 });
  await info.attach(`route-${routeSlug(pathname)}.jpg`, {
    body: screenshot,
    contentType: "image/jpeg",
  });
  if (scrollWidth > viewportWidth) {
    return `${pathname} → scrollWidth ${scrollWidth} > viewport ${viewportWidth}`;
  }
  return null;
}

test.describe("mobile viewport: no horizontal scroll", () => {
  test("every admin route fits 390 px", async ({ browser, page }, info) => {
    const viewport = page.viewportSize();
    expect(viewport, "viewport should be set by the mobile project").not.toBeNull();
    const viewportWidth = viewport!.width;

    // Sign in through the hosted UI. On the phone viewport the layout
    // renders the temporary drawer behind an "Open navigation" button, so
    // wait on that as the panel's "signed in" signal instead of the
    // permanent drawer.
    await signIn(page, readAdmin());
    await page
      .getByRole("button", { name: /open navigation/i })
      .waitFor({ state: "visible" });

    const token = await fetchAdminAccessToken(browser);

    // Discover one representative id per detail-page family so the spec
    // covers detail views as well as the list routes.
    const detailRoutes: string[] = [];
    for (const probe of DETAIL_PROBES) {
      const res = (await adminApi(token, "GET", probe.listPath)) as {
        items?: unknown[];
      };
      const items = res.items ?? [];
      for (const item of items) {
        const path = probe.detailFrom(item);
        if (path !== null) {
          detailRoutes.push(path);
          break;
        }
      }
    }

    const routes = [...STATIC_ROUTES, ...detailRoutes];
    const failures: string[] = [];
    for (const pathname of routes) {
      const failure = await checkRoute(page, info, pathname, viewportWidth);
      if (failure !== null) failures.push(failure);
    }

    expect(
      failures,
      failures.length === 0
        ? "no routes overflowed the viewport"
        : `Routes wider than the ${viewportWidth} px viewport:\n${failures.join("\n")}`,
    ).toEqual([]);
  });
});
