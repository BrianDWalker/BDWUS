import { expect, test } from "@playwright/test";

async function mockCustomerServiceApis(page) {
  const ticket = { TicketId: "ticket-1", TicketNumber: "TKT-1001", CustomerNumber: "CUST-1001", AccountName: "Apex Health", IssueType: "Billing question", Category: "Billing", Priority: "High", Status: "Open", AgeHours: 2, OwnerName: "Care Ops", Summary: "Billing question from Apex Health.", EscalationLevel: "Tier 1", SlaTargetHours: 24 };
  let notes = [{ TicketNoteId: "note-1", NoteType: "Created", Note: "Initial ticket context.", CreatedBy: "Care Ops" }];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let body = {};

    if (method === "GET" && path === "/api/platform/customer-service/overview") {
      body = { tickets: [ticket], customerReportedOutages: [], summary: { openTicketCount: 1, networkTicketCount: 0, billingTicketCount: 1, averageAgeHours: 2, escalatedTicketCount: 0 } };
    } else if (method === "POST" && path === "/api/platform/customer-service/tickets") {
      body = { ...ticket, TicketId: "ticket-new", TicketNumber: "TKT-NEW" };
    } else if (method === "GET" && path === "/api/platform/customer-service/tickets/ticket-1") {
      body = { ticket, notes };
    } else if (method === "GET" && path === "/api/platform/customer-service/tickets/ticket-new") {
      body = { ticket: { ...ticket, TicketId: "ticket-new", TicketNumber: "TKT-NEW" }, notes: [{ TicketNoteId: "note-new", NoteType: "Created", Note: "Created from UI.", CreatedBy: "Care Ops" }] };
    } else if (method === "PUT" && path === "/api/platform/customer-service/tickets/ticket-1") {
      const payload = route.request().postDataJSON();
      body = { ...ticket, ...payload, Status: payload.status || ticket.Status, Priority: payload.priority || ticket.Priority, EscalationLevel: payload.escalationLevel || ticket.EscalationLevel, SlaTargetHours: payload.slaTargetHours || ticket.SlaTargetHours, ClosureReason: payload.closureReason };
      if (payload.note) notes = [{ TicketNoteId: "note-update", NoteType: payload.noteType || "Update", Note: payload.note, CreatedBy: payload.createdBy || "Care Ops" }, ...notes];
    } else if (method === "POST" && path === "/api/platform/customer-service/tickets/ticket-1/notes") {
      const payload = route.request().postDataJSON();
      const note = { TicketNoteId: "note-comment", NoteType: payload.noteType || "Comment", Note: payload.note, CreatedBy: payload.createdBy || "Care Ops" };
      notes = [note, ...notes];
      body = note;
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

test("ticket detail route supports comments escalation and closure reason", async ({ page }) => {
  await mockCustomerServiceApis(page);
  await page.goto("/#/details/ticket/ticket-1");
  await expect(page.getByRole("heading", { name: "TKT-1001" })).toBeVisible();
  await expect(page.getByText("Billing question from Apex Health.")).toBeVisible();
  await page.getByPlaceholder("Add a ticket comment or customer update").fill("Customer confirmed the billing issue.");
  await page.getByRole("button", { name: "Add Comment" }).click();
  await expect(page.getByText("Ticket comment added")).toBeVisible();
  await page.getByRole("button", { name: "Escalate" }).click();
  await expect(page.getByText("Ticket TKT-1001 escalated")).toBeVisible();
  await page.getByPlaceholder("Closure reason").fill("Resolved with customer confirmation");
  await page.getByRole("button", { name: "Close With Reason" }).click();
  await expect(page.getByText("Ticket TKT-1001 Closed")).toBeVisible();
});
