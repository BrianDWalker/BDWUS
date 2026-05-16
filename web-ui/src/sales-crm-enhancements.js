const SALES_PATHS = ["#/sales", "#/quotes", "#sales"];

function isSalesRoute() {
  const hash = window.location.hash || "";
  return SALES_PATHS.some(path => hash.startsWith(path)) || hash.includes("/sales");
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

const salesData = {
  opportunities: [
    {
      id: "OPP-812",
      account: "Apex Health",
      accountNumber: "CUST-1001",
      quote: "Q-2048",
      serviceMix: "Fiber 1G, Cloud Voice, SLA Support",
      locations: 12,
      stage: "Quote Approval",
      mrc: 12000,
      nrc: 12500,
      tcv: 444500,
      margin: 39.8,
      serviceability: "On-net",
      pricingRisk: "Medium",
      nextAction: "Finance approval before customer send"
    },
    {
      id: "OPP-827",
      account: "Summit Manufacturing",
      accountNumber: "CUST-1004",
      quote: "Q-2052",
      serviceMix: "IoT SIM, Private APN, Device Care",
      locations: 34,
      stage: "Custom Pricing",
      mrc: 2728,
      nrc: 10800,
      tcv: 207010,
      margin: 22.5,
      serviceability: "Wireless footprint",
      pricingRisk: "High",
      nextAction: "Rework offer bundle to recover margin"
    },
    {
      id: "OPP-833",
      account: "Brightstar Retail",
      accountNumber: "CUST-1002",
      quote: "Q-2061",
      serviceMix: "Fiber 500, Mobile Plus, failover",
      locations: 38,
      stage: "Customer Review",
      mrc: 2358,
      nrc: 8200,
      tcv: 93100,
      margin: 35.7,
      serviceability: "Mixed on-net / near-net",
      pricingRisk: "Low",
      nextAction: "Confirm install windows and contract term"
    }
  ],
  pricingActions: [
    "Run custom pricing",
    "Apply eligible promo",
    "Check serviceability",
    "Submit approval",
    "Create order draft"
  ]
};

function removeExisting() {
  document.querySelectorAll(".sales-crm-injected, .sales-crm-modal-backdrop").forEach(node => node.remove());
}

function showCrmToast(message) {
  const existing = document.querySelector(".sales-crm-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "sales-crm-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2400);
}

function openModal(title, bodyHtml, footerHtml = "") {
  document.querySelectorAll(".sales-crm-modal-backdrop").forEach(node => node.remove());
  const backdrop = document.createElement("div");
  backdrop.className = "sales-crm-modal-backdrop";
  backdrop.innerHTML = `
    <section class="sales-crm-modal" role="dialog" aria-modal="true">
      <header>
        <div>
          <strong>${title}</strong>
          <span>Telecom sales CRM workflow</span>
        </div>
        <button type="button" class="sales-crm-close" aria-label="Close">×</button>
      </header>
      <div class="sales-crm-modal-body">${bodyHtml}</div>
      <footer>${footerHtml || `<button type="button" class="button sales-crm-primary-action">Save workflow</button><button type="button" class="ghost-button sales-crm-secondary-action">Cancel</button>`}</footer>
    </section>
  `;
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop || event.target.closest(".sales-crm-close") || event.target.closest(".sales-crm-secondary-action")) backdrop.remove();
    if (event.target.closest(".sales-crm-primary-action")) {
      backdrop.remove();
      showCrmToast(`${title} saved`);
    }
  });
  document.body.appendChild(backdrop);
}

function opportunityCaptureForm() {
  return `
    <form class="sales-crm-form">
      <label>Account Number<input placeholder="CUST-1001" value="CUST-1001"></label>
      <label>Opportunity Name<input placeholder="Multi-site fiber and wireless expansion"></label>
      <label>Service Family<select><option>Wireline / Fiber</option><option>Wireless / Mobility</option><option>Transitional Services</option><option>Managed Network</option><option>Voice / UCaaS</option></select></label>
      <label>Locations<input placeholder="12"></label>
      <label>Estimated MRC<input placeholder="$12,000"></label>
      <label>Estimated NRC<input placeholder="$12,500"></label>
      <label>Contract Term<select><option>36 months</option><option>24 months</option><option>12 months</option><option>Month to month</option></select></label>
      <label>Sales Stage<select><option>Discovery</option><option>Solutioning</option><option>Quote</option><option>Custom Pricing</option><option>Approval</option></select></label>
      <label class="full">Customer Need<textarea placeholder="Bandwidth expansion, wireless backup, managed router, installation constraints..."></textarea></label>
    </form>
  `;
}

function quoteDeskForm(opportunity = salesData.opportunities[0]) {
  return `
    <div class="sales-crm-quote-workspace">
      <div class="sales-crm-quote-summary">
        <span>${opportunity.account} · ${opportunity.id}</span>
        <strong>${opportunity.serviceMix}</strong>
        <small>${opportunity.locations} locations · ${opportunity.serviceability}</small>
      </div>
      <div class="sales-crm-form compact">
        <label>Quote Number<input value="${opportunity.quote}"></label>
        <label>Term<select><option>36 months</option><option>24 months</option><option>12 months</option></select></label>
        <label>MRC<input value="${money(opportunity.mrc)}"></label>
        <label>NRC<input value="${money(opportunity.nrc)}"></label>
        <label>Discount<input value="12%"></label>
        <label>Target Margin<input value="32%"></label>
      </div>
      <table class="sales-crm-mini-table">
        <thead><tr><th>Line</th><th>Product</th><th>Billing Type</th><th>MRC</th><th>Cost</th><th>Margin</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Fiber / DIA Access</td><td>Recurring</td><td>${money(Math.round(opportunity.mrc * 0.66))}</td><td>${money(Math.round(opportunity.mrc * 0.39))}</td><td>40%</td></tr>
          <tr><td>2</td><td>Managed Router / CPE</td><td>Recurring</td><td>${money(Math.round(opportunity.mrc * 0.18))}</td><td>${money(Math.round(opportunity.mrc * 0.12))}</td><td>33%</td></tr>
          <tr><td>3</td><td>Installation / Activation</td><td>One-time</td><td>${money(opportunity.nrc)}</td><td>${money(Math.round(opportunity.nrc * 0.58))}</td><td>42%</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function approvalWorkflow() {
  return `
    <div class="sales-crm-approval-flow">
      ${["Draft", "Pricing Review", "Sales Manager", "Finance", "Approved"].map((step, index) => `<div class="${index < 2 ? "complete" : index === 2 ? "active" : ""}"><b>${index + 1}</b><span>${step}</span></div>`).join("")}
    </div>
    <div class="sales-crm-form compact">
      <label>Approval Reason<select><option>Margin below guardrail</option><option>Discount exception</option><option>Custom term</option><option>Competitive response</option></select></label>
      <label>Requested By<input value="Sales Operations"></label>
      <label>Floor Price<input value="$9,750 MRC"></label>
      <label>Recommended Price<input value="$10,900 MRC"></label>
      <label class="full">Approval Notes<textarea>Customer requires multi-location ramp, wireless backup, and custom install timing.</textarea></label>
    </div>
  `;
}

function buildCockpit() {
  const openApprovals = salesData.opportunities.filter(item => ["Medium", "High"].includes(item.pricingRisk)).length;
  const totalTcv = salesData.opportunities.reduce((total, item) => total + item.tcv, 0);
  return `
    <section class="sales-crm-injected sales-crm-command-center">
      <div class="sales-crm-command-copy">
        <span>Telecom CRM Command Center</span>
        <h2>Sales, quote desk, serviceability, and custom pricing in one workflow.</h2>
        <p>Use this workspace to move telecom opportunities from discovery to serviceable quote, pricing approval, and order draft.</p>
      </div>
      <div class="sales-crm-command-actions">
        <button type="button" data-sales-action="new-opportunity" class="button">New Opportunity</button>
        <button type="button" data-sales-action="quote-desk" class="ghost-button">Open Quote Desk</button>
        <button type="button" data-sales-action="pricing-approval" class="ghost-button">Approval Queue</button>
      </div>
      <div class="sales-crm-kpis">
        <div><span>Telecom Pipeline</span><strong>${money(totalTcv)}</strong><small>Wireline, wireless, managed services</small></div>
        <div><span>Pricing Exceptions</span><strong>${openApprovals}</strong><small>Margin or discount review</small></div>
        <div><span>Serviceability Reviews</span><strong>3</strong><small>On-net / near-net / wireless</small></div>
        <div><span>Order Ready</span><strong>1</strong><small>Approved quote conversion</small></div>
      </div>
    </section>
  `;
}

function buildDealDesk() {
  return `
    <section class="sales-crm-injected sales-crm-grid">
      <article class="panel sales-crm-work-queue">
        <div class="panel-header"><div><h2>Telecom opportunity work queue</h2><p>Prioritize deals by serviceability, quote status, pricing risk, and next action.</p></div></div>
        <div class="panel-body">
          <div class="sales-crm-cards">
            ${salesData.opportunities.map(item => `
              <button type="button" class="sales-crm-card" data-sales-action="quote-desk" data-opportunity="${item.id}">
                <div><strong>${item.account}</strong><span>${item.id} · ${item.accountNumber} · ${item.quote}</span></div>
                <p>${item.serviceMix}</p>
                <div class="sales-crm-card-meta">
                  <span>${item.locations} locations</span>
                  <span>${item.serviceability}</span>
                  <span class="risk-${item.pricingRisk.toLowerCase()}">${item.pricingRisk} risk</span>
                </div>
                <div class="sales-crm-card-footer"><b>${money(item.tcv)}</b><small>${item.nextAction}</small></div>
              </button>
            `).join("")}
          </div>
        </div>
      </article>
      <aside class="sales-crm-side-stack">
        <article class="panel">
          <div class="panel-header"><div><h2>Quote desk tools</h2><p>Actions a telecom seller/pricer needs during deal review.</p></div></div>
          <div class="panel-body sales-crm-tool-list">
            ${salesData.pricingActions.map(action => `<button type="button" data-sales-action="${action.toLowerCase().replaceAll(" ", "-")}">${action}<span>Open workflow</span></button>`).join("")}
          </div>
        </article>
        <article class="panel">
          <div class="panel-header"><div><h2>Serviceability snapshot</h2><p>Quote quality depends on availability, cost, and install complexity.</p></div></div>
          <div class="panel-body sales-crm-serviceability">
            <div><span>On-net</span><b>1</b></div><div><span>Near-net</span><b>1</b></div><div><span>Wireless</span><b>1</b></div><div><span>Requires SE</span><b>2</b></div>
          </div>
        </article>
      </aside>
    </section>
  `;
}

function injectSalesWorkspace() {
  if (!isSalesRoute()) {
    removeExisting();
    return;
  }
  const content = document.querySelector("main.content");
  if (!content || content.querySelector(".sales-crm-command-center")) return;

  const pageHeader = content.querySelector(".topbar");
  if (!pageHeader) return;

  pageHeader.insertAdjacentHTML("afterend", buildCockpit() + buildDealDesk());
}

function handleSalesAction(event) {
  const trigger = event.target.closest("[data-sales-action]");
  if (!trigger) return;
  const action = trigger.dataset.salesAction;
  const opportunityId = trigger.dataset.opportunity;
  const opportunity = salesData.opportunities.find(item => item.id === opportunityId) || salesData.opportunities[0];

  if (action === "new-opportunity") {
    openModal("New telecom opportunity", opportunityCaptureForm());
    return;
  }
  if (["quote-desk", "run-custom-pricing", "edit-pricing"].includes(action)) {
    openModal("Quote desk / custom pricing", quoteDeskForm(opportunity), `<button type="button" class="button sales-crm-primary-action">Save quote</button><button type="button" class="ghost-button" data-sales-action="pricing-approval">Submit approval</button><button type="button" class="ghost-button sales-crm-secondary-action">Close</button>`);
    return;
  }
  if (["pricing-approval", "submit-approval"].includes(action)) {
    openModal("Pricing approval workflow", approvalWorkflow(), `<button type="button" class="button sales-crm-primary-action">Submit approval</button><button type="button" class="ghost-button sales-crm-secondary-action">Cancel</button>`);
    return;
  }
  if (action === "check-serviceability") {
    openModal("Serviceability check", `<div class="sales-crm-service-check"><strong>${opportunity.account}</strong><p>${opportunity.serviceability}</p><ul><li>Wireline footprint checked</li><li>Wireless backup coverage checked</li><li>Install complexity estimated</li><li>Network engineering review queued if needed</li></ul></div>`);
    return;
  }
  if (action === "apply-eligible-promo") {
    openModal("Eligible promos", `<table class="sales-crm-mini-table"><thead><tr><th>Promo</th><th>Eligibility</th><th>Impact</th></tr></thead><tbody><tr><td>Fiber Winback</td><td>36 mo term</td><td>12% MRC discount</td></tr><tr><td>Install Waiver</td><td>Multi-location</td><td>NRC reduction</td></tr><tr><td>Wireless Backup Bundle</td><td>Branch sites</td><td>Improves attach</td></tr></tbody></table>`);
    return;
  }
  if (action === "create-order-draft") {
    showCrmToast("Order draft created from approved quote");
    window.location.hash = "/orders";
  }
}

function enhanceExistingButtons() {
  if (!isSalesRoute()) return;
  document.querySelectorAll("button").forEach(button => {
    const label = button.textContent.trim().toLowerCase();
    if (button.dataset.salesAction) return;
    if (label === "create quote" || label === "edit pricing") button.dataset.salesAction = "quote-desk";
    if (label === "submit approval") button.dataset.salesAction = "pricing-approval";
    if (label === "add activity") button.addEventListener("click", () => showCrmToast("Activity added to telecom account timeline"), { once: true });
  });
}

function refreshSalesEnhancements() {
  injectSalesWorkspace();
  enhanceExistingButtons();
}

window.addEventListener("hashchange", () => window.setTimeout(refreshSalesEnhancements, 80));
document.addEventListener("click", handleSalesAction);

const observer = new MutationObserver(() => {
  window.clearTimeout(refreshSalesEnhancements.timer);
  refreshSalesEnhancements.timer = window.setTimeout(refreshSalesEnhancements, 80);
});

window.addEventListener("DOMContentLoaded", () => {
  observer.observe(document.body, { childList: true, subtree: true });
  refreshSalesEnhancements();
});

window.setTimeout(() => {
  observer.observe(document.body, { childList: true, subtree: true });
  refreshSalesEnhancements();
}, 300);
