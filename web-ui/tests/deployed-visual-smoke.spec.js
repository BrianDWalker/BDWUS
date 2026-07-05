import { expect, test } from "@playwright/test";

const desktopRoutes = [
  { hash: "dashboard", heading: "Home", name: "dashboard", loadedText: /Workday Command Center|Customer Watchlist|No customer records/i },
  { hash: "knowledge", heading: "Knowledge", name: "knowledge", loadedText: /Knowledge Search|Topic Coverage|Knowledge Assistant/i },
  { hash: "sales", heading: "Sales", name: "sales", loadedText: /Leads|Opportunities|SQL-backed records|Sales sync status/i },
  { hash: "customer-360", heading: "Customer 360", name: "customer-360", loadedText: /Commercial Records|Locations|No customers returned/i },
  { hash: "customer-service", heading: "Customer Service", name: "customer-service", loadedText: /Support tickets|Customer-reported network issues|No support tickets/i },
  { hash: "orders", heading: "Orders", name: "orders", loadedText: /Provisioning Jobs|Delivery queue|No orders returned/i },
  { hash: "product-pricing", heading: "Product & Pricing", name: "product-pricing", loadedText: /Catalog records|Billing product records|No products returned/i },
  { hash: "billing", heading: "Billing", name: "billing", loadedText: /Workflow rows|Invoices from \/api\/billing-workflows\/invoices|No invoices returned/i },
  { hash: "network", heading: "Network Events", name: "network", loadedText: /Network Events|Operational incidents|No network events/i },
  { hash: "service-management", heading: "Service Management", name: "service-management", loadedText: /Network Events|Provisioning Jobs|Operational incidents/i },
  { hash: "provisioning", heading: "Provisioning", name: "provisioning", loadedText: /Provisioning Jobs|Activation queue|No provisioning jobs/i },
  { hash: "carrier-settlement", heading: "Carrier Settlement", name: "carrier-settlement", loadedText: /Carrier Settlement|Settlement amount|No carrier settlement/i },
  { hash: "reports", heading: "Reports", name: "reports", loadedText: /Result set|Current report results returned|No rows match/i },
  { hash: "administration", heading: "Administration", name: "administration", loadedText: /Licensed accounts|Operational user accounts|Invite user/i }
];

const responsiveRoutes = ["dashboard", "sales", "customer-service", "orders"]
  .map(hash => desktopRoutes.find(route => route.hash === hash))
  .filter(Boolean);

const ROUTE_LOAD_TIMEOUT_MS = 12_000;
const SCREENSHOT_SETTLE_MS = Number(process.env.PLAYWRIGHT_SCREENSHOT_SETTLE_MS || 1_000);

function captureConsoleErrors(page) {
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));
  return consoleErrors;
}

async function attachRouteEvidence(testInfo, page, name, consoleErrors) {
  await page.waitForTimeout(SCREENSHOT_SETTLE_MS);
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${name}-screenshot`, {
    body: screenshot,
    contentType: "image/png"
  });
  await testInfo.attach(`${name}-route-evidence`, {
    body: JSON.stringify({
      url: page.url(),
      title: await page.title(),
      viewport: page.viewportSize(),
      consoleErrors
    }, null, 2),
    contentType: "application/json"
  });
}

async function waitForRenderedContent(page, route, { expectDesktopNav = true } = {}) {
  const root = page.locator("#root");
  await expect(root.getByRole("heading", { name: route.heading }).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
  await expect(root.locator("> *")).toHaveCount(1);
  await expect(page.locator(".crawler-preview")).toBeHidden();
  if (expectDesktopNav) {
    await expect(root.getByRole("navigation", { name: "Primary" })).toBeVisible();
  }
  await expect(root.locator(".empty-state").filter({ hasText: /^Loading/i })).toHaveCount(0, { timeout: ROUTE_LOAD_TIMEOUT_MS });
}

async function assertLoadedRoute(page, route) {
  const root = page.locator("#root");
  await expect(root.locator(".empty-state").filter({ hasText: /Unable to|failed|timed out|returned no data/i })).toHaveCount(0);
  await expect(root.getByText(route.loadedText).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
}

async function openLoadedRoute(page, route, options = {}) {
  await page.goto(`/#/${route.hash}`, { waitUntil: "domcontentloaded" });
  await waitForRenderedContent(page, route, options);
  await assertLoadedRoute(page, route);
}

test.describe("deployed visual smoke", () => {
  for (const route of desktopRoutes) {
    test(`${route.name} renders loaded deployed preview`, async ({ page }, testInfo) => {
      const consoleErrors = captureConsoleErrors(page);

      await openLoadedRoute(page, route);
      await attachRouteEvidence(testInfo, page, `${route.name}-desktop-loaded`, consoleErrors);

      expect(consoleErrors).toEqual([]);
    });
  }

  for (const route of responsiveRoutes) {
    test(`${route.name} renders loaded tablet preview`, async ({ page }, testInfo) => {
      const consoleErrors = captureConsoleErrors(page);
      await page.setViewportSize({ width: 834, height: 1112 });

      await openLoadedRoute(page, route);
      await attachRouteEvidence(testInfo, page, `${route.name}-tablet-loaded`, consoleErrors);

      expect(consoleErrors).toEqual([]);
    });
  }

  test("mobile navigation opens on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);
    const dashboard = desktopRoutes.find(route => route.hash === "dashboard");

    await page.setViewportSize({ width: 390, height: 844 });
    await openLoadedRoute(page, dashboard, { expectDesktopNav: false });

    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
    await attachRouteEvidence(testInfo, page, "mobile-navigation-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("global search opens and navigates on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);
    const dashboard = desktopRoutes.find(route => route.hash === "dashboard");
    const billing = desktopRoutes.find(route => route.hash === "billing");

    await openLoadedRoute(page, dashboard);
    const search = page.getByPlaceholder("Search modules and workspaces").first();
    await expect(search).toBeVisible();
    await search.fill("billing");
    await expect(page.getByRole("dialog", { name: "Global search" })).toBeVisible();
    await page.getByRole("button", { name: /Billing/i }).first().click();

    await waitForRenderedContent(page, billing);
    await assertLoadedRoute(page, billing);
    await attachRouteEvidence(testInfo, page, "global-search-billing-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });
});
