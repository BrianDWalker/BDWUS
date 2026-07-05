import { expect, test } from "@playwright/test";

const routes = [
  { hash: "dashboard", heading: "Home", name: "dashboard", loadedText: /Workday Command Center|Customer Watchlist|No customer records/i },
  { hash: "product-pricing", heading: "Product & Pricing", name: "product-pricing", loadedText: /Catalog records|Billing product records|No products returned/i },
  { hash: "billing", heading: "Billing", name: "billing", loadedText: /Workflow rows|Invoices from \/api\/billing-workflows\/invoices|No invoices returned/i },
  { hash: "reports", heading: "Reports", name: "reports", loadedText: /Result set|Current report results returned|No rows match/i },
  { hash: "administration", heading: "Administration", name: "administration", loadedText: /Licensed accounts|Operational user accounts|Invite user/i }
];

const ROUTE_LOAD_TIMEOUT_MS = 12_000;

async function attachScreenshot(testInfo, page, name) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, {
    body: screenshot,
    contentType: "image/png"
  });
}

async function waitForRenderedContent(page, route, { expectDesktopNav = true } = {}) {
  const root = page.locator("#root");
  await expect(root.getByRole("heading", { name: route.heading }).first()).toBeVisible();
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
  await expect(root.getByText(route.loadedText).first()).toBeVisible({ timeout: 1_000 });
}

test.describe("deployed visual smoke", () => {
  for (const route of routes) {
    test(`${route.name} renders loaded deployed preview`, async ({ page }, testInfo) => {
      const consoleErrors = [];
      page.on("console", message => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", error => consoleErrors.push(error.message));

      await page.goto(`/#/${route.hash}`, { waitUntil: "domcontentloaded" });
      await waitForRenderedContent(page, route);
      await attachScreenshot(testInfo, page, `${route.name}-desktop-loaded`);
      await assertLoadedRoute(page, route);

      expect(consoleErrors).toEqual([]);
    });
  }

  test("mobile navigation opens on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = [];
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", error => consoleErrors.push(error.message));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#/dashboard", { waitUntil: "domcontentloaded" });
    await waitForRenderedContent(page, routes[0], { expectDesktopNav: false });

    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
    await attachScreenshot(testInfo, page, "mobile-navigation-loaded");
    await assertLoadedRoute(page, routes[0]);

    expect(consoleErrors).toEqual([]);
  });
});
