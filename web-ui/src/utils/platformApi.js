const DEFAULT_PLATFORM_API_BASE = "https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io";

const platformApiBase = (
  import.meta.env.VITE_PLATFORM_API_BASE_URL ||
  import.meta.env.VITE_SALES_API_BASE_URL ||
  import.meta.env.VITE_AI_API_BASE_URL ||
  DEFAULT_PLATFORM_API_BASE
).replace(/\/$/, "");

function platformUrl(path) {
  return `${platformApiBase}${path}`;
}

async function requestJson(path) {
  const response = await fetch(platformUrl(path), {
    headers: { "Content-Type": "application/json" }
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload.detail || payload.message || JSON.stringify(payload);
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(detail || `Platform request failed: ${response.status}`);
  }

  return response.json();
}

export { platformApiBase };
export const fetchPlatformBootstrap = () => requestJson("/api/platform/bootstrap");
export const fetchPlatformReportDefinitions = () => requestJson("/api/platform/reports/definitions");
export const fetchPlatformReport = reportId => requestJson(`/api/platform/reports/${encodeURIComponent(reportId)}`);
export const fetchAdministrationSummary = () => requestJson("/api/platform/administration/summary");
export const fetchCustomer360 = customerNumber => requestJson(`/api/platform/customer-360/${encodeURIComponent(customerNumber)}`);
export const fetchProductPricingOverview = () => requestJson("/api/platform/product-pricing/overview");
export const fetchCustomerServiceOverview = () => requestJson("/api/platform/customer-service/overview");
