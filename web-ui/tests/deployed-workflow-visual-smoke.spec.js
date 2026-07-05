import { expect, test } from "@playwright/test";

const ROUTE_LOAD_TIMEOUT_MS = 15_000;
const SCREENSHOT_SETTLE_MS = Number(process.env.PLAYWRIGHT_SCREENSHOT_SETTLE_MS || 1_000);
const HARD_ERROR_TEXT = /Unable to|failed|timed out/i;

function captureConsoleErrors(page) {
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));
  return consoleErrors;
}

async function useDemoRole(page, role = "Admin") {
  await page.addInitScript(nextRole => {
    window.localStorage?.setItem("bdwus.role", nextRole);
  }, role);
}

async function workflowEvidence(page, workflow, status) {
  const root = page.locator("#root");
  return {
    workflow,
    status,
    url: page.url(),
    title: await page.title(),
    viewport: page.viewportSize(),
    activeRole: await page.getByLabel("Active permission role").inputValue().catch(() => ""),
    mainHeading: await root.getByRole("heading", { level: 1 }).first().textContent().catch(() => ""),
    visiblePanels: await root.locator(".panel h2, .panel strong").evaluateAll(nodes => nodes.slice(0, 10).map(node => node.textContent?.trim()).filter(Boolean)).catch(() => []),
    dialogs: await page.getByRole("dialog").evaluateAll(nodes => nodes.map(node => node.textContent?.trim().replace(/\s+/g, " ").slice(0, 240))).catch(() => []),
    mutationControls: await root.locator("button").evaluateAll(nodes => nodes
      .map(node => ({
        label: node.textContent?.trim().replace(/\s+/g, " "),
        disabled: node.disabled || node.getAttribute("aria-disabled") === "true",
        title: node.getAttribute("title") || ""
      }))
      .filter(item => /New|Create|Convert|Approve|Reject|Provision|Submit|Save|Upload/i.test(item.label || ""))
      .slice(0, 20)
    ).catch(() => [])
  };
}

async function attachWorkflowEvidence(testInfo, page, name, consoleErrors, status) {
  await page.waitForTimeout(SCREENSHOT_SETTLE_MS);
  await testInfo.attach(`${name}-screenshot`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
  await testInfo.attach(`${name}-workflow-evidence`, {
    body: JSON.stringify({
      ...await workflowEvidence(page, name, status),
      consoleErrors
    }, null, 2),
    contentType: "application/json"
  });
}

async function openRoute(page, hash, heading) {
  await page.goto(`/#/${hash}`, { waitUntil: "domcontentloaded" });
  const root = page.locator("#root");
  await expect(root.getByRole("heading", { name: heading }).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
  await expect(root.locator("> *")).toHaveCount(1);
  await expect(page.locator(".crawler-preview")).toBeHidden();
  await expect(root.getByRole("navigation", { name: "Primary" })).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
  await expect(root.locator(".empty-state").filter({ hasText: /^Loading/i })).toHaveCount(0, { timeout: ROUTE_LOAD_TIMEOUT_MS });
  await expect(root.locator(".empty-state").filter({ hasText: HARD_ERROR_TEXT })).toHaveCount(0);
}

async function closeDialog(page) {
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.describe("deployed workflow visual smoke", () => {
  test("sales workflow dialogs open without submitting preview mutations", async ({ page }, testInfo) => {
    await useDemoRole(page, "Admin");
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "sales", "Sales");

    await page.getByRole("button", { name: /New Lead/i }).click();
    await expect(page.getByRole("dialog").getByText("New lead")).toBeVisible();
    await expect(page.getByLabel("Account Name")).toBeVisible();
    await attachWorkflowEvidence(testInfo, page, "sales-new-lead-workflow", consoleErrors, "dialog-opened-no-submit");
    await closeDialog(page);

    await page.getByRole("button", { name: /New Opportunity/i }).click();
    await expect(page.getByRole("dialog").getByText("New opportunity")).toBeVisible();
    await expect(page.getByLabel("Opportunity Name")).toBeVisible();
    await attachWorkflowEvidence(testInfo, page, "sales-new-opportunity-workflow", consoleErrors, "dialog-opened-no-submit");
    await closeDialog(page);

    const convertButtons = page.locator("#root").getByRole("button", { name: "Convert" });
    if (await convertButtons.count()) {
      await convertButtons.first().click();
      await expect(page.getByRole("dialog").getByText("Convert lead")).toBeVisible();
      await expect(page.getByLabel("Service Focus")).toBeVisible();
      await attachWorkflowEvidence(testInfo, page, "sales-lead-convert-workflow", consoleErrors, "dialog-opened-no-submit");
      await closeDialog(page);
    } else {
      await attachWorkflowEvidence(testInfo, page, "sales-lead-convert-workflow", consoleErrors, "no-preview-leads-to-convert");
    }

    await page.locator(".record-tabs").getByRole("button", { name: "Opportunities" }).click();
    await expect(page.getByText(/Opportunity detail|Pipeline records|Search opportunities/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    const createQuoteButtons = page.locator("#root").getByRole("button", { name: "Create Quote" });
    if (await createQuoteButtons.count()) {
      await createQuoteButtons.first().click();
      await expect(page.getByRole("dialog").getByText("Create quote", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Quote Number")).toBeVisible();
      await attachWorkflowEvidence(testInfo, page, "sales-create-quote-workflow", consoleErrors, "dialog-opened-no-submit");
      await closeDialog(page);
    } else {
      await attachWorkflowEvidence(testInfo, page, "sales-create-quote-workflow", consoleErrors, "no-preview-opportunities-to-quote");
    }

    expect(consoleErrors).toEqual([]);
  });

  test("billing workflow action surfaces render without posting sample records", async ({ page }, testInfo) => {
    await useDemoRole(page, "Billing");
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "billing", "Billing");

    await page.locator(".record-tabs").getByRole("button", { name: "Actions" }).click();
    await expect(page.getByText(/Invoice Actions|Select an invoice|Workflow actions/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    const actionButton = page.getByRole("button", { name: "Create sample action" });
    await expect(actionButton).toBeVisible();
    await attachWorkflowEvidence(testInfo, page, "billing-invoice-action-workflow", consoleErrors, "action-surface-rendered-no-submit");

    await page.locator(".record-tabs").getByRole("button", { name: "Adjustments" }).click();
    await expect(page.getByText(/Adjustments|No adjustments/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });
    await expect(page.getByRole("button", { name: "Create sample adjustment" })).toBeVisible();
    await attachWorkflowEvidence(testInfo, page, "billing-adjustment-workflow", consoleErrors, "adjustment-surface-rendered-no-submit");

    expect(consoleErrors).toEqual([]);
  });

  test("orders provisioning workflow controls render without mutating preview data", async ({ page }, testInfo) => {
    await useDemoRole(page, "Admin");
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "orders", "Orders");
    await expect(page.getByRole("button", { name: "New Order" })).toBeVisible();
    await expect(page.getByText(/Provisioning Jobs|Delivery queue|No orders returned/i).first()).toBeVisible({ timeout: ROUTE_LOAD_TIMEOUT_MS });

    const provisionButtons = page.locator("#root").getByRole("button", { name: "Provision" });
    const status = await provisionButtons.count() ? "provision-controls-rendered-no-submit" : "no-preview-orders-to-provision";
    if (await provisionButtons.count()) {
      await expect(provisionButtons.first()).toBeVisible();
    }
    await attachWorkflowEvidence(testInfo, page, "orders-provisioning-workflow", consoleErrors, status);

    expect(consoleErrors).toEqual([]);
  });

  test("viewer role keeps deployed billing and order mutation controls inert", async ({ page }, testInfo) => {
    await useDemoRole(page, "Viewer");
    const consoleErrors = captureConsoleErrors(page);

    await openRoute(page, "billing", "Billing");
    await page.locator(".record-tabs").getByRole("button", { name: "Actions" }).click();
    await expect(page.getByRole("button", { name: "Create sample action" })).toBeDisabled();
    await page.locator(".record-tabs").getByRole("button", { name: "Adjustments" }).click();
    await expect(page.getByRole("button", { name: "Create sample adjustment" })).toBeDisabled();
    await attachWorkflowEvidence(testInfo, page, "viewer-billing-workflow-gates", consoleErrors, "mutation-controls-disabled");

    await openRoute(page, "orders", "Orders");
    await expect(page.getByRole("button", { name: "New Order" })).toBeDisabled();
    const provisionButtons = page.locator("#root").getByRole("button", { name: "Provision" });
    if (await provisionButtons.count()) {
      await expect(provisionButtons.first()).toBeDisabled();
    }
    await attachWorkflowEvidence(testInfo, page, "viewer-orders-workflow-gates", consoleErrors, "mutation-controls-disabled");

    expect(consoleErrors).toEqual([]);
  });
});
