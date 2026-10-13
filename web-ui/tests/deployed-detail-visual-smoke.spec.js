import { expect, test } from "@playwright/test";

const ROUTE_LOAD_TIMEOUT_MS = 15_000;
const SCREENSHOT_SETTLE_MS = Number(process.env.PLAYWRIGHT_SCREENSHOT_SETTLE_MS || 1_000);
const HARD_ERROR_TEXT = /Unable to|failed|timed out/i;

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

async function waitForShell(page) {
  const root = page.locator("#root");
  await expect(root.locator("> *")).toHaveCount(1);
  await expect(page.locator(".crawler-preview")).toBeHidden();
  await expect(root.getByRole("navigation", { name: "Primary" })).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
  await expect(root.locator(".empty-state").filter({ hasText: /^Loading/i })).toHaveCount(0, { timeout: ROUTE_LOAD_TIMEOUT_MS });
}

async function assertNoHardError(page) {
  await expect(page.locator("#root").locator(".empty-state").filter({ hasText: HARD_ERROR_TEXT })).toHaveCount(0);
}

async function openRoute(page, hash, heading) {
  await page.goto(`/#/${hash}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root").getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
  await waitForShell(page);
  await assertNoHardError(page);
}

async function assertDetailRoute(page, detailType, detailHeading) {
  await expect(page).toHaveURL(new RegExp(`#\\/details\\/${detailType}\\/[^/]+$`), { timeout: ROUTE_LOAD_TIMEOUT_MS });
  await expect(page.locator("#root").getByRole("heading", { name: detailHeading }).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
  await waitForShell(page);
  await assertNoHardError(page);
}

async function clickTab(page, name, expectedText) {
  const root = page.locator("#root");
  await root.locator(".record-tabs").getByRole("button", { name }).click();
  await expect(root.getByText(expectedText).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
}

test.describe("deployed detail visual smoke", () => {
  test("ticket detail opens from customer service on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "customer-service", "Customer Service");
    await page.locator(".panel").filter({ hasText: "Support tickets" }).getByRole("button", { name: "Details" }).first().click();
    await assertDetailRoute(page, "ticket", /TKT-|Ticket/i);
    await attachRouteEvidence(testInfo, page, "ticket-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("network event detail opens from customer service on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "customer-service", "Customer Service");
    await page.locator(".outage-card").first().click();
    await assertDetailRoute(page, "network", /NE-|Network Event/i);
    await attachRouteEvidence(testInfo, page, "network-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("admin record detail opens from administration on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "administration", "Administration");
    await page.locator(".panel").filter({ hasText: "Users" }).getByRole("button", { name: "View" }).first().click();
    await assertDetailRoute(page, "record", /Record Detail/i);
    await attachRouteEvidence(testInfo, page, "admin-record-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("customer detail opens from customer 360 on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "customer-360", "Customer 360");
    await page.getByRole("button", { name: "Open Detail" }).click();
    await assertDetailRoute(page, "customer", /Apex Health|Customer 360/i);
    await expect(page.locator("#root").getByText(/Customer profile|Account profile|Service locations/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await attachRouteEvidence(testInfo, page, "customer-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("invoice detail opens from billing on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "billing", "Billing");
    await page.locator(".panel").filter({ hasText: "Invoices" }).getByRole("button", { name: "Details" }).first().click();
    await assertDetailRoute(page, "invoice", /Invoice INV-1001|Billing/i);
    await expect(page.locator("#root").getByText(/Invoice summary|Payment info|Invoice actions/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await attachRouteEvidence(testInfo, page, "invoice-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("order detail opens from orders on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "orders", "Orders");
    await page.locator(".panel").filter({ hasText: "Orders returned" }).getByRole("button", { name: "Details" }).first().click();
    await assertDetailRoute(page, "order", /ORD-1001|Orders/i);
    await expect(page.locator("#root").getByText(/Order summary|Task summary|Provisioning jobs/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await attachRouteEvidence(testInfo, page, "order-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("product detail opens from product pricing on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "product-pricing", "Product & Pricing");
    await page.locator(".panel").filter({ hasText: "Products" }).getByRole("button", { name: "Details" }).first().click();
    await assertDetailRoute(page, "product", /Fiber 1G|Product & Pricing/i);
    await expect(page.locator("#root").getByText(/Product summary|Pricing profile|Rate plans/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await attachRouteEvidence(testInfo, page, "product-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("sales lead detail opens from sales on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "sales", "Sales");
    await page.locator(".panel").filter({ hasText: "Lead qualification" }).getByRole("button", { name: "Open" }).first().click();
    await assertDetailRoute(page, "lead", /.+/);
    await expect(page.locator("#root").getByText(/Lead overview|Qualification/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await attachRouteEvidence(testInfo, page, "sales-lead-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("sales opportunity detail opens from sales contracts on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "sales", "Sales");
    await clickTab(page, "Contracts", /Contract files/i);
    await page.getByRole("button", { name: "Open Opportunity" }).first().click();
    await assertDetailRoute(page, "opportunity", /.+/);
    await expect(page.locator("#root").getByText(/Opportunity overview|Product hierarchy/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await attachRouteEvidence(testInfo, page, "sales-opportunity-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("sales quote detail opens from sales contracts on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "sales", "Sales");
    await clickTab(page, "Contracts", /Contract files/i);
    await page.getByRole("button", { name: "Open Quote" }).first().click();
    await assertDetailRoute(page, "quote", /.+/);
    await expect(page.locator("#root").getByText(/Quote summary|Line items|Pricing/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await attachRouteEvidence(testInfo, page, "sales-quote-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });

  test("sales contract detail opens from sales on deployed preview", async ({ page }, testInfo) => {
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "sales", "Sales");
    await clickTab(page, "Contracts", /Contract files/i);
    await page.getByRole("button", { name: "Open Contract" }).first().click();
    await assertDetailRoute(page, "contract", /.+/);
    await expect(page.locator("#root").getByText(/Contract overview|Contract files|Contract history/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await attachRouteEvidence(testInfo, page, "sales-contract-detail-loaded", consoleErrors);

    expect(consoleErrors).toEqual([]);
  });
});
