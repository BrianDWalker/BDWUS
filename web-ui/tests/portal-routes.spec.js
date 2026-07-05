import { expect, test } from "@playwright/test";

const customers = [
  { CustomerNumber: "CUST-1001", CustomerName: "Apex Health", CustomerType: "Enterprise", Region: "Midwest", Mrr: 1480000, Status: "Active", CreditRating: 88 }
];

const products = [
  { ProductId: "prod-1", ProductCode: "FIBER-1G", ProductName: "Fiber 1G", Category: "Access", ServiceCategory: "Fiber", BillingCode: "MRC-FIBER", BaseMrc: 1200, BaseNrc: 500, Status: "Active" }
];

const opsBootstrap = {
  orders: [{ OrderId: "order-1", OrderNumber: "ORD-1001", AccountName: "Apex Health", ServiceName: "Fiber 1G", LifecycleStage: "Design", OverallStatus: "Draft", SlaStatus: "On Track", AssignedTeam: "Provisioning Ops" }],
  networkEvents: [{ EventId: "event-1", EventNumber: "NE-1001", Market: "Midwest", Type: "Capacity", Impacted: "Backbone", Severity: "Major", Status: "Open", SlaExposure: 25000 }],
  provisioningJobs: [{ ProvisioningJobId: "job-1", JobNumber: "JOB-1001", JobType: "Activation", OwnerName: "Provisioning Ops", Status: "Queued" }],
  settlements: [{ SettlementId: "set-1", SettlementNumber: "SET-1001", PartnerName: "Carrier One", BillingPeriod: "May 2026", ExposureAmount: 1000, Status: "Open", ClaimType: "Dispute" }]
};

const invoices = [
  { InvoiceId: "invoice-1", InvoiceNumber: "INV-1001", AccountName: "Apex Health", Amount: 10000, Balance: 2500, Status: "Open", DueDate: "2026-06-01" }
];

async function mockApi(page) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let body;

    if (method !== "GET") {
      body = { id: "created", status: "ok" };
    } else if (path === "/api/platform/reports/definitions") {
      body = [{ id: "executive-scorecard", name: "Executive scorecard", area: "Executive", description: "Pipeline and revenue." }];
    } else if (path === "/api/platform/reports/executive-scorecard") {
      body = { definition: { id: "executive-scorecard", name: "Executive scorecard", area: "Executive", description: "Pipeline and revenue." }, rows: [{ account: "Apex Health", region: "Midwest", segment: "Enterprise", service: "Fiber 1G", amount: 10000, metric: "42", status: "Open" }] };
    } else if (path === "/api/platform/administration/summary") {
      body = { controls: { pendingApprovals: 2 }, platform: { environment: "test", serviceName: "BDWUS Platform API" } };
    } else if (path === "/api/admin/users") {
      body = [{ UserId: "user-1", UserNumber: "USR-1001", UserName: "Rhea Patel", RoleName: "Sales Manager", Status: "Active" }];
    } else if (path === "/api/admin/roles") {
      body = [{ RoleId: "role-1", RoleNumber: "ROLE-1", RoleName: "Sales Manager", PermissionsJson: "[]", Status: "Active" }];
    } else if (path === "/api/admin/integrations") {
      body = [{ IntegrationId: "int-1", IntegrationNumber: "INT-1", IntegrationName: "CRM Sync", Detail: "Customer sync", OwnerName: "Platform", Status: "Connected" }];
    } else if (path === "/api/platform/product-pricing/overview") {
      body = { summary: { productCount: 1, serviceCount: 1, offerCount: 1, ratePlanCount: 1 }, products, services: [{ ServiceId: "svc-1", ServiceName: "Fiber" }] };
    } else if (path === "/api/billing/products") {
      body = products;
    } else if (path === "/api/billing/product-hierarchy") {
      body = [{ ProductHierarchyId: "hier-1", ProductName: "Fiber 1G", HierarchyPath: "Access/Fiber", BillingCode: "MRC-FIBER", DisplayOrder: 1 }];
    } else if (path === "/api/billing/billing-codes") {
      body = [{ BillingCodeId: "code-1", Code: "MRC-FIBER", Description: "Fiber monthly", BillingType: "Recurring" }];
    } else if (path === "/api/billing/billing-elements") {
      body = [{ BillingElementId: "elem-1", ElementName: "Monthly charge", ElementType: "Recurring", Amount: 1200 }];
    } else if (path === "/api/billing/offers") {
      body = [{ OfferId: "offer-1", OfferCode: "OFFER-1", OfferName: "Fiber launch", OfferType: "Discount", Eligibility: "Enterprise", Status: "Active" }];
    } else if (path === "/api/billing/promotions") {
      body = [{ PromotionId: "promo-1", PromotionCode: "PROMO-1", PromotionName: "Install credit", PromotionType: "Credit", DiscountPct: 10, Status: "Active" }];
    } else if (path === "/api/billing/rate-plans") {
      body = [{ RatePlanId: "rate-1", PlanCode: "PLAN-1", PlanName: "Fiber Standard", PlanTier: "Standard", BillingFrequency: "Monthly", MonthlyBaseFee: 1200, MinimumCommitment: 0 }];
    } else if (path === "/api/billing/customers") {
      body = customers;
    } else if (path === "/api/billing/customers/CUST-1001") {
      body = customers[0];
    } else if (path === "/api/platform/customer-360/CUST-1001") {
      body = { customer: { ...customers[0], Segment: "Enterprise", SupportTier: "Gold", PrimaryContact: "Mara Ellis", BillingProfile: "Net 30" }, accounts: [], serviceLocations: [{ ServiceLocationId: "loc-1", LocationName: "HQ", City: "Chicago", StateProvince: "IL", ServiceabilityType: "On-net", Status: "Active" }], opportunities: [], quotes: [], contracts: [] };
    } else if (path === "/api/billing-workflows/invoices") {
      body = invoices;
    } else if (path === "/api/billing-workflows/invoices/invoice-1") {
      body = invoices[0];
    } else if (path === "/api/billing-workflows/invoices/invoice-1/actions") {
      body = [{ InvoiceActionId: "action-1", ActionType: "Review", Status: "Open", RequestedBy: "Billing Ops", Notes: "Review", CreatedAtUtc: "2026-05-01T00:00:00Z" }];
    } else if (path === "/api/billing-workflows/adjustments") {
      body = [{ AdjustmentId: "adj-1", AdjustmentNumber: "ADJ-1001", AdjustmentType: "Credit", Amount: -100, Status: "Pending", Reason: "Credit" }];
    } else if (path === "/api/ops/bootstrap") {
      body = opsBootstrap;
    } else if (path === "/api/ops/orders") {
      body = opsBootstrap.orders;
    } else if (path === "/api/ops/network-events") {
      body = opsBootstrap.networkEvents;
    } else if (path === "/api/ops/provisioning-jobs") {
      body = opsBootstrap.provisioningJobs;
    } else if (path === "/api/ops/carrier-settlement") {
      body = opsBootstrap.settlements;
    } else {
      body = {};
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

for (const [hash, heading] of [
  ["reports", "Reports"],
  ["administration", "Administration"],
  ["product-pricing", "Product & Pricing"],
  ["customer-360", "Customer 360"],
  ["billing", "Billing"],
  ["orders", "Orders"],
  ["network", "Network Events"],
  ["service-management", "Service Management"],
  ["provisioning", "Provisioning"],
  ["carrier-settlement", "Carrier Settlement"]
]) {
  test(`${hash} renders without console errors`, async ({ page }) => {
    const consoleErrors = [];
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", error => consoleErrors.push(error.message));

    await mockApi(page);
    await page.goto(`/#/${hash}`);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(page.locator(".empty-state").filter({ hasText: /Unable to|failed/i })).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });
}
