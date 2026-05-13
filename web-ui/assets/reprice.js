// Reprice page script: load the current opportunity metadata, render the existing quote snapshot,
// expose the repricing inputs, and submit a new repricing request to the backend.
// It keeps the opportunity metadata readonly so the repricing action is applied to the correct customer
// and service context without allowing the user to accidentally change the underlying opportunity details.
const CONFIG = window.APP_CONFIG || {};
const routes = CONFIG.routes || {};

const els = {
  statusBadge: document.getElementById("statusBadge"),
  opportunityId: document.getElementById("opportunityId"),
  currentQuoteId: document.getElementById("currentQuoteId"),
  targetMarginPctInput: document.getElementById("targetMarginPctInput"),
  manualAdjustmentPctInput: document.getElementById("manualAdjustmentPctInput"),
  competitorPriceInput: document.getElementById("competitorPriceInput"),
  demandIndexInput: document.getElementById("demandIndexInput"),
  subscriptionQtyInput: document.getElementById("subscriptionQtyInput"),
  costPerUnitInput: document.getElementById("costPerUnitInput"),
  contractTermMonthsInput: document.getElementById("contractTermMonthsInput"),
  submitBtn: document.getElementById("submitBtn"),
  resultQuoteId: document.getElementById("resultQuoteId"),
  resultFinalPrice: document.getElementById("resultFinalPrice"),
  resultMargin: document.getElementById("resultMargin"),
  resultRecommendedPrice: document.getElementById("resultRecommendedPrice"),
  resultScore: document.getElementById("resultScore"),
  backLink: document.getElementById("backLink"),
  customerType: document.getElementById("customerType"),
  industryType: document.getElementById("industryType"),
  customerRegion: document.getElementById("customerRegion"),
  countryCode: document.getElementById("countryCode"),
  customerStatus: document.getElementById("customerStatus"),
  creditRating: document.getElementById("creditRating"),
  planTier: document.getElementById("planTier"),
  planName: document.getElementById("planName"),
  serviceName: document.getElementById("serviceName"),
  serviceCategory: document.getElementById("serviceCategory"),
};

function setStatus(type, text) {
  // Update the status badge and make the current page condition visible to the user.
  // type is one of idle/loading/success/error and controls the badge styling.
  els.statusBadge.className = `status-badge ${type}`;
  els.statusBadge.textContent = text;
}

function asOptionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asOptionalString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

function formatPct(value) {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `${num.toFixed(2)}%`;
}

function formatScore(value) {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : String(value);
}

function renderMetadataValue(value, fallback = "--") {
  return value ? String(value) : fallback;
}

function renderStatusValue(value) {
  return value ? String(value) : "New Customer";
}

function setNodeValue(element, value) {
  if (!element) return;
  if ("value" in element) {
    element.value = value;
    return;
  }
  element.textContent = value;
}

function getOpportunityId() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("opportunityId") || "").trim();
}

function buildUrl(template, idKey, idValue) {
  // Build a full endpoint URL from the base URL and the configured route template.
  // If an ID parameter is supplied, replace the placeholder in the template.
  const baseUrl = (CONFIG.baseUrl || "").trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("Base URL is required.");
  if (idKey && idValue != null) {
    return `${baseUrl}${template.replace(`{${idKey}}`, idValue)}`;
  }
  return `${baseUrl}${template}`;
}

function buildPayload() {
  // Validate the required repricing inputs and assemble the payload for the API.
  // The current quote metadata itself is not posted here because it is already associated
  // with the opportunity on the backend.
  const targetMarginPctInput = asOptionalNumber(els.targetMarginPctInput.value);
  if (targetMarginPctInput === null) throw new Error("Target Margin % is required.");

  return {
    changeType: "Repriced",
    billingContext: {},
    pricingInput: {
      targetMarginPctInput,
      manualAdjustmentPctInput: asOptionalNumber(els.manualAdjustmentPctInput.value) ?? 0,
      competitorPriceInput: asOptionalNumber(els.competitorPriceInput.value),
      demandIndexInput: asOptionalNumber(els.demandIndexInput.value),
      inventoryQtyInput: asOptionalNumber(els.subscriptionQtyInput.value),
      costPerUnitInput: asOptionalNumber(els.costPerUnitInput.value),
      customerTypeInput: asOptionalString(els.customerType.value),
      contractTermMonthsInput: asOptionalNumber(els.contractTermMonthsInput.value)
    }
  };
}

function renderResponse(data) {
  const pricing = data.pricing || data;
  if (els.resultQuoteId) els.resultQuoteId.textContent = data.quoteId || "--";
  if (els.resultFinalPrice) els.resultFinalPrice.textContent = formatCurrency(pricing.finalPrice ?? data.finalPrice);
  if (els.resultMargin) els.resultMargin.textContent = formatPct(pricing.expectedMarginPct ?? data.expectedMarginPct);
  if (els.resultRecommendedPrice) els.resultRecommendedPrice.textContent = formatCurrency(pricing.recommendedPrice ?? data.recommendedPrice);
  if (els.resultScore) els.resultScore.textContent = formatScore(pricing.score ?? data.score);
}

async function fetchOpportunityDetails(opportunityId) {
  // Request the current opportunity record from the backend.
  // If the fetch fails, we return null and keep the page functional.
  const template = String(routes.opportunityLatest || "/opportunities/{opportunityId}").trim();
  const url = buildUrl(template.replace("{opportunityId}", opportunityId));

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function setReadonlyOpportunityFields(data) {
  // Populate the metadata values from the server and display them in the summary card.
  // These are not editable on the reprice page because they describe the current opportunity context.
  if (!data) return;
  setNodeValue(els.customerType, renderMetadataValue(data.customerType));
  setNodeValue(els.industryType, renderMetadataValue(data.industryType));
  setNodeValue(els.customerRegion, renderMetadataValue(data.customerRegion));
  setNodeValue(els.countryCode, renderMetadataValue(data.countryCode));
  setNodeValue(els.customerStatus, renderStatusValue(data.customerStatus));
  setNodeValue(els.creditRating, renderMetadataValue(data.creditRating));
  setNodeValue(els.planTier, renderMetadataValue(data.planTier));
  setNodeValue(els.planName, renderMetadataValue(data.planName));
  setNodeValue(els.serviceName, renderMetadataValue(data.serviceName));
  setNodeValue(els.serviceCategory, renderMetadataValue(data.serviceCategory));
  if (els.subscriptionQtyInput && data.subscriptionQuantity != null) {
    els.subscriptionQtyInput.value = String(data.subscriptionQuantity);
  }
  if (els.contractTermMonthsInput && data.contractTermMonths != null) {
    els.contractTermMonthsInput.value = String(data.contractTermMonths);
  }
}

async function loadOpportunityDetails() {
  // Load the opportunity metadata and render the read-only summary fields.
  // This is executed immediately so the user can confirm the context before repricing.
  const opportunityId = getOpportunityId();
  if (!opportunityId) return;

  const details = await fetchOpportunityDetails(opportunityId);
  if (details && els.opportunityId) {
    setNodeValue(els.opportunityId, opportunityId);
    if (els.currentQuoteId) {
      setNodeValue(els.currentQuoteId, details.quoteId || details.opportunity?.quoteId || details.currentQuoteId || "--");
    }
    if (els.customerType || els.industryType || els.planTier || els.serviceCategory) {
      setReadonlyOpportunityFields(details);
    }
  }
}

function submit() {
  // Submit the repricing request for the currently loaded opportunity.
  // The page expects an opportunityId query string parameter to exist.
  const opportunityId = getOpportunityId();
  if (!opportunityId) {
    setStatus("error", "Missing ID");
    return;
  }

  let payload;
  let url;
  try {
    payload = buildPayload();
    const template = String(routes.opportunityReprice || "/opportunities/{opportunityId}/reprice").trim();
    url = buildUrl(template, "opportunityId", opportunityId);
  } catch (error) {
    setStatus("error", "Invalid request");
    return;
  }

  // Disable the button while the repricing request is in progress.
  // This prevents duplicate submits while the request is awaiting a response.
  els.submitBtn.disabled = true;
  setStatus("loading", "Sending");

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(async response => {
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { rawText: text };
      }

      if (!response.ok) {
        // The server returned an HTTP failure status for the repricing call.
        // Render whatever error details the API returned so the user knows why the request failed.
        setStatus("error", `HTTP ${response.status}`);
      } else {
        renderResponse(data);
        setStatus("success", "Success");
      }
    })
    .catch(error => {
      // The request failed at the network or parsing layer.
      // This typically means there was no connection, the endpoint timed out, or the response could not be parsed.
      setStatus("error", "Request failed");
    })
    .finally(() => {
      els.submitBtn.disabled = false;
    });
}

function init() {
  const opportunityId = getOpportunityId();
  setNodeValue(els.opportunityId, opportunityId || "--");
  if (els.backLink) els.backLink.href = opportunityId ? `./opportunity.html?opportunityId=${encodeURIComponent(opportunityId)}` : "./history.html";
  loadOpportunityDetails();
}

els.submitBtn.addEventListener("click", submit);
init();
setStatus("idle", "Idle");
