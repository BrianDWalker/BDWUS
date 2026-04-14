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

  els.opportunityId.textContent = opp.opportunityId ? String(opp.opportunityId) : "--";
  els.opportunityName.textContent = opp.opportunityName ? String(opp.opportunityName) : "--";
  els.createdAt.textContent = formatDate(data.createdAtUtc);

  els.latestQuoteId.textContent = opp.quoteId ? String(opp.quoteId) : "--";
  els.latestFinal.textContent = formatCurrency(opp.finalPrice);
  els.latestRecommended.textContent = formatCurrency(opp.recommendedPrice);
  els.latestMargin.textContent = formatPct(opp.expectedMarginPct);
  els.latestScore.textContent = formatScore(opp.score);

  if (els.customerType) els.customerType.textContent = renderMetadataValue(opp.customerType);
  if (els.industryType) els.industryType.textContent = renderMetadataValue(opp.industryType);
  if (els.customerRegion) els.customerRegion.textContent = renderMetadataValue(opp.customerRegion);
  if (els.countryCode) els.countryCode.textContent = renderMetadataValue(opp.countryCode);
  if (els.customerStatus) els.customerStatus.textContent = renderStatusValue(opp.customerStatus);
  if (els.creditRating) els.creditRating.textContent = renderMetadataValue(opp.creditRating);
  if (els.planTier) els.planTier.textContent = renderMetadataValue(opp.planTier);
  if (els.planName) els.planName.textContent = renderMetadataValue(opp.planName);
  if (els.serviceName) els.serviceName.textContent = renderMetadataValue(opp.serviceName);
  if (els.serviceCategory) els.serviceCategory.textContent = renderMetadataValue(opp.serviceCategory);
  if (els.subscriptionQuantity) els.subscriptionQuantity.textContent = renderMetadataValue(opp.subscriptionQuantity);

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
