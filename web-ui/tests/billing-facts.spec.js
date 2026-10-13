import { expect, test } from "@playwright/test";

test("billing facts show real rows and a retryable schema error", async ({ page }) => {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { role: "Admin" } });
    if (path === "/api/billing-facts/payments") return route.fulfill({ status: 503, json: { detail: "Payments data needs owner review." } });
    if (path === "/api/billing-facts/subscriptions") { await new Promise(resolve => setTimeout(resolve, 300)); return route.fulfill({ json: [{ RecordId: "S-1", CustomerNumber: "C-1", CustomerName: "Real customer", ServiceName: "Fiber", PlanName: "Standard", Quantity: 1, Status: "Active" }] }); }
    if (path === "/api/billing-facts/usage") return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  await page.goto("/#/billing");
  await expect(page.getByRole("heading", { name: "Billing", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Subscriptions", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Loading subscriptions");
  await expect(page.getByRole("cell", { name: "Real customer", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Payments data needs owner review.");
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Usage", exact: true }).click();
  await expect(page.getByText("No usage records.")).toBeVisible();
});
