const CONFIG = window.APP_CONFIG || {};
const routes = CONFIG.routes || {};

const els = {
  opportunityName: document.getElementById("opportunityName"),
  existingAccount: document.getElementById("existingAccount"),
  accountLookupNote: document.getElementById("accountLookupNote"),
  customerStatus: document.getElementById("customerStatus"),
  customerStatusDisplay: document.getElementById("customerStatusDisplay"),
  customerType: document.getElementById("customerType"),
  industryType: document.getElementById("industryType"),
  customerRegion: document.getElementById("customerRegion"),
  countryCode: document.getElementById("countryCode"),
  creditRating: document.getElementById("creditRating"),
  serviceCategory: document.getElementById("serviceCategory"),
  planTier: document.getElementById("planTier"),
  planName: document.getElementById("planName"),
  serviceName: document.getElementById("serviceName"),
  targetMarginPctInput: document.getElementById("targetMarginPctInput"),
  manualAdjustmentPctInput: document.getElementById("manualAdjustmentPctInput"),
  competitorPriceInput: document.getElementById("competitorPriceInput"),
  demandIndexInput: document.getElementById("demandIndexInput"),
  subscriptionQtyInput: document.getElementById("subscriptionQtyInput"),
  submitBtn: document.getElementById("submitBtn"),
  resetBtn: document.getElementById("resetBtn"),
  statusBadge: document.getElementById("statusBadge"),
  resultOpportunityId: document.getElementById("resultOpportunityId"),
  resultQuoteId: document.getElementById("resultQuoteId"),
  resultFinalPrice: document.getElementById("resultFinalPrice"),
  resultMargin: document.getElementById("resultMargin"),
  resultRecommendedPrice: document.getElementById("resultRecommendedPrice"),
  resultStatus: document.getElementById("resultStatus"),
  resultRegion: document.getElementById("resultRegion"),
  resultCountryCode: document.getElementById("resultCountryCode"),
  resultScore: document.getElementById("resultScore"),
  detailsLink: document.getElementById("detailsLink"),
  repricePageLink: document.getElementById("repricePageLink")
};

let currentOpportunityId = null;
let mode = "create";

function setStatus(type, text) {
  els.statusBadge.className = `status-badge ${type}`;
  els.statusBadge.textContent = text;
}

function setSubmitState(disabled, label) {
  els.submitBtn.disabled = disabled;
  els.submitBtn.textContent = label;
}

function asOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asOptionalString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "--";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parsed);
}

function formatPct(value) {
  if (value === null || value === undefined || value === "") return "--";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return `${parsed.toFixed(2)}%`;
}

function formatScore(value) {
  if (value === null || value === undefined || value === "") return "--";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value);
}

function normalizeCustomerStatus(rawStatus, hasLookup) {
  if (!hasLookup) return "New Customer";
  const value = String(rawStatus || "").trim();
  if (!value) return "New Customer";
  if (value.toLowerCase() === "churned" || value.toLowerCase() === "churn") return "Returning Customer";
  return value;
}

function setCustomerStatusDisplay(statusValue) {
  const safeValue = statusValue || "New Customer";
  els.customerStatus.value = safeValue;
  els.customerStatusDisplay.textContent = safeValue;
}

function buildUrl(path) {
  const baseUrl = (CONFIG.baseUrl || "").trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("Base URL is required.");
  return `${baseUrl}${path}`;
}

async function fetchAccountMetadata(accountId) {
  const route = String(routes.accountDetails || "").trim();
  if (!route || !route.includes("{accountId}")) return null;

  const url = buildUrl(route.replace("{accountId}", encodeURIComponent(accountId)));
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

async function handleAccountLookup() {
  const accountId = asOptionalString(els.existingAccount.value);
  if (!accountId) {
    setCustomerStatusDisplay("New Customer");
    els.accountLookupNote.textContent = "No account entered. This will be treated as New Customer.";
    return;
  }

  try {
    const metadata = await fetchAccountMetadata(accountId);
    if (!metadata) {
      setCustomerStatusDisplay("New Customer");
      els.accountLookupNote.textContent = "No matching account was found. This will be sent as New Customer.";
      return;
    }

    if (metadata.customerType) els.customerType.value = metadata.customerType;
    if (metadata.industryType) els.industryType.value = metadata.industryType;
    if (metadata.customerRegion) els.customerRegion.value = metadata.customerRegion;
    if (metadata.countryCode) els.countryCode.value = metadata.countryCode;
    if (metadata.creditRating != null) els.creditRating.value = metadata.creditRating;

    const normalizedStatus = normalizeCustomerStatus(metadata.customerStatus, true);
    setCustomerStatusDisplay(normalizedStatus);
    if (normalizedStatus === "Returning Customer") {
      els.accountLookupNote.textContent = "Account found with Churned status; sent as Returning Customer.";
    } else {
      els.accountLookupNote.textContent = `Account found; status set to ${normalizedStatus}.`;
    }
  } catch {
    setCustomerStatusDisplay("New Customer");
    els.accountLookupNote.textContent = "Lookup is unavailable right now. This will be sent as New Customer.";
  }
}

function buildPricingInput() {
  const targetMargin = asOptionalNumber(els.targetMarginPctInput.value);
  if (targetMargin === null) throw new Error("Target Margin % is required.");

  return {
    targetMarginPctInput: targetMargin,
    manualAdjustmentPctInput: asOptionalNumber(els.manualAdjustmentPctInput.value) ?? 0,
    competitorPriceInput: asOptionalNumber(els.competitorPriceInput.value),
    demandIndexInput: asOptionalNumber(els.demandIndexInput.value),
    inventoryQtyInput: asOptionalNumber(els.subscriptionQtyInput.value)
  };
}

function buildCreatePayload() {
  const opportunityName = asOptionalString(els.opportunityName.value);
  if (!opportunityName) throw new Error("Opportunity Name is required.");

  return {
    opportunity: {
      opportunityName,
      accountId: asOptionalString(els.existingAccount.value),
      customerType: asOptionalString(els.customerType.value),
      industryType: asOptionalString(els.industryType.value),
      customerRegion: asOptionalString(els.customerRegion.value),
      countryCode: asOptionalString(els.countryCode.value),
      customerStatus: asOptionalString(els.customerStatus.value) || "New Customer",
      creditRating: asOptionalNumber(els.creditRating.value),
      serviceCategory: asOptionalString(els.serviceCategory.value),
      planTier: asOptionalString(els.planTier.value),
      planName: asOptionalString(els.planName.value),
      serviceName: asOptionalString(els.serviceName.value),
      subscriptionQuantity: asOptionalNumber(els.subscriptionQtyInput.value)
    },
    billingContext: {},
    pricingInput: buildPricingInput()
  };
}

function buildRepricePayload() {
  return {
    changeType: "Repriced",
    billingContext: {},
    pricingInput: buildPricingInput()
  };
}

function renderResponse(data) {
  const pricing = data.pricing || data;
  els.resultOpportunityId.textContent = data.opportunityId || "--";
  els.resultQuoteId.textContent = data.quoteId || "--";
  els.resultFinalPrice.textContent = formatCurrency(pricing.finalPrice ?? data.finalPrice);
  els.resultMargin.textContent = formatPct(pricing.expectedMarginPct ?? data.expectedMarginPct);
  els.resultRecommendedPrice.textContent = formatCurrency(pricing.recommendedPrice ?? data.recommendedPrice);
  els.resultScore.textContent = formatScore(pricing.score ?? data.score);
  els.resultStatus.textContent = els.customerStatus.value || "New Customer";
  els.resultRegion.textContent = asOptionalString(els.customerRegion.value) || "--";
  els.resultCountryCode.textContent = asOptionalString(els.countryCode.value) || "--";
}

function enableActionLinks(opportunityId) {
  const encoded = encodeURIComponent(opportunityId);
  els.detailsLink.href = `./opportunity.html?opportunityId=${encoded}`;
  els.repricePageLink.href = `./reprice.html?opportunityId=${encoded}`;
  els.detailsLink.classList.remove("disabled-link");
  els.repricePageLink.classList.remove("disabled-link");
  els.detailsLink.removeAttribute("aria-disabled");
  els.repricePageLink.removeAttribute("aria-disabled");
}

function resetFormState() {
  els.opportunityName.value = "";
  els.existingAccount.value = "";
  els.customerType.value = "";
  els.industryType.value = "";
  els.customerRegion.value = "";
  els.countryCode.value = "";
  els.creditRating.value = "";
  els.serviceCategory.value = "";
  els.planTier.value = "";
  els.planName.value = "";
  els.serviceName.value = "";
  els.targetMarginPctInput.value = "28.5000";
  els.manualAdjustmentPctInput.value = "0.0000";
  els.competitorPriceInput.value = "";
  els.demandIndexInput.value = "";
  els.subscriptionQtyInput.value = "";
  currentOpportunityId = null;
  mode = "create";
  els.resultOpportunityId.textContent = "--";
  els.resultQuoteId.textContent = "--";
  els.resultFinalPrice.textContent = "--";
  els.resultMargin.textContent = "--";
  els.resultRecommendedPrice.textContent = "--";
  els.resultStatus.textContent = "--";
  els.resultRegion.textContent = "--";
  els.resultCountryCode.textContent = "--";
  els.resultScore.textContent = "--";
  els.detailsLink.href = "./history.html";
  els.repricePageLink.href = "./history.html";
  els.detailsLink.classList.add("disabled-link");
  els.repricePageLink.classList.add("disabled-link");
  els.detailsLink.setAttribute("aria-disabled", "true");
  els.repricePageLink.setAttribute("aria-disabled", "true");
  setCustomerStatusDisplay("New Customer");
  els.accountLookupNote.textContent = "No account entered. This will be treated as New Customer.";
  setStatus("idle", "Idle");
  setSubmitState(false, "⚡ Send Request");
}

async function submitRequest() {
  let url;
  let payload;

  try {
    if (mode === "create") {
      payload = buildCreatePayload();
      url = buildUrl(String(routes.createQuote || "/quotes").trim());
    } else {
      if (!currentOpportunityId) throw new Error("Missing opportunity ID for repricing.");
      const path = String(routes.opportunityReprice || "/opportunities/{opportunityId}/reprice")
        .replace("{opportunityId}", currentOpportunityId);
      payload = buildRepricePayload();
      url = buildUrl(path);
    }
  } catch (error) {
    setStatus("error", "Invalid request");
    return;
  }

  setSubmitState(true, mode === "create" ? "Sending..." : "Repricing...");
  setStatus("loading", mode === "create" ? "Creating" : "Repricing");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      setStatus("error", `HTTP ${response.status}`);
      setSubmitState(false, mode === "create" ? "⚡ Send Request" : "⟳ Reprice");
      return;
    }

    renderResponse(data);
    setStatus("success", "Success");

    if (data.opportunityId) {
      currentOpportunityId = String(data.opportunityId);
      enableActionLinks(currentOpportunityId);
    }

    mode = "reprice";
    setSubmitState(false, "⟳ Reprice");
  } catch {
    setStatus("error", "Request failed");
    setSubmitState(false, mode === "create" ? "⚡ Send Request" : "⟳ Reprice");
  }
}

els.existingAccount.addEventListener("blur", handleAccountLookup);
els.existingAccount.addEventListener("change", handleAccountLookup);
els.submitBtn.addEventListener("click", submitRequest);
if (els.resetBtn) els.resetBtn.addEventListener("click", resetFormState);

setCustomerStatusDisplay("New Customer");
setStatus("idle", "Idle");
setSubmitState(false, "⚡ Send Request");
