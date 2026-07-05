import { fetchWithTimeout } from "./fetchTimeout";
import { demoRoleHeaders } from "./permissions";

const DEFAULT_SALES_API_BASE = "https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io";

export const salesApiBase = (import.meta.env.VITE_SALES_API_BASE_URL || import.meta.env.VITE_AI_API_BASE_URL || DEFAULT_SALES_API_BASE).replace(/\/$/, "");

function salesUrl(path) {
  return `${salesApiBase}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await fetchWithTimeout(salesUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...demoRoleHeaders(),
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Sales request failed: ${response.status}`);
  }
  return response.json();
}

export const getSalesDashboard = () => requestJson("/api/sales/dashboard");
export const getSalesBootstrap = () => requestJson("/api/sales/bootstrap");

export const listLeads = params => requestJson(`/api/sales/leads${params ? `?${new URLSearchParams(params)}` : ""}`);
export const getLead = id => requestJson(`/api/sales/leads/${id}`);
export const createLead = payload => requestJson("/api/sales/leads", { method: "POST", body: JSON.stringify(payload) });
export const updateLead = (id, payload) => requestJson(`/api/sales/leads/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteLead = id => requestJson(`/api/sales/leads/${id}`, { method: "DELETE" });
export const convertLead = (id, payload) => requestJson(`/api/sales/leads/${id}/convert`, { method: "POST", body: JSON.stringify(payload) });
export const listLeadActivities = id => requestJson(`/api/sales/leads/${id}/activities`);
export const createLeadActivity = (id, payload) => requestJson(`/api/sales/leads/${id}/activities`, { method: "POST", body: JSON.stringify(payload) });

export const listAccounts = params => requestJson(`/api/sales/accounts${params ? `?${new URLSearchParams(params)}` : ""}`);
export const getAccount = id => requestJson(`/api/sales/accounts/${id}`);
export const createAccount = payload => requestJson("/api/sales/accounts", { method: "POST", body: JSON.stringify(payload) });
export const updateAccount = (id, payload) => requestJson(`/api/sales/accounts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteAccount = id => requestJson(`/api/sales/accounts/${id}`, { method: "DELETE" });

export const listOpportunities = params => requestJson(`/api/sales/opportunities${params ? `?${new URLSearchParams(params)}` : ""}`);
export const getOpportunity = id => requestJson(`/api/sales/opportunities/${id}`);
export const createOpportunity = payload => requestJson("/api/sales/opportunities", { method: "POST", body: JSON.stringify(payload) });
export const updateOpportunity = (id, payload) => requestJson(`/api/sales/opportunities/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteOpportunity = id => requestJson(`/api/sales/opportunities/${id}`, { method: "DELETE" });
export const listOpportunityProducts = id => requestJson(`/api/sales/opportunities/${id}/products`);
export const createOpportunityProduct = (id, payload) => requestJson(`/api/sales/opportunities/${id}/products`, { method: "POST", body: JSON.stringify(payload) });
export const updateOpportunityProduct = (opportunityId, productId, payload) => requestJson(`/api/sales/opportunities/${opportunityId}/products/${productId}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteOpportunityProduct = (opportunityId, productId) => requestJson(`/api/sales/opportunities/${opportunityId}/products/${productId}`, { method: "DELETE" });
export const listOpportunityNotes = id => requestJson(`/api/sales/opportunities/${id}/notes`);
export const createOpportunityNote = (id, payload) => requestJson(`/api/sales/opportunities/${id}/notes`, { method: "POST", body: JSON.stringify(payload) });

export const listCustomPricing = () => requestJson("/api/sales/custom-pricing");
export const getCustomPricing = id => requestJson(`/api/sales/custom-pricing/${id}`);
export const createCustomPricing = payload => requestJson("/api/sales/custom-pricing", { method: "POST", body: JSON.stringify(payload) });
export const updateCustomPricing = (id, payload) => requestJson(`/api/sales/custom-pricing/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteCustomPricing = id => requestJson(`/api/sales/custom-pricing/${id}`, { method: "DELETE" });
export const submitCustomPricing = (id, payload = {}) => requestJson(`/api/sales/custom-pricing/${id}/submit`, { method: "POST", body: JSON.stringify(payload) });

export const listQuotes = () => requestJson("/api/sales/quotes");
export const getQuote = id => requestJson(`/api/sales/quotes/${id}`);
export const createQuote = payload => requestJson("/api/sales/quotes", { method: "POST", body: JSON.stringify(payload) });
export const updateQuote = (id, payload) => requestJson(`/api/sales/quotes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteQuote = id => requestJson(`/api/sales/quotes/${id}`, { method: "DELETE" });
export const listQuoteLineItems = id => requestJson(`/api/sales/quotes/${id}/line-items`);
export const createQuoteLineItem = (id, payload) => requestJson(`/api/sales/quotes/${id}/line-items`, { method: "POST", body: JSON.stringify(payload) });
export const updateQuoteLineItem = (quoteId, lineItemId, payload) => requestJson(`/api/sales/quotes/${quoteId}/line-items/${lineItemId}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteQuoteLineItem = (quoteId, lineItemId) => requestJson(`/api/sales/quotes/${quoteId}/line-items/${lineItemId}`, { method: "DELETE" });
export const priceQuote = (id, payload) => requestJson(`/api/sales/quotes/${id}/price`, { method: "POST", body: JSON.stringify(payload) });
export const submitQuoteApproval = (id, payload) => requestJson(`/api/sales/quotes/${id}/submit-approval`, { method: "POST", body: JSON.stringify(payload) });
export const convertQuoteToOrder = (id, payload = {}) => requestJson(`/api/sales/quotes/${id}/convert-to-order`, { method: "POST", body: JSON.stringify(payload) });

export const listApprovals = () => requestJson("/api/sales/approvals");
export const getApproval = id => requestJson(`/api/sales/approvals/${id}`);
export const approveApproval = (id, payload = {}) => requestJson(`/api/sales/approvals/${id}/approve`, { method: "POST", body: JSON.stringify(payload) });
export const rejectApproval = (id, payload = {}) => requestJson(`/api/sales/approvals/${id}/reject`, { method: "POST", body: JSON.stringify(payload) });
export const requestChangesApproval = (id, payload = {}) => requestJson(`/api/sales/approvals/${id}/request-changes`, { method: "POST", body: JSON.stringify(payload) });

export const listContracts = () => requestJson("/api/sales/contracts");
export const getContract = id => requestJson(`/api/sales/contracts/${id}`);
export const createContract = payload => requestJson("/api/sales/contracts", { method: "POST", body: JSON.stringify(payload) });
export const updateContract = (id, payload) => requestJson(`/api/sales/contracts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteContract = id => requestJson(`/api/sales/contracts/${id}`, { method: "DELETE" });
export const listContractFiles = id => requestJson(`/api/sales/contracts/${id}/files`);
export const createContractFile = (id, payload) => requestJson(`/api/sales/contracts/${id}/files`, { method: "POST", body: JSON.stringify(payload) });
export const deleteContractFile = (contractId, fileId) => requestJson(`/api/sales/contracts/${contractId}/files/${fileId}`, { method: "DELETE" });
export const listContractHistory = id => requestJson(`/api/sales/contracts/${id}/history`);

export const listBillingCustomers = () => requestJson("/api/billing/customers");
export const getBillingCustomer = customerNumber => requestJson(`/api/billing/customers/${customerNumber}`);
export const listBillingProducts = () => requestJson("/api/billing/products");
export const listBillingProductHierarchy = () => requestJson("/api/billing/product-hierarchy");
export const listBillingCodes = () => requestJson("/api/billing/billing-codes");
export const listBillingElements = () => requestJson("/api/billing/billing-elements");
export const listOffers = () => requestJson("/api/billing/offers");
export const listPromotions = () => requestJson("/api/billing/promotions");
export const listRatePlans = () => requestJson("/api/billing/rate-plans");
export const checkServiceability = payload => requestJson("/api/sales/serviceability/check", { method: "POST", body: JSON.stringify(payload) });
