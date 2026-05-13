(function () {
  function showToast(message) {
    let toast = document.querySelector("[data-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.dataset.toast = "";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  }

  function setActiveNav() {
    const current = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav]").forEach(link => {
      const target = (link.getAttribute("href") || "").split("/").pop();
      link.classList.toggle("active", target === current);
    });
  }

  function initTabs() {
    document.querySelectorAll("[data-tab-group]").forEach(group => {
      const buttons = Array.from(group.querySelectorAll("[data-tab]"));
      const panels = Array.from(group.querySelectorAll("[data-panel]"));
      function activate(name) {
        buttons.forEach(button => {
          button.classList.toggle("is-active", button.dataset.tab === name);
          button.setAttribute("aria-selected", button.dataset.tab === name ? "true" : "false");
        });
        panels.forEach(panel => {
          panel.classList.toggle("is-active", panel.dataset.panel === name);
        });
      }
      const active = buttons.find(button => button.classList.contains("is-active")) || buttons[0];
      if (active) activate(active.dataset.tab);
      buttons.forEach(button => button.addEventListener("click", () => activate(button.dataset.tab)));
    });
  }

  function initRangeBars() {
    document.querySelectorAll("[data-fill]").forEach(bar => {
      if (bar.querySelector("span")) return;
      const fill = document.createElement("span");
      fill.style.width = `${Math.max(0, Math.min(100, Number(bar.dataset.fill || 0)))}%`;
      bar.appendChild(fill);
    });
  }

  function initMenus() {
    const closeMenus = () => document.querySelectorAll("[data-menu]").forEach(menu => {
      menu.hidden = true;
    });
    document.querySelectorAll("[data-menu-button]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const menu = document.querySelector(`[data-menu="${button.dataset.menuButton}"]`);
        if (!menu) return;
        const shouldOpen = menu.hidden;
        closeMenus();
        menu.hidden = !shouldOpen;
      });
    });
    document.addEventListener("click", closeMenus);
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenus();
    });
  }

  function initPanels() {
    document.querySelectorAll("[data-open-panel]").forEach(button => {
      button.addEventListener("click", () => {
        const panel = document.querySelector(`[data-panel="${button.dataset.openPanel}"]`);
        if (panel) panel.hidden = false;
      });
    });
    document.querySelectorAll("[data-close-panel]").forEach(button => {
      button.addEventListener("click", () => {
        const panel = button.closest("[data-panel]");
        if (panel) panel.hidden = true;
      });
    });
    document.querySelectorAll("[data-apply-filters]").forEach(button => {
      button.addEventListener("click", () => {
        const panel = button.closest("[data-panel]");
        if (panel) panel.hidden = true;
        showToast("Filters applied");
      });
    });
  }

  function initDetailsModal() {
    let backdrop = document.querySelector("[data-modal-backdrop]");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      backdrop.dataset.modalBackdrop = "";
      backdrop.hidden = true;
      backdrop.innerHTML = `
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div class="side-panel-header">
            <div>
              <strong id="modalTitle" data-modal-title>Details</strong>
              <span>Northstar Telecom</span>
            </div>
            <button class="icon-close" type="button" data-modal-close>×</button>
          </div>
          <p data-modal-body></p>
          <div class="two-column">
            <button class="ghost-button" type="button" data-action-toast="Owner assigned">Assign owner</button>
            <button class="button" type="button" data-action-toast="Workflow advanced">Advance workflow</button>
          </div>
        </section>
      `;
      document.body.appendChild(backdrop);
    }
    const title = backdrop.querySelector("[data-modal-title]");
    const body = backdrop.querySelector("[data-modal-body]");
    document.querySelectorAll("[data-detail-title]").forEach(trigger => {
      if (trigger.dataset.detailBound) return;
      trigger.dataset.detailBound = "true";
      trigger.addEventListener("click", event => {
        event.preventDefault();
        title.textContent = trigger.dataset.detailTitle || "Details";
        body.textContent = trigger.dataset.detailBody || "This operational item is ready for review.";
        backdrop.hidden = false;
      });
    });
    backdrop.querySelectorAll("[data-modal-close]").forEach(button => {
      button.addEventListener("click", () => {
        backdrop.hidden = true;
      });
    });
    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) backdrop.hidden = true;
    });
  }

  function initActions() {
    document.querySelectorAll("[data-action-toast]").forEach(button => {
      if (button.dataset.toastBound) return;
      button.dataset.toastBound = "true";
      button.addEventListener("click", event => {
        event.stopPropagation();
        showToast(button.dataset.actionToast);
      });
    });
  }

  function initSearch() {
    const input = document.querySelector("[data-search-input]");
    const results = document.querySelector("[data-search-results]");
    if (!input || !results) return;
    const items = Array.from(document.querySelectorAll(".panel, .metric-card, .activity-row, .list-item"))
      .map(element => ({
        element,
        label: (element.querySelector("h2, h3, h4, .title, .label, strong") || element).textContent.trim(),
        text: element.textContent.replace(/\s+/g, " ").trim().toLowerCase()
      }));
    input.addEventListener("input", () => {
      const term = input.value.trim().toLowerCase();
      results.innerHTML = "";
      if (!term) {
        results.hidden = true;
        return;
      }
      items.filter(item => item.text.includes(term)).slice(0, 6).forEach(match => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = match.label;
        button.addEventListener("click", () => {
          match.element.scrollIntoView({ behavior: "smooth", block: "center" });
          results.hidden = true;
        });
        results.appendChild(button);
      });
      results.hidden = false;
    });
  }

  function getReportRows(reportType) {
    const rows = {
      "Executive scorecard": [
        ["Executive scorecard", "Apex Health", "Fiber + Voice", "$1,480,000", "30.9%", "Approved"],
        ["Executive scorecard", "Brightstar Retail", "Mobile + Fiber", "$228,300", "31.8%", "Open"]
      ],
      "Revenue by product": [
        ["Revenue by product", "Apex Health", "Fiber 1G", "$512,800", "35.2%", "Stable"],
        ["Revenue by product", "Summit Manufacturing", "IoT SIM", "$189,500", "22.8%", "Growing"]
      ],
      "Invoice aging detail": [
        ["Invoice aging detail", "Brightstar Retail", "Carrier services", "$125,430", "68 days", "Priority"],
        ["Invoice aging detail", "Coastal Health Partners", "DIA", "$18,200", "91 days", "Review"]
      ],
      "Network outage SLA credits": [
        ["Network outage SLA credits", "Coastal Health Partners", "DIA", "$18,200", "1.2%", "Open"],
        ["Network outage SLA credits", "Apex Health", "Fiber 500", "$22,900", "0.8%", "Pending"]
      ]
    };
    return rows[reportType] || rows["Executive scorecard"];
  }

  function initReports() {
    const output = document.querySelector("[data-report-output]");
    const title = document.querySelector("[data-report-title]");
    if (!output) return;

    function renderReport() {
      const reportType = document.querySelector("[data-param-report]")?.value || "Executive scorecard";
      const region = document.querySelector("[data-param-region]")?.value || "All regions";
      const period = document.querySelector("[data-param-period]")?.value || "May 2026";
      const rows = getReportRows(reportType);
      if (title) title.textContent = `${reportType} - ${region} - ${period}`;
      output.innerHTML = `
        <table class="table report-table">
          <thead><tr><th>Report Area</th><th>Account</th><th>Service</th><th>Amount</th><th>Metric</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map(row => `<tr class="interactive-row" data-detail-title="${row[0]}" data-detail-body="${row[1]} ${row[2]} record is included in the current report output.">${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      `;
      initDetailsModal();
      showToast("Report refreshed");
    }

    function exportCsv() {
      const reportType = document.querySelector("[data-param-report]")?.value || "Executive scorecard";
      const rows = [["Report Area", "Account", "Service", "Amount", "Metric", "Status"], ...getReportRows(reportType)];
      const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "northstar-report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      showToast("Report exported");
    }

    document.querySelectorAll("[data-run-report]").forEach(button => button.addEventListener("click", renderReport));
    document.querySelectorAll("[data-export-report]").forEach(button => button.addEventListener("click", exportCsv));
    renderReport();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav();
    initTabs();
    initRangeBars();
    initMenus();
    initPanels();
    initDetailsModal();
    initActions();
    initSearch();
    initReports();
  });
})();
