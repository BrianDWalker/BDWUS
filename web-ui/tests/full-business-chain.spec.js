import { expect, test } from "@playwright/test";

const leadId = "lead-1";
const opportunityId = "opp-1";
const quoteId = "quote-1";
const approvalId = "approval-1";
const orderId = "order-1";
const invoiceId = "invoice-1";

function json(body, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function installFullChainMocks(page) {
  const state = {
    lead: {
      LeadId: leadId,
      LeadNumber: "LEAD-1001",
      AccountName: "Apex Health",
      Source: "Website",
      Qualification: "Open",
      Status: "Open",
      ProductInterest: "Fiber 1G",
      EstimatedValue: 25000,
      OwnerName: "Admin"
    },
    opportunities: [],
    quotes: [],
    approvals: [],
    orders: [{ OrderId: orderId, OrderNumber: "ORD-1001", AccountName: "Apex Health", ServiceName: "Fiber 1G", LifecycleStage: "Design", OverallStatus: "Draft", SlaStatus: "On Track", AssignedTeam: "Provisioning Ops" }],
    jobs: [],
    invoiceActions: [],
    adjustments: []
  };
  const calls = [];

  function salesBootstrap() {
    return {
      dashboard: { LeadCount: state.lead.Status === "Converted" ? 0 : 1, OpportunityCount: state.opportunities.length, QuoteCount: state.quotes.length, PendingApprovalCount: state.approvals.filter(row => row.Status === "Pending").length, ContractCount: 0 },
      leads: state.lead.Status === "Converted" ? [] : [state.lead],
      accounts: [{ AccountId: "acct-1", AccountNumber: "ACCT-1001", AccountName: "Apex Health", Segment: "Enterprise", Region: "Midwest", Mrr: 12000, OwnerName: "Admin" }],
      opportunities: state.opportunities,
      quotes: state.quotes,
      approvals: state.approvals,
      contracts: [],
      customPricing: [],
      billingCustomers: [{ CustomerNumber: "CUST-1001", CustomerName: "Apex Health" }],
      billingProducts: [{ ProductId: "prod-1", ProductName: "Fiber 1G", BillingCode: "MRC-FIBER", Category: "Access" }],
      billingProductHierarchy: [],
      billingCodes: [{ BillingCodeId: "code-1", Code: "MRC-FIBER", Description: "Fiber monthly" }],
      billingElements: [],
      offers: [],
      promotions: [],
      ratePlans: []
    };
  }

  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = method === "GET" ? null : request.postDataJSON?.() ?? null;
    calls.push({ method, path, body });

    if (method === "POST" && path === "/api/auth/demo-token") {
      return route.fulfill(json({ token: "test-token", role: "Admin", expiresAt: 4102444800, capabilities: ["*"] }));
    }

    if (method === "GET" && path === "/api/sales/bootstrap") return route.fulfill(json(salesBootstrap()));
    if (method === "POST" && path === `/api/sales/leads/${leadId}/convert`) {
      state.lead = { ...state.lead, Status: "Converted", Qualification: "Converted" };
      const opportunity = { OpportunityId: opportunityId, OpportunityNumber: "OPP-1001", OpportunityName: body?.opportunityName || "Apex Health expansion opportunity", AccountNameResolved: "Apex Health", Stage: "Discovery", EstimatedValue: Number(body?.estimatedValue || 25000), OwnerName: body?.ownerName || "Admin" };
      state.opportunities = [opportunity];
      return route.fulfill(json(opportunity, 201));
    }
    if (method === "POST" && path === "/api/sales/quotes") {
      const quote = { QuoteId: quoteId, QuoteNumber: body?.pricingInput?.quoteNumber || "Q-1001", OpportunityId: opportunityId, AccountName: "Apex Health", OpportunityName: "Apex Health expansion opportunity", TotalMrc: 1200, MarginPct: 32, ApprovalStatus: "Pending", Status: "Draft" };
      state.quotes = [quote];
      state.approvals = [{ ApprovalId: approvalId, EntityId: quoteId, EntityType: "Quote", StepName: "Pricing", Status: "Pending", RequestedBy: "Admin" }];
      return route.fulfill(json(quote, 201));
    }
    if (method === "POST" && path === `/api/sales/approvals/${approvalId}/approve`) {
      state.approvals = state.approvals.map(row => ({ ...row, Status: "Approved" }));
      state.quotes = state.quotes.map(row => ({ ...row, ApprovalStatus: "Approved" }));
      return route.fulfill(json(state.approvals[0]));
    }

    if (method === "GET" && path === "/api/ops/bootstrap") return route.fulfill(json({ orders: state.orders, provisioningJobs: state.jobs, networkEvents: [], carrierSettlements: [] }));
    if (method === "GET" && path === "/api/ops/orders") return route.fulfill(json(state.orders));
    if (method === "POST" && path === "/api/ops/orders") {
      const order = { OrderId: "order-new", OrderNumber: "ORD-NEW", AccountName: body?.accountName || "New Customer", ServiceName: body?.serviceName || "Fiber 1G", LifecycleStage: "Design", OverallStatus: "Draft", SlaStatus: "On Track", AssignedTeam: "Ops" };
      state.orders = [...state.orders, order];
      return route.fulfill(json(order, 201));
    }
    if (method === "PUT" && path === `/api/ops/orders/${orderId}`) {
      state.orders = state.orders.map(row => row.OrderId === orderId ? { ...row, LifecycleStage: body?.lifecycleStage, OverallStatus: body?.overallStatus, SlaStatus: body?.slaStatus || row.SlaStatus } : row);
      return route.fulfill(json(state.orders.find(row => row.OrderId === orderId)));
    }
    if (method === "POST" && path === "/api/ops/provisioning-jobs") {
      const job = { ProvisioningJobId: "job-1", JobNumber: "JOB-NEW", OrderId: body?.orderId, JobType: body?.jobType || "Provisioning", OwnerName: "Provisioning Ops", Status: body?.status || "Queued" };
      state.jobs = [job];
      return route.fulfill(json(job, 201));
    }

    if (method === "GET" && path === "/api/billing/customers") return route.fulfill(json([{ CustomerNumber: "CUST-1001", CustomerName: "Apex Health", CustomerType: "Enterprise", Region: "Midwest", Mrr: 12000, Status: "Active" }]));
    if (method === "GET" && path === "/api/billing-workflows/invoices") return route.fulfill(json([{ InvoiceId: invoiceId, InvoiceNumber: "INV-1001", AccountName: "Apex Health", Amount: 1200, Balance: 300, Status: "Open", DueDate: "2026-07-30" }]));
    if (method === "GET" && path === `/api/billing-workflows/invoices/${invoiceId}`) return route.fulfill(json({ InvoiceId: invoiceId, InvoiceNumber: "INV-1001", AccountName: "Apex Health", Amount: 1200, Balance: 300, Status: "Open" }));
    if (method === "GET" && path === `/api/billing-workflows/invoices/${invoiceId}/actions`) return route.fulfill(json(state.invoiceActions));
    if (method === "POST" && path === `/api/billing-workflows/invoices/${invoiceId}/actions`) {
      const action = { InvoiceActionId: "action-1", ActionType: body?.actionType || "Review", Status: body?.status || "Open", RequestedBy: body?.requestedBy || "Billing Ops", Notes: body?.notes || "Created from billing module" };
      state.invoiceActions = [action];
      return route.fulfill(json(action, 201));
    }
    if (method === "GET" && path === "/api/billing-workflows/adjustments") return route.fulfill(json(state.adjustments));
    if (method === "POST" && path === "/api/billing-workflows/adjustments") {
      const adjustment = { AdjustmentId: "adjustment-1", AdjustmentNumber: "ADJ-NEW", AdjustmentType: body?.adjustmentType || "Credit", Amount: body?.amount || -100, Status: body?.status || "Pending", Reason: body?.reason || "Created from billing module" };
      state.adjustments = [adjustment];
      return route.fulfill(json(adjustment, 201));
    }

    return route.fulfill(json({ message: `Unhandled full-chain route: ${method} ${path}` }, 404));
  });

  return calls;
}

test("lead to billing chain stays connected across modules", async ({ page }) => {
  const calls = await installFullChainMocks(page);

  await page.goto("/#/sales");
  await expect(page.getByRole("heading", { name: "Sales", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "LEAD-1001" })).toBeVisible();

  await page.locator("tr", { hasText: "LEAD-1001" }).getByRole("button", { name: "Convert" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Convert" }).click();
  await expect.poll(() => calls.some(call => call.method === "POST" && call.path === `/api/sales/leads/${leadId}/convert`)).toBeTruthy();

  await page.getByRole("button", { name: "Opportunities" }).click();
  await expect(page.getByRole("cell", { name: "OPP-1001" })).toBeVisible();
  await page.locator("tr", { hasText: "OPP-1001" }).getByRole("button", { name: "Create Quote" }).click();
  await page.getByLabel("Quote Number").fill("Q-1001");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/sales/quotes")).toBeTruthy();

  await page.getByRole("button", { name: "Approvals" }).click();
  await expect(page.getByRole("cell", { name: "Pending" }).first()).toBeVisible();
  await page.locator("tr", { hasText: "Pricing" }).getByRole("button", { name: "Approve" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expect.poll(() => calls.some(call => call.method === "POST" && call.path === `/api/sales/approvals/${approvalId}/approve`)).toBeTruthy();

  await page.goto("/#/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await page.getByRole("button", { name: "New Order" }).click();
  await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/ops/orders")).toBeTruthy();
  await page.getByRole("button", { name: "Provision" }).first().click();
  await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/ops/provisioning-jobs")).toBeTruthy();

  await page.goto("/#/billing");
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("button", { name: "Create sample action" }).click();
  await expect.poll(() => calls.some(call => call.method === "POST" && call.path === `/api/billing-workflows/invoices/${invoiceId}/actions`)).toBeTruthy();
  await page.getByRole("button", { name: "Adjustments" }).click();
  await page.getByRole("button", { name: "Create sample adjustment" }).click();
  await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/billing-workflows/adjustments")).toBeTruthy();

  expect(calls.map(call => `${call.method} ${call.path}`)).toEqual(expect.arrayContaining([
    `POST /api/sales/leads/${leadId}/convert`,
    "POST /api/sales/quotes",
    `POST /api/sales/approvals/${approvalId}/approve`,
    "POST /api/ops/orders",
    "POST /api/ops/provisioning-jobs",
    `POST /api/billing-workflows/invoices/${invoiceId}/actions`,
    "POST /api/billing-workflows/adjustments"
  ]));
});
