import { expect, test } from "@playwright/test";

async function mockCare(page) {
  const ticket = { TicketId: "ticket-1", TicketNumber: "TKT-1001", AccountName: "Apex Health", IssueType: "Billing question", Category: "Billing", Priority: "High", Status: "Open", AgeHours: 2, OwnerName: "Care Ops", Summary: "Billing question." };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path === "/api/platform/customer-service/tickets/ticket-1") {
      body = { ticket, notes: [{ NoteType: "Created", Note: "Initial context", CreatedBy: "Care Ops" }] };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function mockBilling(page) {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body = [];
    if (path === "/api/billing/customers") body = [{ CustomerNumber: "CUST-1001", CustomerName: "Apex Health", Status: "Active" }];
    if (path === "/api/billing-workflows/invoices") body = [{ InvoiceId: "invoice-1", InvoiceNumber: "INV-1001", AccountName: "Apex Health", Amount: 100, Balance: 50, Status: "Open" }];
    if (path === "/api/billing-workflows/adjustments") body = [];
    if (path === "/api/billing-workflows/invoices/invoice-1") body = { InvoiceId: "invoice-1", InvoiceNumber: "INV-1001", AccountName: "Apex Health", Amount: 100, Balance: 50, Status: "Open" };
    if (path === "/api/billing-workflows/invoices/invoice-1/actions") body = [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function mockOrders(page) {
  const orders = [{ OrderId: "order-1", OrderNumber: "ORD-1001", AccountName: "Apex Health", ServiceName: "Fiber 1G", LifecycleStage: "Design", OverallStatus: "Draft", SlaStatus: "On Track", AssignedTeam: "Provisioning Ops" }];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path === "/api/ops/bootstrap") body = { orders, provisioningJobs: [] };
    if (path === "/api/ops/orders") body = orders;
    if (path === "/api/ops/provisioning-jobs") body = [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function mockQuote(page) {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body = {};
    if (path === "/api/sales/quotes/quote-1") body = { QuoteId: "quote-1", QuoteNumber: "Q-1001", OpportunityId: "opp-1", AccountName: "Apex Health", OpportunityName: "Fiber Expansion", TotalMrc: 1200, TotalNrc: 500, MarginPct: 35, ApprovalStatus: "Approved", Status: "Approved" };
    if (path === "/api/sales/quotes/quote-1/line-items") body = [{ QuoteLineItemId: "line-1", ProductName: "Fiber 1G", Quantity: 1, Mrc: 1200, Nrc: 500 }];
    if (path === "/api/sales/approvals") body = [];
    if (path === "/api/sales/contracts") body = [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("role selector controls care ticket actions", async ({ page }) => {
  await mockCare(page);
  await page.goto("/#/details/ticket/ticket-1");
  await page.getByLabel("Active permission role").selectOption("Viewer");
  await expect(page.getByRole("button", { name: "Close Ticket" })).toBeDisabled();
  await page.getByLabel("Active permission role").selectOption("Billing");
  await expect(page.getByRole("button", { name: "Close Ticket" })).toBeDisabled();
  await page.getByLabel("Active permission role").selectOption("Care");
  await expect(page.getByRole("button", { name: "Close Ticket" })).toBeEnabled();
});

test("role selector controls billing adjustment action", async ({ page }) => {
  await mockBilling(page);
  await page.goto("/#/billing");
  await page.getByRole("button", { name: "Adjustments" }).click();
  await page.getByLabel("Active permission role").selectOption("Viewer");
  await expect(page.getByRole("button", { name: "Create sample adjustment" })).toBeDisabled();
  await page.getByLabel("Active permission role").selectOption("Care");
  await expect(page.getByRole("button", { name: "Create sample adjustment" })).toBeDisabled();
  await page.getByLabel("Active permission role").selectOption("Billing");
  await expect(page.getByRole("button", { name: "Create sample adjustment" })).toBeEnabled();
});

test("role selector controls order and provisioning actions", async ({ page }) => {
  await mockOrders(page);
  await page.goto("/#/orders");
  await page.getByLabel("Active permission role").selectOption("Viewer");
  await expect(page.getByRole("button", { name: "New Order" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Provision" }).first()).toBeDisabled();
  await page.getByLabel("Active permission role").selectOption("Billing");
  await expect(page.getByRole("button", { name: "New Order" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Provision" }).first()).toBeDisabled();
  await page.getByLabel("Active permission role").selectOption("Ops");
  await expect(page.getByRole("button", { name: "Provision" }).first()).toBeEnabled();
});

test("role selector controls quote to order action", async ({ page }) => {
  await mockQuote(page);
  await page.goto("/#/details/quote/quote-1");
  await page.getByLabel("Active permission role").selectOption("Viewer");
  await expect(page.getByRole("button", { name: "Create Order from Quote" })).toBeDisabled();
  await page.getByLabel("Active permission role").selectOption("Care");
  await expect(page.getByRole("button", { name: "Create Order from Quote" })).toBeDisabled();
  await page.getByLabel("Active permission role").selectOption("Sales");
  await expect(page.getByRole("button", { name: "Create Order from Quote" })).toBeEnabled();
});
