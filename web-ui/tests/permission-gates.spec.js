import { expect, test } from "@playwright/test";

async function mockApi(page) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = {};
    if (path === "/api/billing/customers") {
      body = [{ CustomerNumber: "CUST-1001", CustomerName: "Apex Health", CustomerType: "Enterprise", Region: "Midwest", Mrr: 1000, Status: "Active" }];
    } else if (path === "/api/billing-workflows/invoices") {
      body = [{ InvoiceId: "invoice-1", InvoiceNumber: "INV-1001", AccountName: "Apex Health", Amount: 1000, Balance: 100, Status: "Open" }];
    } else if (path === "/api/billing-workflows/adjustments") {
      body = [];
    } else if (path === "/api/billing-workflows/invoices/invoice-1") {
      body = { InvoiceId: "invoice-1", InvoiceNumber: "INV-1001", AccountName: "Apex Health", Amount: 1000, Balance: 100, Status: "Open" };
    } else if (path === "/api/billing-workflows/invoices/invoice-1/actions") {
      body = [];
    } else if (path === "/api/platform/customer-service/tickets/ticket-1") {
      body = { ticket: { TicketId: "ticket-1", TicketNumber: "TKT-1001", AccountName: "Apex Health", Status: "Open", Priority: "High", OwnerName: "Care Ops", IssueType: "Billing question" }, notes: [] };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("care role cannot create billing adjustments", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("bdwus.role", "Care"));
  await mockApi(page);
  await page.goto("/#/billing");
  await page.getByRole("button", { name: "Adjustments" }).click();
  await expect(page.getByRole("button", { name: "Create sample adjustment" })).toBeDisabled();
});

test("billing role cannot close care tickets", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("bdwus.role", "Billing"));
  await mockApi(page);
  await page.goto("/#/details/ticket/ticket-1");
  await expect(page.getByRole("heading", { name: "TKT-1001" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close Ticket" })).toBeDisabled();
});
