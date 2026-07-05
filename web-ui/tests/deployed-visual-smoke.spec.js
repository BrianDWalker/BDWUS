import { expect, test } from "@playwright/test";

const routes = [
  { hash: "dashboard", heading: "Home", name: "dashboard", readyText: /Workday Command Center|Customer Watchlist|No customer records/i },
  { hash: "product-pricing", heading: "Product & Pricing", name: "product-pricing", readyText: /Product Catalog|Pricing|No product/i },
  { hash: "billing", heading: "Billing", name: "billing", readyText: /Invoices|Billing|Adjustments|No billing/i },
  { hash: "reports", heading: "Reports", name: "reports", readyText: /Report Catalog|Report definitions|No report/i },
  { hash: "administration", heading: "Administration", name: "administration", readyText: /Users|Roles|System Settings|No administration/i }
];

async function attachScreenshot(testInfo, page, name) {
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, {
    body: screenshot,
    contentType: "image/png"
  });
}

async function waitForRenderedContent(page, route) {
  await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
  await expect(page.locator("#root > *")).toHaveCount(1);
  await expect(page.locator(".crawler-preview")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByText(/Loading/i)).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByText(route.readyText).first()).toBeVisible({ timeout: 20000 });
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
    await waitForRenderedContent(page, routes[0]);

    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
    await attachScreenshot(testInfo, page, "mobile-navigation-loaded");

    expect(consoleErrors).toEqual([]);
  });
});
