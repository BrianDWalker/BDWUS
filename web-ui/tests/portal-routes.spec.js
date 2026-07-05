import { expect, test } from "@playwright/test";

const customers = [
  { CustomerNumber: "CUST-1001", CustomerName: "Apex Health", CustomerType: "Enterprise", Region: "Midwest", Mrr: 1480000, Status: "Active", CreditRating: 88 }
];

const products = [
  { ProductId: "prod-1", ProductCode: "FIBER-1G", ProductName: "Fiber 1G", Category: "Access", ServiceCategory: "Fiber", BillingCode: "MRC-FIBER", BaseMrc: 1200, BaseNrc: 500, Status: "Active" }
];

const salesBootstrap = {
  dashboard: { PipelineValue: 10000, QuoteMrcValue: 1200, OpportunityCount: 1, QuoteCount: 1 },
  leads: [{ LeadId: "lead-1", LeadNumber: "LEAD-1001", AccountName: "Apex Health", Source: "Website", Qualification: "Open", Status: "Open", EstimatedValue: 10000, OwnerName: "Rhea Patel", ProductInterest: "Fiber 1G", ServiceNeedsJson: ["Fiber 1G"], CustomerNumber: "CUST-1001" }],
  accounts: [{ AccountId: "account-1", AccountNumber: "ACC-1001", AccountName: "Apex Health", Segment: "Enterprise", Region: "Midwest", Mrr: 1480000, CustomerNumber: "CUST-1001" }],
  opportunities: [{ OpportunityId: "opp-1", OpportunityNumber: "OPP-1001", OpportunityName: "Apex Fiber Expansion", AccountNameResolved: "Apex Health", AccountNumberResolved: "ACC-1001", Stage: "Discovery", EstimatedValue: 10000, OwnerName: "Rhea Patel", ApprovalStatus: "Draft", MarginPct: 30, ServiceSummary: "Fiber 1G", LocationCount: 1 }],
  quotes: [{ QuoteId: "quote-1", QuoteNumber: "Q-1001", AccountName: "Apex Health", OpportunityId: "opp-1", OpportunityName: "Apex Fiber Expansion", TotalMrc: 1200, TotalNrc: 500, MarginPct: 30, DiscountPct: 0, ApprovalStatus: "Draft", Status: "Draft" }],
  customPricing: [],
  approvals: [{ ApprovalId: "approval-1", EntityId: "quote-1", EntityType: "Quote", StepName: "Pricing", Status: "Pending", RequestedBy: "Rhea Patel" }],
  contracts: [{ ContractId: "contract-1", ContractNumber: "CON-1001", ContractName: "Apex Health Master Service Agreement", AccountName: "Apex Health", OpportunityId: "opp-1", OpportunityName: "Apex Fiber Expansion", QuoteId: "quote-1", QuoteNumber: "Q-1001", Status: "Generated", TermsJson: { termMonths: 36 } }],
  billingCustomers: customers,
  billingProducts: products,
  billingProductHierarchy: [{ ProductHierarchyId: "hier-1", ProductName: "Fiber 1G", HierarchyPath: "Access/Fiber", BillingCode: "MRC-FIBER", DisplayOrder: 1 }],
  billingCodes: [{ BillingCodeId: "code-1", Code: "MRC-FIBER", Description: "Fiber monthly", BillingType: "Recurring" }],
  billingElements: [{ BillingElementId: "elem-1", ElementName: "Monthly charge", ElementType: "Recurring", Amount: 1200 }],
  offers: [{ OfferId: "offer-1", OfferCode: "OFFER-1", OfferName: "Fiber launch", OfferType: "Discount", Eligibility: "Enterprise", Status: "Active" }],
  promotions: [{ PromotionId: "promo-1", PromotionCode: "PROMO-1", PromotionName: "Install credit", PromotionType: "Credit", DiscountPct: 10, Status: "Active" }],
  ratePlans: [{ RatePlanId: "rate-1", PlanCode: "PLAN-1", PlanName: "Fiber Standard", PlanTier: "Standard", BillingFrequency: "Monthly", MonthlyBaseFee: 1200, MinimumCommitment: 0 }]
};

const quoteLineItems = [
  { QuoteLineItemId: "line-1", QuoteId: "quote-1", ProductName: "Fiber 1G", ServiceName: "Internet", BillingCode: "MRC-FIBER", LineType: "Recurring", Quantity: 1, Mrc: 1200, Nrc: 500, Cost: 700, MarginPct: 30, DiscountPct: 0, Notes: "" }
];

const contractFiles = [
  { ContractFileId: "file-1", FileName: "Contract.pdf", FileType: "application/pdf", StorageUrl: "https://example.com/contract.pdf", CreatedAtUtc: "2026-05-01T00:00:00Z" }
];

const contractHistory = [
  { ContractHistoryId: "hist-1", EventType: "Generated", Notes: "Initial contract generated.", CreatedBy: "System", CreatedAtUtc: "2026-05-01T00:00:00Z" }
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
    } else if (path === "/api/platform/bootstrap") {
      body = { dashboard: { PipelineValue: 10000, QuoteMrcValue: 1200, OpportunityCount: 1, QuoteCount: 1 }, customers, opportunities: [{ OpportunityId: "opp-1" }], quotes: [{ QuoteId: "quote-1" }], approvals: [] };
    } else if (path === "/api/platform/knowledge/bootstrap") {
      body = {
        documents: [{ id: "doc-1", title: "Fiber Installation Guide", category: "Operations", audience: "Internal", owner: "Knowledge Ops", status: "Current", updated: "2026-05-01", summary: "Field and provisioning guidance." }],
        topics: [{ id: "topic-1", name: "Provisioning", label: "Provisioning", description: "Operational runbooks" }],
        summary: { documentCount: 1, topicCount: 1, currentCount: 1, reviewCount: 0 }
      };
    } else if (path === "/api/assistant/ui-overrides") {
      body = [];
    } else if (path === "/api/sales/bootstrap") {
      body = salesBootstrap;
    } else if (path === "/api/sales/leads/lead-1") {
      body = salesBootstrap.leads[0];
    } else if (path === "/api/sales/leads/lead-1/activities") {
      body = [{ LeadActivityId: "activity-1", ActivityDate: "2026-05-01", ActivityType: "Call", Outcome: "Connected", Notes: "Initial qualification", NextStep: "Schedule follow-up" }];
    } else if (path === "/api/sales/opportunities") {
      body = salesBootstrap.opportunities;
    } else if (path === "/api/sales/opportunities/opp-1") {
      body = salesBootstrap.opportunities[0];
    } else if (path === "/api/sales/opportunities/opp-1/products") {
      body = [{ OpportunityProductId: "opp-prod-1", OpportunityId: "opp-1", ProductName: "Fiber 1G", BillingCode: "MRC-FIBER", Quantity: 1, Mrc: 1200, Nrc: 500, Cost: 700, MarginPct: 30 }];
    } else if (path === "/api/sales/opportunities/opp-1/notes") {
      body = [
        { OpportunityNoteId: "note-1", OpportunityId: "opp-1", NoteType: "General", Note: "Customer evaluating expansion.", CreatedBy: "Rhea Patel", CreatedAtUtc: "2026-05-01T00:00:00Z" },
        { OpportunityNoteId: "note-2", OpportunityId: "opp-1", NoteType: "Activity", Notes: "Discovery call complete.", CreatedBy: "Rhea Patel", CreatedAtUtc: "2026-05-02T00:00:00Z" }
      ];
    } else if (path === "/api/sales/quotes") {
      body = salesBootstrap.quotes;
    } else if (path === "/api/sales/quotes/quote-1") {
      body = salesBootstrap.quotes[0];
    } else if (path === "/api/sales/quotes/quote-1/line-items") {
      body = quoteLineItems;
    } else if (path === "/api/sales/contracts") {
      body = salesBootstrap.contracts;
    } else if (path === "/api/sales/contracts/contract-1") {
      body = salesBootstrap.contracts[0];
    } else if (path === "/api/sales/contracts/contract-1/files") {
      body = contractFiles;
    } else if (path === "/api/sales/contracts/contract-1/history") {
      body = contractHistory;
    } else if (path === "/api/platform/customer-service/overview") {
      body = {
        tickets: [{ TicketId: "ticket-1", TicketNumber: "TKT-1001", CustomerNumber: "CUST-1001", AccountName: "Apex Health", IssueType: "Network outage", Category: "Network", Priority: "Urgent", Status: "Open", AgeHours: 18, OwnerName: "Care Ops", EscalationLevel: "Tier 2" }],
        customerReportedOutages: [{ EventId: "event-1", EventNumber: "NE-1001", Market: "Midwest", Type: "Capacity", Impacted: "Apex Health", Severity: "Major", Status: "Open", SlaExposure: 25000 }],
        summary: { openTicketCount: 1, networkTicketCount: 1, billingTicketCount: 0, averageAgeHours: 18, escalatedTicketCount: 1 }
      };
    } else if (path === "/api/platform/customer-service/tickets/ticket-1") {
      body = { ticket: { TicketId: "ticket-1", TicketNumber: "TKT-1001", AccountName: "Apex Health", IssueType: "Network outage", Status: "Open", Priority: "Urgent", OwnerName: "Care Ops" }, notes: [{ NoteType: "Created", Note: "Initial context", CreatedBy: "Care Ops" }] };
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
  ["dashboard", "Home"],
  ["knowledge", "Knowledge"],
  ["sales", "Sales"],
  ["reports", "Reports"],
  ["administration", "Administration"],
  ["product-pricing", "Product & Pricing"],
  ["customer-360", "Customer 360"],
  ["customer-service", "Customer Service"],
  ["billing", "Billing"],
  ["orders", "Orders"],
  ["network", "Network Events"],
  ["service-management", "Service Management"],
  ["provisioning", "Provisioning"],
  ["carrier-settlement", "Carrier Settlement"],
  ["details/customer/CUST-1001", "Customer 360"],
  ["details/lead/lead-1", "Apex Health"],
  ["details/opportunity/opp-1", "Apex Fiber Expansion"],
  ["details/quote/quote-1", "Apex Health"],
  ["details/contract/contract-1", "Apex Health Master Service Agreement"],
  ["details/billing-account/CUST-1001", "Customer 360"],
  ["details/invoice/invoice-1", "Billing"],
  ["details/order/order-1", "Orders"],
  ["details/product/prod-1", "Product & Pricing"],
  ["details/ticket/ticket-1", "TKT-1001"],
  ["details/network/event-1", "NE-1001"],
  ["details/record/admin:USR-1001", "Record Detail"]
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

test("mobile navigation drawer is grouped", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/#/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();

  const drawer = page.getByRole("dialog", { name: "Primary navigation" });
  await expect(drawer.getByText("Commercial")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Sales" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Billing" })).toBeVisible();
});

test("orders render mobile table cards", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/#/orders");
  const ordersTable = page.locator(".orders-compact .table-mobile").first();
  await expect(ordersTable).toBeVisible();
  await expect(page.locator(".orders-compact .table-desktop").first()).toBeHidden();
  await expect(page.getByText("ORD-1001").first()).toBeVisible();
});
