import { expect, test } from "@playwright/test";

const routes = [
  { hash: "dashboard", heading: "Home", name: "dashboard" },
  { hash: "product-pricing", heading: "Product & Pricing", name: "product-pricing" },
  { hash: "billing", heading: "Billing", name: "billing" },
  { hash: "reports", heading: "Reports", name: "reports" },
  { hash: "administration", heading: "Administration", name: "administration" }
];

async function attachScreenshot(testInfo, page, name) {
  const screenshot = await page.screenshot({ fullPage: false });
  await testInfo.attach(name, {
    body: screenshot,
    contentType: "image/png"
  });
}

test.describe("deployed visual smoke", () => {
  for (const route of routes) {
    test(`${route.name} renders in deployed preview`, async ({ page }, testInfo) => {
      const consoleErrors = [];
      page.on("console", message => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", error => consoleErrors.push(error.message));

      await page.goto(`/#/${route.hash}`);
      await expect(page.getByRole("heading", { name: route.heading }).first()).toBeVisible();
      await expect(page.locator("#root > *")).toHaveCount(1);
      await expect(page.locator(".crawler-preview")).toBeHidden();
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
      await attachScreenshot(testInfo, page, `${route.name}-desktop`);

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
    await page.goto("/#/dashboard");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
    await attachScreenshot(testInfo, page, "mobile-navigation");

    expect(consoleErrors).toEqual([]);
  });
});
