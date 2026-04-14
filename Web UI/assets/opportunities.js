// Opportunities list page script: fetch the available opportunities from the pricing service,
// support live search filtering, and render navigation links for detail and reprice workflows.
// This page is intentionally read-only from a quote creation perspective; it only displays existing work items.
const CONFIG = window.APP_CONFIG || {};
const routes = CONFIG.routes || {};

const els = {
  statusBadge: document.getElementById("statusBadge"),
  refreshBtn: document.getElementById("refreshBtn"),
  searchInput: document.getElementById("searchInput"),
  opportunitiesWrap: document.getElementById("opportunitiesWrap"),
  resultCount: document.getElementById("resultCount")
};

let allOpportunities = [];

function setStatus(type, text) {
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

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleString();
}

function buildUrl(path) {
  // Build a backend endpoint URL from the configured baseUrl and a relative path.
  // This helper keeps the URL generation logic centralized so the entire app
  // can rely on the same origin/configured service endpoint behavior.
  const baseUrl = (CONFIG.baseUrl || "").trim().replace(/\/$/, "");
  if (!baseUrl) throw new Error("Base URL is required.");
  return `${baseUrl}${path}`;
}

function render(items) {
  els.resultCount.textContent = String(items.length);

  if (!Array.isArray(items) || items.length === 0) {
    els.opportunitiesWrap.innerHTML = '<div class="empty-state">No matching opportunities found.</div>';
    return;
  }

  const rows = items.map(item => {
    const opportunityId = escapeHtml(item.opportunityId);
    const detailsHref = `./opportunity.html?opportunityId=${encodeURIComponent(opportunityId)}`;
    const repriceHref = `./reprice.html?opportunityId=${encodeURIComponent(opportunityId)}`;
    return `
      <tr>
        <td class="mono">${opportunityId}</td>
        <td>${escapeHtml(item.opportunityName)}</td>
        <td>${formatDate(item.createdAtUtc)}</td>
        <td class="actions-cell">
          <a class="nav-link table-action" href="${detailsHref}">☰ Details</a>
          <a class="nav-link table-action primary-link" href="${repriceHref}">⟳ Reprice</a>
        </td>
      </tr>
    `;
  }).join("");

  els.opportunitiesWrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Opportunity ID</th>
          <th>Opportunity Name</th>
          <th>Date Created</th>
          <th class="actions-head">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function applyFilter() {
  // Filter the loaded opportunities list immediately when the user types.
  const term = (els.searchInput.value || "").trim().toLowerCase();
  if (!term) {
    render(allOpportunities);
    return;
  }

  const filtered = allOpportunities.filter(item => {
    const idText = String(item.opportunityId || "").toLowerCase();
    const nameText = String(item.opportunityName || "").toLowerCase();
    return idText.includes(term) || nameText.includes(term);
  });

  render(filtered);
}

async function loadOpportunities() {
  // Load all opportunities from the pricing service and then render the table.
  setStatus("loading", "Loading");

  try {
    const path = String(routes.opportunities || "/opportunities").trim();
    const response = await fetch(buildUrl(path));
    const text = await response.text();
    const data = text ? JSON.parse(text) : [];

    if (!response.ok) {
      setStatus("error", `HTTP ${response.status}`);
      els.opportunitiesWrap.innerHTML = `<div class="empty-state">${escapeHtml(data.detail || "Failed to load opportunities.")}</div>`;
      return;
    }

    allOpportunities = Array.isArray(data) ? data : [];
    applyFilter();
    setStatus("success", "Loaded");
  } catch (error) {
    setStatus("error", "Failed");
    els.opportunitiesWrap.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

els.refreshBtn.addEventListener("click", loadOpportunities);
els.searchInput.addEventListener("input", applyFilter);
setStatus("idle", "Idle");
loadOpportunities();
