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

const responsiveRoutes = ["dashboard", "sales", "customer-360", "customer-service", "billing", "orders", "product-pricing", "reports", "administration"]
  .map(hash => desktopRoutes.find(route => route.hash === hash))
  .filter(Boolean);

const tabValidationRoutes = [
  {
    hash: "sales",
    routeName: "sales",
    tabs: [
      { name: "Opportunities", expected: /Opportunity detail|Pipeline records|Search opportunities/i },
      { name: "Accounts", expected: /Customer records|Search accounts|Account Number/i },
      { name: "Custom Pricing", expected: /custom pricing requests|Search custom pricing|Request/i },
      { name: "Approvals", expected: /Quote, pricing, and contract approvals|Search approvals|Requested By/i },
      { name: "Contracts", expected: /Contract files|Search contracts|Contract/i }
    ]
  },
  {
    hash: "product-pricing",
    routeName: "product-pricing",
    tabs: [
      { name: "Hierarchy", expected: /Product Hierarchy|No hierarchy rows/i },
      { name: "Billing Codes", expected: /Billing Codes|No billing codes/i },
      { name: "Billing Elements", expected: /Billing Elements|No billing elements/i },
      { name: "Offers", expected: /Offer positioning|No offers/i },
      { name: "Promotions", expected: /promotion records|No promotions/i },
      { name: "Rate Plans", expected: /Rate Plans|No rate plans/i }
    ]
  },
  {
    hash: "billing",
    routeName: "billing",
    tabs: [
      { name: "Actions", expected: /Invoice Actions|Select an invoice|Workflow actions/i },
      { name: "Adjustments", expected: /Adjustments|No adjustments/i },
      { name: "Customers", expected: /Billing Customers|No billing customers/i }
    ]
  },
  {
    hash: "administration",
    routeName: "administration",
    tabs: [
      { name: "Roles", expected: /Permission groups|Role ID|Create sample role/i },
      { name: "Integrations", expected: /Platform connections|Integration ID|Create sample integration/i },
      { name: "Audit", expected: /System actions|Role updated|Integration synced/i },
      { name: "Settings", expected: /Platform defaults|MFA required|Release mode/i }
    ]
  }
];

const ROUTE_LOAD_TIMEOUT_MS = 12_000;
const SCREENSHOT_SETTLE_MS = Number(process.env.PLAYWRIGHT_SCREENSHOT_SETTLE_MS || 1_000);
const HARD_ERROR_TEXT = /Unable to|failed|timed out/i;
const KNOWN_PARTIAL_DATA_CONSOLE_WARNINGS = [
  "Failed to load resource: the server responded with a status of 404 ()"
];

function routeByHash(hash) {
  return desktopRoutes.find(route => route.hash === hash);
}

function captureConsoleErrors(page) {
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));
  return consoleErrors;
}

function unexpectedConsoleErrors(consoleErrors, allowedWarnings = []) {
  return consoleErrors.filter(message => !allowedWarnings.includes(message));
}

async function attachRouteEvidence(testInfo, page, name, consoleErrors, options = {}) {
  const { fullPage = true, screenshot = true, settleMs = SCREENSHOT_SETTLE_MS } = options;
  await page.waitForTimeout(settleMs);
  const screenshotBody = screenshot ? await page.screenshot({ fullPage }) : null;
  const activeGroup = await page.locator(".topnav-brand-copy span").textContent({ timeout: 500 }).catch(() => "");
  const activeRole = await page.getByLabel("Active permission role").inputValue({ timeout: 500 }).catch(() => "");
  const mainHeading = await page.getByRole("heading", { level: 1 }).first().textContent({ timeout: 500 }).catch(() => "");
  if (screenshotBody) {
    await testInfo.attach(`${name}-screenshot`, {
      body: screenshotBody,
      contentType: "image/png"
    });
  }
  await testInfo.attach(`${name}-route-evidence`, {
    body: JSON.stringify({
      url: page.url(),
      title: await page.title(),
      viewport: page.viewportSize(),
      activeGroup,
      activeRole,
      mainHeading,
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
  await expect(root.locator(".empty-state").filter({ hasText: HARD_ERROR_TEXT })).toHaveCount(0);
  await expect(root.getByText(route.loadedText).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
}

async function openLoadedRoute(page, route, options = {}) {
  await page.goto(`/#/${route.hash}`, { waitUntil: "domcontentloaded" });
  await waitForRenderedContent(page, route, options);
  await assertLoadedRoute(page, route);
}

async function clickTabAndAssert(page, tab) {
  const root = page.locator("#root");
  await root.locator(".record-tabs").getByRole("button", { name: tab.name }).click();
  await expect(root.getByText(tab.expected).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
  await expect(root.locator(".empty-state").filter({ hasText: /^Loading/i })).toHaveCount(0, { timeout: ROUTE_LOAD_TIMEOUT_MS });
  await expect(root.locator(".empty-state").filter({ hasText: HARD_ERROR_TEXT })).toHaveCount(0);
}

test.describe("deployed visual smoke", () => {
  for (const route of desktopRoutes) {
    test(`${route.name} renders loaded deployed preview`, async ({ page }, testInfo) => {
      const consoleErrors = captureConsoleErrors(page);
      const allowedWarnings = route.name === "knowledge" ? KNOWN_PARTIAL_DATA_CONSOLE_WARNINGS : [];

      await openLoadedRoute(page, route);
      await attachRouteEvidence(testInfo, page, `${route.name}-desktop-loaded`, consoleErrors);

      expect(unexpectedConsoleErrors(consoleErrors, allowedWarnings)).toEqual([]);
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

  for (const route of tabValidationRoutes) {
    test(`${route.routeName} tab states render on deployed preview`, async ({ page }, testInfo) => {
      const consoleErrors = captureConsoleErrors(page);

      await openLoadedRoute(page, routeByHash(route.hash));
      for (const tab of route.tabs) {
        await clickTabAndAssert(page, tab);
      }
      await attachRouteEvidence(testInfo, page, `${route.routeName}-tabs-loaded`, consoleErrors);

      expect(consoleErrors).toEqual([]);
    });
  }

  test("sales create modals open on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);
    await openLoadedRoute(page, routeByHash("sales"));

    await page.getByRole("button", { name: /New Lead/i }).click();
    await expect(page.getByRole("dialog").getByText(/New lead/i)).toBeVisible();
    await attachRouteEvidence(testInfo, page, "sales-new-lead-modal-loaded", consoleErrors);
    await page.getByRole("button", { name: /Cancel/i }).click();

    await page.getByRole("button", { name: /New Opportunity/i }).click();
    await expect(page.getByRole("dialog").getByText(/New opportunity/i)).toBeVisible();
    await attachRouteEvidence(testInfo, page, "sales-new-opportunity-modal-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("mobile navigation opens on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);
    const dashboard = routeByHash("dashboard");

    await page.setViewportSize({ width: 390, height: 844 });
    await openLoadedRoute(page, dashboard, { expectDesktopNav: false });

    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
    await attachRouteEvidence(testInfo, page, "mobile-navigation-loaded", consoleErrors, { screenshot: false, settleMs: 0 });

    expect(consoleErrors).toEqual([]);
  });

  test("global search opens on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);
    const dashboard = routeByHash("dashboard");

    await openLoadedRoute(page, dashboard);
    const search = page.getByPlaceholder("Search modules and workspaces").first();
    await expect(search).toBeVisible();
    await search.fill("billing");
    const dialog = page.getByRole("dialog", { name: "Global search" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Billing/i).first()).toBeVisible();
    await attachRouteEvidence(testInfo, page, "global-search-open-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });
});
