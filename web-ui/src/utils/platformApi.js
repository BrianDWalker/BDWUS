import { fetchWithTimeout } from "./fetchTimeout";

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

async function readResponsePayload(response) {
  try {
    return await response.json();
  } catch {
    return await response.text().catch(() => "");
  }
}

async function requestJson(path, options = {}) {
  const response = await fetchWithTimeout(platformUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    if (options.acceptStatuses?.includes(response.status)) {
      return payload && typeof payload === "object"
        ? { ...payload, __httpStatus: response.status }
        : { detail: payload, __httpStatus: response.status };
    }
    const detail = payload?.detail || payload?.message || (typeof payload === "string" ? payload : JSON.stringify(payload));
    throw new Error(detail || `Platform request failed: ${response.status}`);
  }

  return payload;
}

export { platformApiBase };
export const fetchPlatformBootstrap = () => requestJson("/api/platform/bootstrap");
export const fetchPlatformReportDefinitions = () => requestJson("/api/platform/reports/definitions");
export const fetchPlatformReport = reportId => requestJson(`/api/platform/reports/${encodeURIComponent(reportId)}`);
export const fetchAdministrationSummary = () => requestJson("/api/platform/administration/summary");
export const fetchKnowledgeBootstrap = () => requestJson("/api/platform/knowledge/bootstrap", { acceptStatuses: [404] });
export const fetchKnowledgeDocuments = () => requestJson("/api/platform/knowledge/documents");
export const fetchKnowledgeTopics = () => requestJson("/api/platform/knowledge/topics");
export const fetchCustomer360 = customerNumber => requestJson(`/api/platform/customer-360/${encodeURIComponent(customerNumber)}`);
export const fetchProductPricingOverview = () => requestJson("/api/platform/product-pricing/overview");
export const fetchCustomerServiceOverview = () => requestJson("/api/platform/customer-service/overview");
export const fetchCustomerServiceTickets = () => requestJson("/api/platform/customer-service/tickets");
export const fetchCustomerServiceTicket = id => requestJson(`/api/platform/customer-service/tickets/${encodeURIComponent(id)}`);
export const createCustomerServiceTicket = payload => requestJson("/api/platform/customer-service/tickets", { method: "POST", body: JSON.stringify(payload) });
export const updateCustomerServiceTicket = (id, payload) => requestJson(`/api/platform/customer-service/tickets/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
export const createCustomerServiceTicketNote = (id, payload) => requestJson(`/api/platform/customer-service/tickets/${encodeURIComponent(id)}/notes`, { method: "POST", body: JSON.stringify(payload) });
