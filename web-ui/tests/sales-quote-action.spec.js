import { expect, test } from "@playwright/test";

async function mockSalesApis(page) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let body = {};

    if (path === "/api/auth/me") {
      body = { role: "Sales" };
    } else if (method === "POST" && path === "/api/auth/demo-token") {
      body = { token: "test-token", role: "Sales", expiresAt: 4102444800, capabilities: ["create:quote", "create:order"] };
    } else if (method === "POST" && path === "/api/sales/quotes/quote-1/convert-to-order") {
      body = {
        order: { OrderId: "order-1", OrderNumber: "ORD-1001", AccountName: "Apex Health", ServiceName: "Fiber 1G" },
        source: { QuoteId: "quote-1", QuoteNumber: "Q-1001", ApprovalStatus: "Approved" }
      };
    } else if (path === "/api/sales/quotes/quote-1") {
      body = { QuoteId: "quote-1", QuoteNumber: "Q-1001", OpportunityId: "opp-1", AccountName: "Apex Health", OpportunityName: "Fiber Expansion", TotalMrc: 1200, TotalNrc: 500, MarginPct: 35, ApprovalStatus: "Approved", Status: "Approved" };
    } else if (path === "/api/sales/quotes/quote-1/line-items") {
      body = [{ QuoteLineItemId: "line-1", ProductName: "Fiber 1G", Quantity: 1, Mrc: 1200, Nrc: 500, BillingCode: "MRC-FIBER" }];
    } else if (path === "/api/sales/approvals") {
      body = [];
    } else if (path === "/api/sales/contracts") {
      body = [];
    } else if (path === "/api/sales/bootstrap") {
      body = { dashboard: {}, leads: [], accounts: [], opportunities: [], quotes: [], approvals: [], contracts: [] };
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("quote detail exposes create order action", async ({ page }) => {
  await mockSalesApis(page);
  await page.goto("/#/details/quote/quote-1");
  await expect(page.getByRole("button", { name: "Create Order from Quote" })).toBeVisible();
  await page.getByRole("button", { name: "Create Order from Quote" }).click();
  await expect(page).toHaveURL(/#\/orders/);
});

test("quote header Create Order modal saves before navigating", async ({ page }) => {
  await mockSalesApis(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: { role: "Admin" } }));
  let saved = 0;
  await page.route("**/api/sales/quotes/quote-1/convert-to-order", async route => {
    saved += 1;
    await route.fulfill({ json: { order: { OrderId: "order-1" } } });
  });
  await page.goto("/#/details/quote/quote-1");
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/#\/orders/);
  expect(saved).toBe(1);
});

test("failed order save stays in modal with retry", async ({ page }) => {
  await mockSalesApis(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: { role: "Admin" } }));
  await page.route("**/api/sales/quotes/quote-1/convert-to-order", route => route.fulfill({ status: 503, json: { detail: "Please retry later" } }));
  await page.goto("/#/details/quote/quote-1");
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/#\/details\/quote/);
  await expect(page.getByRole("button", { name: "Create", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});


test("saving an order disables cancel and close until the result arrives", async ({ page }) => {
  await mockSalesApis(page);
  await page.route("**/api/auth/me", route => route.fulfill({ json: { role: "Admin" } }));
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  await page.route("**/api/sales/quotes/quote-1/convert-to-order", async route => {
    await pending;
    await route.fulfill({ json: { order: { OrderId: "order-1" } } });
  });
  await page.goto("/#/details/quote/quote-1");
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create order", exact: true });
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "x", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
  finish();
  await expect(page).toHaveURL(/#\/orders/);
});
