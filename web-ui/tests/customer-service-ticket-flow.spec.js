import { expect, test } from "@playwright/test";

async function mockCustomerServiceApis(page) {
  const ticket = { TicketId: "ticket-1", TicketNumber: "TKT-1001", CustomerNumber: "CUST-1001", AccountName: "Apex Health", IssueType: "Billing question", Category: "Billing", Priority: "High", Status: "Open", AgeHours: 2, OwnerName: "Care Ops", Summary: "Billing question from Apex Health." };
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let body = {};

    if (method === "GET" && path === "/api/platform/customer-service/overview") {
      body = { tickets: [ticket], customerReportedOutages: [], summary: { openTicketCount: 1, networkTicketCount: 0, billingTicketCount: 1, averageAgeHours: 2 } };
    } else if (method === "POST" && path === "/api/platform/customer-service/tickets") {
      body = { ...ticket, TicketId: "ticket-new", TicketNumber: "TKT-NEW" };
    } else if (method === "GET" && path === "/api/platform/customer-service/tickets/ticket-1") {
      body = { ticket, notes: [{ TicketNoteId: "note-1", NoteType: "Created", Note: "Initial ticket context.", CreatedBy: "Care Ops" }] };
    } else if (method === "GET" && path === "/api/platform/customer-service/tickets/ticket-new") {
      body = { ticket: { ...ticket, TicketId: "ticket-new", TicketNumber: "TKT-NEW" }, notes: [{ TicketNoteId: "note-new", NoteType: "Created", Note: "Created from UI.", CreatedBy: "Care Ops" }] };
    } else if (method === "PUT" && path === "/api/platform/customer-service/tickets/ticket-1") {
      body = { ...ticket, Status: "Closed" };
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("customer service creates and opens persistent ticket detail", async ({ page }) => {
  await mockCustomerServiceApis(page);
  await page.goto("/#/customer-service");
  await expect(page.getByRole("heading", { name: "Customer Service" })).toBeVisible();
  await expect(page.getByText("TKT-1001")).toBeVisible();
  await page.getByRole("button", { name: "Create ticket" }).click();
  await expect(page.getByText("Ticket TKT-NEW saved")).toBeVisible();
  await expect(page.getByRole("heading", { name: "TKT-NEW" })).toBeVisible();
});

test("ticket detail route is extracted and closable", async ({ page }) => {
  await mockCustomerServiceApis(page);
  await page.goto("/#/details/ticket/ticket-1");
  await expect(page.getByRole("heading", { name: "TKT-1001" })).toBeVisible();
  await expect(page.getByText("Billing question from Apex Health.")).toBeVisible();
  await page.getByRole("button", { name: "Close Ticket" }).click();
  await expect(page.getByText("Ticket TKT-1001 Closed")).toBeVisible();
});
