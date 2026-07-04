const opsApiBase = (import.meta.env.VITE_PLATFORM_API_BASE_URL || window.location.origin || "").replace(/\/$/, "");

function url(path) {
  return `${opsApiBase}${path}`;
}

async function requestJson(path) {
  const response = await fetch(url(path), {
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
    throw new Error(detail || `Ops request failed: ${response.status}`);
  }
  return response.json();
}

export const fetchOpsBootstrap = () => requestJson('/api/ops/bootstrap');
export const fetchOrders = () => requestJson('/api/ops/orders');
export const fetchNetworkEvents = () => requestJson('/api/ops/network-events');
export const fetchProvisioningJobs = () => requestJson('/api/ops/provisioning-jobs');
export const fetchCarrierSettlements = () => requestJson('/api/ops/carrier-settlement');
export const fetchAdminUsers = () => requestJson('/api/admin/users');
export const fetchAdminRoles = () => requestJson('/api/admin/roles');
export const fetchAdminIntegrations = () => requestJson('/api/admin/integrations');
export const fetchBillingWorkflowInvoices = () => requestJson('/api/billing-workflows/invoices');
export const fetchBillingWorkflowAdjustments = () => requestJson('/api/billing-workflows/adjustments');
