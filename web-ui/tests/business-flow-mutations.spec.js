import { expect, test } from "@playwright/test";

const orderId = "11111111-1111-4111-8111-111111111111";
const invoiceId = "22222222-2222-4222-8222-222222222222";

function json(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  };
}

async function installPlatformApiMocks(page) {
  const state = {
    orders: [
      {
        OrderId: orderId,
        OrderNumber: "ORD-1001",
        AccountName: "Apex Health",
        ServiceName: "Fiber 1G",
        LifecycleStage: "Design",
        OverallStatus: "Draft",
        SlaStatus: "On Track",
        DueDate: "2026-07-15",
        AssignedTeam: "Provisioning Ops"
      }
    ],
    jobs: [],
    invoiceActions: [],
    adjustments: [],
    adminUsers: [
      {
        UserId: "33333333-3333-4333-8333-333333333333",
        UserNumber: "USR-1001",
        UserName: "Platform Admin",
        RoleName: "Administrator",
        Status: "Active",
        LastLoginAtUtc: "2026-07-01T12:00:00Z"
      }
    ],
    adminRoles: [
      {
        RoleId: "44444444-4444-4444-8444-444444444444",
        RoleNumber: "ROLE-1001",
        RoleName: "Administrator",
        PermissionsJson: "[\"dashboard\",\"reports\"]",
        Status: "Active"
      }
    ],
    adminIntegrations: [
      {
        IntegrationId: "55555555-5555-4555-8555-555555555555",
        IntegrationNumber: "INT-1001",
        IntegrationName: "CRM Sync",
        Detail: "Connected",
        OwnerName: "Platform",
        Status: "Connected"
      }
    ]
  };

  const calls = [];

  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = method === "GET" ? null : request.postDataJSON?.() ?? null;
    calls.push({ method, path, body });

    if (method === "GET" && path === "/api/ops/bootstrap") {
      return route.fulfill(json({
        orders: state.orders,
        provisioningJobs: state.jobs,
        networkEvents: [],
        carrierSettlements: []
      }));
    }

    if (method === "GET" && path === "/api/ops/orders") {
      return route.fulfill(json(state.orders));
    }

    if (method === "POST" && path === "/api/ops/orders") {
      state.orders = [
        ...state.orders,
        {
          OrderId: "66666666-6666-4666-8666-666666666666",
          OrderNumber: "ORD-NEW",
          AccountName: body?.accountName || "New Customer",
          ServiceName: body?.serviceName || "Fiber 1G",
          LifecycleStage: body?.lifecycleStage || "Design",
          OverallStatus: body?.overallStatus || "Draft",
          SlaStatus: body?.slaStatus || "On Track",
          DueDate: "2026-07-20",
          AssignedTeam: "Ops"
        }
      ];
      return route.fulfill(json(state.orders.at(-1), 201));
    }

    if (method === "PUT" && path === `/api/ops/orders/${orderId}`) {
      state.orders = state.orders.map(row => row.OrderId === orderId ? {
        ...row,
        LifecycleStage: body?.lifecycleStage || row.LifecycleStage,
        OverallStatus: body?.overallStatus || row.OverallStatus,
        SlaStatus: body?.slaStatus || row.SlaStatus
      } : row);
      return route.fulfill(json(state.orders.find(row => row.OrderId === orderId)));
    }

    if (method === "GET" && path === "/api/ops/provisioning-jobs") {
      return route.fulfill(json(state.jobs));
    }

    if (method === "POST" && path === "/api/ops/provisioning-jobs") {
      state.jobs = [
        ...state.jobs,
        {
          ProvisioningJobId: "77777777-7777-4777-8777-777777777777",
          JobNumber: "JOB-NEW",
          OrderId: body?.orderId,
          JobType: body?.jobType || "Provisioning",
          OwnerName: body?.ownerName || "Provisioning Ops",
          Status: body?.status || "Queued",
          DueDate: "2026-07-21"
        }
      ];
      return route.fulfill(json(state.jobs.at(-1), 201));
    }

    if (method === "GET" && path === "/api/billing/customers") {
      return route.fulfill(json([
        {
          CustomerNumber: "CUST-1001",
          CustomerName: "Apex Health",
          CustomerType: "Enterprise",
          Region: "Midwest",
          Mrr: 12000,
          Status: "Active"
        }
      ]));
    }

    if (method === "GET" && path === "/api/billing-workflows/invoices") {
      return route.fulfill(json([
        {
          InvoiceId: invoiceId,
          InvoiceNumber: "INV-1001",
          AccountName: "Apex Health",
          Amount: 1200,
          Balance: 300,
          Status: "Open",
          DueDate: "2026-07-30"
        }
      ]));
    }

    if (method === "GET" && path === `/api/billing-workflows/invoices/${invoiceId}`) {
      return route.fulfill(json({
        InvoiceId: invoiceId,
        InvoiceNumber: "INV-1001",
        AccountName: "Apex Health",
        Amount: 1200,
        Balance: 300,
        Status: "Open"
      }));
    }

    if (method === "GET" && path === `/api/billing-workflows/invoices/${invoiceId}/actions`) {
      return route.fulfill(json(state.invoiceActions));
    }

    if (method === "POST" && path === `/api/billing-workflows/invoices/${invoiceId}/actions`) {
      state.invoiceActions = [
        ...state.invoiceActions,
        {
          InvoiceActionId: "88888888-8888-4888-8888-888888888888",
          ActionType: body?.actionType || "Review",
          Status: body?.status || "Open",
          RequestedBy: body?.requestedBy || "Billing Ops",
          Notes: body?.notes || "Created from billing module",
          CreatedAtUtc: "2026-07-04T12:00:00Z"
        }
      ];
      return route.fulfill(json(state.invoiceActions.at(-1), 201));
    }

    if (method === "GET" && path === "/api/billing-workflows/adjustments") {
      return route.fulfill(json(state.adjustments));
    }

    if (method === "POST" && path === "/api/billing-workflows/adjustments") {
      state.adjustments = [
        ...state.adjustments,
        {
          AdjustmentId: "99999999-9999-4999-8999-999999999999",
          AdjustmentNumber: "ADJ-NEW",
          AdjustmentType: body?.adjustmentType || "Credit",
          Amount: body?.amount || -100,
          Status: body?.status || "Pending",
          Reason: body?.reason || "Created from billing module"
        }
      ];
      return route.fulfill(json(state.adjustments.at(-1), 201));
    }

    if (method === "GET" && path === "/api/platform/administration/summary") {
      return route.fulfill(json({
        platform: { environment: "Staging", serviceName: "Platform API" },
        controls: { pendingApprovals: 2 }
      }));
    }

    if (method === "GET" && path === "/api/admin/users") {
      return route.fulfill(json(state.adminUsers));
    }

    if (method === "POST" && path === "/api/admin/users") {
      state.adminUsers = [
        ...state.adminUsers,
        {
          UserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          UserNumber: "USR-NEW",
          UserName: body?.userName || "Platform User",
          RoleName: body?.roleName || "Operator",
          Status: body?.status || "Active",
          LastLoginAtUtc: "2026-07-04T12:00:00Z"
        }
      ];
      return route.fulfill(json(state.adminUsers.at(-1), 201));
    }

    if (method === "GET" && path === "/api/admin/roles") {
      return route.fulfill(json(state.adminRoles));
    }

    if (method === "POST" && path === "/api/admin/roles") {
      state.adminRoles = [
        ...state.adminRoles,
        {
          RoleId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          RoleNumber: "ROLE-NEW",
          RoleName: body?.roleName || "Role",
          PermissionsJson: JSON.stringify(body?.permissions || []),
          Status: body?.status || "Active"
        }
      ];
      return route.fulfill(json(state.adminRoles.at(-1), 201));
    }

    if (method === "GET" && path === "/api/admin/integrations") {
      return route.fulfill(json(state.adminIntegrations));
    }

    if (method === "POST" && path === "/api/admin/integrations") {
      state.adminIntegrations = [
        ...state.adminIntegrations,
        {
          IntegrationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          IntegrationNumber: "INT-NEW",
          IntegrationName: body?.integrationName || "Integration",
          Detail: body?.detail || "Created from administration module",
          OwnerName: body?.ownerName || "Platform",
          Status: body?.status || "Pending"
        }
      ];
      return route.fulfill(json(state.adminIntegrations.at(-1), 201));
    }

    return route.fulfill(json({ message: `Unhandled test route: ${method} ${path}` }, 404));
  });

  return calls;
}

test.describe("business-flow mutations", () => {
  test("orders can create and progress to provisioning", async ({ page }) => {
    const calls = await installPlatformApiMocks(page);

    await page.goto("/#/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    await expect(page.getByText("ORD-1001")).toBeVisible();

    await page.getByRole("button", { name: "New Order" }).click();
    await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/ops/orders")).toBeTruthy();
    expect(calls.find(call => call.method === "POST" && call.path === "/api/ops/orders")?.body).toMatchObject({
      accountName: "New Customer",
      serviceName: "Fiber 1G",
      lifecycleStage: "Design",
      overallStatus: "Draft",
      slaStatus: "On Track"
    });
    await expect(page.getByText("ORD-NEW")).toBeVisible();

    await page.getByRole("button", { name: "Provision" }).first().click();
    await expect.poll(() => calls.some(call => call.method === "PUT" && call.path === `/api/ops/orders/${orderId}`)).toBeTruthy();
    await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/ops/provisioning-jobs")).toBeTruthy();

    expect(calls.find(call => call.method === "PUT" && call.path === `/api/ops/orders/${orderId}`)?.body).toMatchObject({
      lifecycleStage: "Provisioning",
      overallStatus: "Provisioning"
    });
    expect(calls.find(call => call.method === "POST" && call.path === "/api/ops/provisioning-jobs")?.body).toMatchObject({
      orderId,
      jobType: "Provisioning",
      status: "Queued"
    });
    await expect(page.getByText("JOB-NEW")).toBeVisible();
  });

  test("billing can create invoice actions and adjustments", async ({ page }) => {
    const calls = await installPlatformApiMocks(page);

    await page.goto("/#/billing");
    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    await expect(page.getByText("INV-1001")).toBeVisible();

    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("button", { name: "Create sample action" }).click();
    await expect.poll(() => calls.some(call => call.method === "POST" && call.path === `/api/billing-workflows/invoices/${invoiceId}/actions`)).toBeTruthy();
    expect(calls.find(call => call.method === "POST" && call.path === `/api/billing-workflows/invoices/${invoiceId}/actions`)?.body).toMatchObject({
      actionType: "Review",
      status: "Open",
      requestedBy: "Billing Ops"
    });
    await expect(page.getByText("Created from billing module")).toBeVisible();

    await page.getByRole("button", { name: "Adjustments" }).click();
    await page.getByRole("button", { name: "Create sample adjustment" }).click();
    await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/billing-workflows/adjustments")).toBeTruthy();
    expect(calls.find(call => call.method === "POST" && call.path === "/api/billing-workflows/adjustments")?.body).toMatchObject({
      invoiceId,
      adjustmentType: "Credit",
      amount: -100,
      status: "Pending"
    });
    await expect(page.getByText("ADJ-NEW")).toBeVisible();
  });

  test("administration can create users roles and integrations", async ({ page }) => {
    const calls = await installPlatformApiMocks(page);

    await page.goto("/#/administration");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
    await expect(page.getByText("Platform Admin")).toBeVisible();

    await page.getByRole("button", { name: "Create sample user" }).click();
    await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/admin/users")).toBeTruthy();
    expect(calls.find(call => call.method === "POST" && call.path === "/api/admin/users")?.body).toMatchObject({
      roleName: "Operator",
      status: "Active"
    });
    await expect(page.getByText("USR-NEW")).toBeVisible();

    await page.getByRole("button", { name: "Roles" }).click();
    await page.getByRole("button", { name: "Create sample role" }).click();
    await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/admin/roles")).toBeTruthy();
    expect(calls.find(call => call.method === "POST" && call.path === "/api/admin/roles")?.body).toMatchObject({
      permissions: ["dashboard", "reports"],
      status: "Active"
    });
    await expect(page.getByText("ROLE-NEW")).toBeVisible();

    await page.getByRole("button", { name: "Integrations" }).click();
    await page.getByRole("button", { name: "Create sample integration" }).click();
    await expect.poll(() => calls.some(call => call.method === "POST" && call.path === "/api/admin/integrations")).toBeTruthy();
    expect(calls.find(call => call.method === "POST" && call.path === "/api/admin/integrations")?.body).toMatchObject({
      ownerName: "Platform",
      status: "Pending"
    });
    await expect(page.getByText("INT-NEW")).toBeVisible();
  });
});
