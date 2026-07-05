import { fetchWithTimeout } from "./fetchTimeout";
import { demoRoleHeaders } from "./permissions";

const DEFAULT_OPS_API_BASE = "https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io";

const opsApiBase = (
  import.meta.env.VITE_PLATFORM_API_BASE_URL ||
  import.meta.env.VITE_SALES_API_BASE_URL ||
  import.meta.env.VITE_AI_API_BASE_URL ||
  DEFAULT_OPS_API_BASE
).replace(/\/$/, "");

function url(path) {
  return `${opsApiBase}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await fetchWithTimeout(url(path), {
    headers: { "Content-Type": "application/json", ...demoRoleHeaders(), ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload.detail || payload.message || JSON.stringify(payload);
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(detail || `Mutation request failed: ${response.status}`);
  }
  return response.json();
}

const postJson = (path, body) => requestJson(path, { method: "POST", body: JSON.stringify(body) });
const putJson = (path, body) => requestJson(path, { method: "PUT", body: JSON.stringify(body) });

export const createOrder = payload => postJson('/api/ops/orders', payload);
export const updateOrder = (orderId, payload) => putJson(`/api/ops/orders/${encodeURIComponent(orderId)}`, payload);
export const createNetworkEvent = payload => postJson('/api/ops/network-events', payload);
export const createProvisioningJob = payload => postJson('/api/ops/provisioning-jobs', payload);
export const updateProvisioningJob = (jobId, payload) => putJson(`/api/ops/provisioning-jobs/${encodeURIComponent(jobId)}`, payload);
export const createCarrierSettlement = payload => postJson('/api/ops/carrier-settlement', payload);
export const createAdminUser = payload => postJson('/api/admin/users', payload);
export const createAdminRole = payload => postJson('/api/admin/roles', payload);
export const createAdminIntegration = payload => postJson('/api/admin/integrations', payload);
export const createInvoiceAction = (invoiceId, payload) => postJson(`/api/billing-workflows/invoices/${encodeURIComponent(invoiceId)}/actions`, payload);
export const createBillingAdjustment = payload => postJson('/api/billing-workflows/adjustments', payload);
