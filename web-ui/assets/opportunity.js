// Opportunity details page script: query the opportunity details API, display the current quote snapshot,
// display account/service metadata, and render the history table as a timeline of quote revisions.
// This file intentionally avoids showing a separate version number in the table; each quote is identified by its quote ID.
const CONFIG = window.APP_CONFIG || {};
const routes = CONFIG.routes || {};

const els = {
  statusBadge: document.getElementById("statusBadge"),
  opportunityId: document.getElementById("opportunityId"),
  createdAt: document.getElementById("createdAt"),
  opportunityName: document.getElementById("opportunityName"),
  latestQuoteId: document.getElementById("latestQuoteId"),
  latestFinal: document.getElementById("latestFinal"),
  latestRecommended: document.getElementById("latestRecommended"),
  latestMargin: document.getElementById("latestMargin"),
  latestScore: document.getElementById("latestScore"),
  customerType: document.getElementById("customerType"),
  industryType: document.getElementById("industryType"),
  customerRegion: document.getElementById("customerRegion"),
  countryCode: document.getElementById("countryCode"),
  customerStatus: document.getElementById("customerStatus"),
  creditRating: document.getElementById("creditRating"),
  planTier: document.getElementById("planTier"),
  contractTermMonths: document.getElementById("contractTermMonths"),
  planName: document.getElementById("planName"),
  serviceName: document.getElementById("serviceName"),
  serviceCategory: document.getElementById("serviceCategory"),
  subscriptionQuantity: document.getElementById("subscriptionQuantity"),
  repriceLink: document.getElementById("repriceLink"),
  historyWrap: document.getElementById("historyWrap")
};

function setStatus(type, text) {
  // Update the status badge to show loading, success, or error state.
  els.statusBadge.className = `status-badge ${type}`;
  els.statusBadge.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function formatDate(value) {
  // Convert the raw timestamp to a readable local date/time string.
  // If the value is not a valid date, escape it and render the raw fallback.
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString();
}

function renderMetadataValue(value, fallback = "--") {
  return value ? escapeHtml(value) : fallback;
}

function renderStatusValue(value) {
  return value ? escapeHtml(value) : "New Customer";
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
  // Build a service endpoint URL by replacing the placeholder with the current ID.
  const baseUrl = (CONFIG.baseUrl || "").trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("Base URL is required.");
  if (!idValue) throw new Error(`${idKey} is required.`);
  return `${baseUrl}${template.replace(`{${idKey}}`, idValue)}`;
}

function renderHistory(items) {
  // The UI shows quote revisions by Quote ID instead of a separate version number.
  // This matches the new behavior where each repriced quote gets a distinct QuoteId.
  if (!Array.isArray(items) || items.length === 0) {
    els.historyWrap.innerHTML = '<div class="empty-state">No quote history found.</div>';
    return;
  }

  const rows = items.map(item => `
    <tr>
      <td class="mono">${escapeHtml(item.quoteId)}</td>
      <td>${escapeHtml(item.changeType)}</td>
      <td>${item.isCurrentVersion ? "Yes" : "No"}</td>
      <td>${escapeHtml(item.changedBy || "")}</td>
      <td>${formatDate(item.changedAtUtc || "")}</td>
      <td>${formatCurrency(item.finalPrice)}</td>
      <td>${formatPct(item.expectedMarginPct)}</td>
      <td>${formatScore(item.score)}</td>
    </tr>
  `).join("");

  els.historyWrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Quote ID</th>
          <th>Change</th>
          <th>Current</th>
          <th>Changed By</th>
          <th>Changed At</th>
          <th>Final</th>
          <th>Margin</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderDetails(data) {
  // Use the opportunity details endpoint response to fill the summary card and history table.
  const opp = data.opportunity || {};

  setNodeValue(els.opportunityId, opp.opportunityId ? String(opp.opportunityId) : "--");
  setNodeValue(els.opportunityName, opp.opportunityName ? String(opp.opportunityName) : "--");
  setNodeValue(els.createdAt, formatDate(data.createdAtUtc));

  setNodeValue(els.latestQuoteId, opp.quoteId ? String(opp.quoteId) : "--");
  setNodeValue(els.latestFinal, formatCurrency(opp.finalPrice));
  setNodeValue(els.latestRecommended, formatCurrency(opp.recommendedPrice));
  setNodeValue(els.latestMargin, formatPct(opp.expectedMarginPct));
  setNodeValue(els.latestScore, formatScore(opp.score));

  setNodeValue(els.customerType, renderMetadataValue(opp.customerType));
  setNodeValue(els.industryType, renderMetadataValue(opp.industryType));
  setNodeValue(els.customerRegion, renderMetadataValue(opp.customerRegion));
  setNodeValue(els.countryCode, renderMetadataValue(opp.countryCode));
  setNodeValue(els.customerStatus, renderStatusValue(opp.customerStatus));
  setNodeValue(els.creditRating, renderMetadataValue(opp.creditRating));
  setNodeValue(els.planTier, renderMetadataValue(opp.planTier));
  setNodeValue(els.contractTermMonths, renderMetadataValue(opp.contractTermMonths));
  setNodeValue(els.planName, renderMetadataValue(opp.planName));
  setNodeValue(els.serviceName, renderMetadataValue(opp.serviceName));
  setNodeValue(els.serviceCategory, renderMetadataValue(opp.serviceCategory));
  setNodeValue(els.subscriptionQuantity, renderMetadataValue(opp.subscriptionQuantity));

  if (els.repriceLink) {
    els.repriceLink.href = `./reprice.html?opportunityId=${encodeURIComponent(opp.opportunityId || "")}`;
  }

  renderHistory(data.quoteHistory || []);
}

async function loadDetails() {
  // Load the opportunity details from the backend using the opportunityId query string.
  // We render both the summary card and the quote history table from the response.
  const opportunityId = getOpportunityId();
  if (!opportunityId) {
    setStatus("error", "Missing ID");
    els.historyWrap.innerHTML = '<div class="empty-state">Missing opportunityId in URL.</div>';
    return;
  }

  setStatus("loading", "Loading");

  try {
    const template = String(routes.opportunityDetails || "/opportunities/{opportunityId}/details").trim();
    const url = buildUrl(template, "opportunityId", opportunityId);
    const response = await fetch(url);
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      setStatus("error", `HTTP ${response.status}`);
      els.historyWrap.innerHTML = `<div class="empty-state">${escapeHtml(data.detail || "Failed to load details.")}</div>`;
      return;
    }

    renderDetails(data);
    setStatus("success", "Loaded");
  } catch (error) {
    setStatus("error", "Failed");
    els.historyWrap.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

loadDetails();
setStatus("idle", "Idle");
