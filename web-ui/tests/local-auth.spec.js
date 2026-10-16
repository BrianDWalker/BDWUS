import { expect, test } from "@playwright/test";

test("all local API clients send the selected role token on reads and writes", async ({ page, baseURL }) => {
  test.skip(!baseURL.endsWith(":4174"), "Uses the dedicated Vite development-mode config");
  const captured = [];
  await page.route("**/api/**", route => {
    captured.push({ path: new URL(route.request().url()).pathname, auth: route.request().headers().authorization });
    return route.fulfill({ json: {} });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.setItem("bdwus.role", "Admin");
    localStorage.setItem("bdwus.role.token", "local-signed-token");
    localStorage.setItem("bdwus.role.token.role", "Admin");
    localStorage.setItem("bdwus.role.token.exp", "4102444800");
    const platform = await import("/src/utils/platformApi.js");
    const sales = await import("/src/utils/salesApi.js");
    const ops = await import("/src/utils/opsApi.js");
    const mutations = await import("/src/utils/opsMutations.js");
    const assistant = await import("/src/utils/assistantApi.js");
    await platform.fetchPlatformBootstrap();
    await sales.getSalesDashboard();
    await ops.fetchOrders();
    await mutations.createOrder({});
    await platform.fetchBillingFacts("payments");
    await assistant.chatAssistant({ message: "test" });
  });
  for (const path of ["/api/platform/bootstrap", "/api/sales/dashboard", "/api/ops/orders", "/api/assistant/chat", "/api/billing-facts/payments"]) {
    expect(captured.some(item => item.path === path && item.auth === "Bearer local-signed-token")).toBe(true);
  }
});
